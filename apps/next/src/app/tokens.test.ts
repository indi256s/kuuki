import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrast, mixOklch, oklchToRgb, parseHex, rgbToOklch, type Rgb } from '../lib/color'
import { ACCENTS, NEUTRAL_INK, SURFACE_COLOR, THEME_COLOR } from '../lib/theme-colors'

// The canonical palette is src/app/styles.css; this test parses it instead of keeping a second copy.
const css = readFileSync(join(__dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const controlsCss = readFileSync(join(__dirname, '../client/ui/flight-controls.css'), 'utf8')
const highlightBody = controlsCss.match(/(?:^|})[^{}]*\bmark\s*\{([^{}]*)\}/)?.[1] ?? ''
const highlight = Object.fromEntries(highlightBody.split(';').filter(Boolean).map(part => {
  const at = part.indexOf(':')
  return [part.slice(0, at).trim(), part.slice(at + 1).trim()]
}))
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
  const mix = v.match(/^color-mix\(in (oklch|oklab),(.*)\)$/)
  if (mix) {
    const [a, b] = splitTop(mix[2]).map(part => {
      const m = part.match(/^(.*?)\s+(\d+(?:\.\d+)?)%$/)
      return { color: parse(vars, m ? m[1] : part), share: m ? Number(m[2]) / 100 : null }
    })
    const share = a.share ?? (b.share === null ? 0.5 : 1 - b.share)
    const first = rgbToOklch(a.color), second = rgbToOklch(b.color)
    if (mix[1] === 'oklch') return oklchToRgb(mixOklch(first, second, share))
    const cartesian = ({ l, c, h }: ReturnType<typeof rgbToOklch>) => [l, c * Math.cos(h * Math.PI / 180), c * Math.sin(h * Math.PI / 180)]
    const x = cartesian(first), y = cartesian(second)
    const [l, A, B] = x.map((value, i) => value * share + y[i] * (1 - share))
    return oklchToRgb({ l, c: Math.hypot(A, B), h: Math.atan2(B, A) * 180 / Math.PI })
  }
  throw new Error(`cannot resolve ${v}`)
}

const themes: Theme[] = ['light', 'dark']
const combos = themes.flatMap(theme => ACCENTS.map(accent => [theme, accent] as const))
const textGrade = ['--text', '--text-muted', '--accent-text', '--danger-text', '--success-text', '--warning-text', '--info-text',
  '--rank-gold', '--rank-silver', '--rank-bronze']

describe('design tokens', () => {
  it('offers exactly the five accents', () => {
    expect([...ACCENTS]).toEqual(['shu', 'ai', 'matcha', 'asagi', 'sakura'])
    expect(css).not.toMatch(/kincha|sumi/)
  })

  it('keeps CSS accents and ACCENTS in sync', () => {
    const fromCss = [...new Set([...rules.keys()].map(key => key.match(/\[data-accent=([\w-]+)\]$/)?.[1]).filter(Boolean))]
    expect(['shu', ...fromCss].sort()).toEqual([...ACCENTS].sort())
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
    for (const accent of ACCENTS.filter(name => name !== 'shu')) {
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

  it.each(combos)('%s / %s: rendered search highlight colors reach 4.5:1', (theme, accent) => {
    const vars = computed(theme, accent)
    expect(contrast(parse(vars, highlight.color), parse(vars, highlight.background))).toBeGreaterThanOrEqual(4.5)
  })

  it('accent blocks never override status, rank, text or surface tokens', () => {
    const allowed = new Set(['--accent', '--accent-text', '--accent-foreground', '--focus'])
    for (const [selector, declarations] of rules) {
      if (!selector.includes('data-accent')) continue
      for (const name of Object.keys(declarations)) expect(allowed.has(name), `${selector} sets ${name}`).toBe(true)
    }
  })

  // These root-scoped selectors outrank the later shell.css active-state rules.
  it.each([
    /:root\[data-theme=dark\] \.main-nav a\[aria-current=page\]:hover\{color:var\(--text\)\}/,
    /:root\[data-theme=dark\] \.tab\[aria-current=page\]:active\{color:var\(--text\)\}/,
  ])('uses text ink for dark active navigation on inset: %s', selector => {
    expect(css).toMatch(selector)
    const vars = computed('dark', 'shu')
    expect(contrast(resolve(vars, '--text'), resolve(vars, '--surface-inset'))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(combos)('%s / %s: map buckets form a ramp away from the land color', (theme, accent) => {
    const vars = computed(theme, accent)
    const land = rgbToOklch(resolve(vars, '--map-land'))
    const steps = [1, 2, 3, 4].map(n => Math.abs(rgbToOklch(resolve(vars, `--map-bucket-${n}`)).l - land.l))
    for (let i = 1; i < steps.length; i++) expect(steps[i], `bucket ${i + 1} vs ${i}`).toBeGreaterThan(steps[i - 1])
    expect(contrast(resolve(vars, '--map-bucket-4'), resolve(vars, '--map-land'))).toBeGreaterThanOrEqual(1.5)
  })

  it.each([
    ['light', ['#ecc6bb', '#e5a494', '#da7d68', '#c94c33']],
    ['dark', ['#674e47', '#865c51', '#ac6b5d', '#d87d6a']],
  ] as const)('%s: Shu map buckets match the specified OKLab ramp', (theme, expected) => {
    const vars = computed(theme, 'shu')
    expected.forEach((hex, i) => {
      const actual = resolve(vars, `--map-bucket-${i + 1}`)
      parseHex(hex)!.forEach((channel, j) => expect(Math.abs(actual[j] - channel) * 255).toBeLessThanOrEqual(1))
    })
  })

  it.each(themes)('%s: defines the data and category palette independently of accent selection', theme => {
    const expected = theme === 'light' ? {
      '--mark-2': '#da6a53', '--mark-3': '#b28555', '--mark-4': '#66605b', '--mark-ghost': '#978c7f',
      '--cat-maker-airbus': '#0f6390', '--cat-maker-boeing': '#16a384', '--cat-maker-embraer': '#8c6d08',
      '--cat-maker-atr': '#9a52cf', '--cat-maker-other': '#c2bab0', '--cat-maker-unknown': '#ece9e5',
      '--cat-alliance-star': '#6b5a2e', '--cat-alliance-oneworld': '#6a3f55', '--cat-alliance-skyteam': '#3e5266',
      '--danger-text': '#a02442', '--danger-fill': '#ca3056',
    } : {
      '--mark-2': '#c85f49', '--mark-3': '#a17749', '--mark-4': '#c4beb7', '--mark-ghost': '#897e70',
      '--cat-maker-airbus': '#0685b6', '--cat-maker-boeing': '#04ac7b', '--cat-maker-embraer': '#a4770f',
      '--cat-maker-atr': '#a36ffa', '--cat-maker-other': '#c9c1b7', '--cat-maker-unknown': '#47433f',
      '--cat-alliance-star': '#cdb98a', '--cat-alliance-oneworld': '#d3a6bc', '--cat-alliance-skyteam': '#a9bbd0',
      '--danger-text': '#f0a7af', '--danger-fill': '#f25776',
    }
    for (const accent of ACCENTS) {
      const vars = computed(theme, accent)
      for (const [token, hex] of Object.entries(expected)) expect(resolve(vars, token), token).toEqual(parseHex(hex))
      expect(resolve(vars, '--mark-1')).toEqual(resolve(vars, '--accent'))
      for (const [i, token] of ['--mark-1', '--mark-2', '--mark-3', '--mark-4', '--mark-ghost'].entries()) {
        expect(resolve(vars, `--kc-chart-${i + 1}`)).toEqual(resolve(vars, token))
      }
      expect(resolve(vars, '--heat-0')).toEqual(resolve(vars, '--surface-inset'))
      for (const [i, hex] of ['#e6c8c1', '#e4735c', '#c23417', '#892410'].entries()) {
        expect(resolve(vars, `--heat-${i + 1}`)).toEqual(parseHex(hex))
      }
    }
  })

  it('elevates dark floating surfaces one step above the surface', () => {
    const vars = computed('dark', 'shu')
    expect(rgbToOklch(resolve(vars, '--surface-floating')).l).toBeGreaterThan(rgbToOklch(resolve(vars, '--surface')).l)
  })

  it('keeps the TS mirrors in sync with the canonical tokens', () => {
    for (const theme of themes) {
      const vars = computed(theme, 'shu')
      expect(parseHex(THEME_COLOR[theme])).toEqual(resolve(vars, '--background'))
      expect(parseHex(SURFACE_COLOR[theme])).toEqual(resolve(vars, '--surface'))
      expect(parseHex(NEUTRAL_INK[theme])).toEqual(resolve(vars, '--text-muted'))
    }
  })

  it.each(themes)('%s: cached map outline colors match the canonical palette', theme => {
    const vars = computed(theme, 'terracotta')
    const svg = readFileSync(join(__dirname, `../../public/maps/world-outline-110m-2.0.2-${theme}.svg`), 'utf8')
    expect(parseHex(svg.match(/^<svg\b[^>]*\bfill="([^"]+)"/)?.[1] ?? '')).toEqual(resolve(vars, '--map-land'))
    expect(parseHex(svg.match(/^<svg\b[^>]*\bstroke="([^"]+)"/)?.[1] ?? '')).toEqual(resolve(vars, '--map-border'))
  })
})
