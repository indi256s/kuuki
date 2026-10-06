import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrast, mixOklch, oklchToRgb, parseHex, rgbToOklch, type Rgb } from '../lib/color'
import { ACCENTS, NEUTRAL_INK, SURFACE_COLOR, THEME_COLOR } from '../lib/theme-colors'

// The canonical palette is src/app/styles.css; this test parses it instead of keeping a second copy.
const css = readFileSync(join(__dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = new Map<string, Record<string, string>>()
for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const key = selector.trim()
  if (!key.startsWith(':root')) continue
  const declarations = rules.get(key) ?? {}
  for (const part of body.split(';')) {
    const at = part.indexOf(':')
    if (at > 0 && part.trim().startsWith('--')) declarations[part.slice(0, at).trim()] = part.slice(at + 1).trim()
  }
  rules.set(key, declarations)
}

type Theme = 'light' | 'dark'
// Cascade order on <html data-theme data-accent>: base, theme, accent, theme+accent (equal specificity: source order).
function computed(theme: Theme, accent: string) {
  const selectors = [':root', ...(theme === 'dark' ? [':root[data-theme=dark]'] : []), `:root[data-accent=${accent}]`,
    ...(theme === 'dark' ? [`:root[data-theme=dark][data-accent=${accent}]`] : [])]
  return Object.assign({}, ...selectors.map(selector => rules.get(selector) ?? {})) as Record<string, string>
}

function splitTop(input: string): string[] {
  const parts: string[] = []
  let depth = 0, start = 0
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '(') depth++
    else if (input[i] === ')') depth--
    else if (input[i] === ',' && depth === 0) { parts.push(input.slice(start, i).trim()); start = i + 1 }
  }
  parts.push(input.slice(start).trim())
  return parts
}

function resolve(vars: Record<string, string>, name: string): Rgb {
  const raw = vars[name]
  if (!raw) throw new Error(`${name} is not defined`)
  return parse(vars, raw)
}
function parse(vars: Record<string, string>, value: string): Rgb {
  const v = value.trim()
  const reference = v.match(/^var\((--[\w-]+)\)$/)
  if (reference) return resolve(vars, reference[1])
  const hex = parseHex(v)
  if (hex) return hex
  const mix = v.match(/^color-mix\(in oklch,(.*)\)$/)
  if (mix) {
    const [a, b] = splitTop(mix[1]).map(part => {
      const m = part.match(/^(.*?)\s+(\d+(?:\.\d+)?)%$/)
      return { color: parse(vars, m ? m[1] : part), share: m ? Number(m[2]) / 100 : null }
    })
    const share = a.share ?? (b.share === null ? 0.5 : 1 - b.share)
    return oklchToRgb(mixOklch(rgbToOklch(a.color), rgbToOklch(b.color), share))
  }
  throw new Error(`cannot resolve ${v}`)
}

const themes: Theme[] = ['light', 'dark']
const combos = themes.flatMap(theme => ACCENTS.map(accent => [theme, accent] as const))
const textGrade = ['--text', '--text-muted', '--accent-text', '--danger-text', '--success-text', '--warning-text', '--info-text',
  '--rank-gold', '--rank-silver', '--rank-bronze']

describe('design tokens', () => {
  it('offers exactly the five accents', () => {
    expect([...ACCENTS]).toEqual(['terracotta', 'ai', 'matcha', 'asagi', 'sakura'])
    expect(css).not.toMatch(/kincha|sumi/)
  })

  it('keeps CSS accents and ACCENTS in sync', () => {
    const fromCss = [...new Set([...rules.keys()].map(key => key.match(/\[data-accent=([\w-]+)\]$/)?.[1]).filter(Boolean))]
    expect(['terracotta', ...fromCss].sort()).toEqual([...ACCENTS].sort())
  })

  it('declares blocks in cascade order: root, dark, accents, dark+accent', () => {
    const order = [...rules.keys()]
    const accents = order.flatMap(key => key.match(/^:root\[data-accent=([\w-]+)\]$/)?.[1] ?? [])
    expect(accents.length).toBeGreaterThan(0)
    expect(order[0]).toBe(':root')
    expect(order[1]).toBe(':root[data-theme=dark]')
    for (const accent of accents) {
      const light = order.indexOf(`:root[data-accent=${accent}]`), dark = order.indexOf(`:root[data-theme=dark][data-accent=${accent}]`)
      expect(light, accent).toBeGreaterThan(1)
      expect(dark, `${accent} dark`).toBeGreaterThan(light)
    }
  })

  it('defines every themed accent', () => {
    for (const accent of ACCENTS.filter(name => name !== 'terracotta')) {
      expect(rules.has(`:root[data-accent=${accent}]`), accent).toBe(true)
      expect(rules.has(`:root[data-theme=dark][data-accent=${accent}]`), accent).toBe(true)
    }
  })

  it.each(combos)('%s / %s: text-grade tokens reach 4.5:1 on background and surface', (theme, accent) => {
    const vars = computed(theme, accent)
    for (const surface of ['--background', '--surface']) {
      for (const token of textGrade) {
        expect(contrast(resolve(vars, token), resolve(vars, surface)), `${token} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it.each(combos)('%s / %s: accent foreground, control border and focus ring', (theme, accent) => {
    const vars = computed(theme, accent)
    expect(contrast(resolve(vars, '--accent-foreground'), resolve(vars, '--accent')), 'foreground on accent').toBeGreaterThanOrEqual(4.5)
    for (const surface of ['--background', '--surface']) {
      for (const token of ['--control-border', '--focus']) {
        expect(contrast(resolve(vars, token), resolve(vars, surface)), `${token} on ${surface}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('accent blocks never override status, rank, text or surface tokens', () => {
    const allowed = new Set(['--accent', '--accent-text', '--accent-foreground', '--focus'])
    for (const [selector, declarations] of rules) {
      if (!selector.includes('data-accent')) continue
      for (const name of Object.keys(declarations)) expect(allowed.has(name), `${selector} sets ${name}`).toBe(true)
    }
  })

  it.each(combos)('%s / %s: map buckets form a ramp away from the land color', (theme, accent) => {
    const vars = computed(theme, accent)
    const land = rgbToOklch(resolve(vars, '--map-land'))
    const steps = [1, 2, 3, 4].map(n => Math.abs(rgbToOklch(resolve(vars, `--map-bucket-${n}`)).l - land.l))
    for (let i = 1; i < steps.length; i++) expect(steps[i], `bucket ${i + 1} vs ${i}`).toBeGreaterThan(steps[i - 1])
    expect(contrast(resolve(vars, '--map-bucket-4'), resolve(vars, '--map-land'))).toBeGreaterThanOrEqual(1.5)
  })

  it('elevates dark floating surfaces one step above the surface', () => {
    const vars = computed('dark', 'terracotta')
    expect(rgbToOklch(resolve(vars, '--surface-floating')).l).toBeGreaterThan(rgbToOklch(resolve(vars, '--surface')).l)
  })

  it('keeps the TS mirrors in sync with the canonical tokens', () => {
    for (const theme of themes) {
      const vars = computed(theme, 'terracotta')
      expect(parseHex(THEME_COLOR[theme])).toEqual(resolve(vars, '--background'))
      expect(parseHex(SURFACE_COLOR[theme])).toEqual(resolve(vars, '--surface'))
      expect(parseHex(NEUTRAL_INK[theme])).toEqual(resolve(vars, '--text-muted'))
    }
  })
})
