import airlines from '@kuuki/data/airlines'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// The shared package has no `./theme/*` export entry yet; consumers switch to the package path once it does.
import {
  ACCENT_KEYS,
  MAKER_KEYS,
  MAKERS,
  MODES,
  NEUTRALS,
  REGION_KEYS,
  REGIONS,
  SURFACES,
  THEMES,
  type AccentKey,
  type Mode,
} from '../../../../packages/shared/src/theme/palette'
import { airlineColor } from '../lib/airline'
import { contrast, oklchToRgb, parseHex, rgbToOklch, toHex, type Rgb } from '../lib/color'
import { NEUTRAL_INK, SURFACE_COLOR, THEME_COLOR, resolveAccent } from '../lib/theme-colors'

// --- styles.css -> resolved token sets ---------------------------------------------------------

const css = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

type Decls = Map<string, string>

/** Declarations of every rule whose selector is exactly `selector`, merged in source order. */
function rulesFor(selector: string): Decls {
  const decls: Decls = new Map()
  for (const [, rawSelector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const normalized = rawSelector.replace(/\s+/g, '').replace(/"/g, "'")
    if (normalized !== selector) continue
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
      decls.set(name, value.trim())
    }
  }
  return decls
}

/** Cascade of the root element for a mode and accent: :root → dark → accent → dark + accent. */
function cascade(mode: Mode, accent: AccentKey): Decls {
  const layers = [
    rulesFor(':root'),
    ...(mode === 'dark' ? [rulesFor(":root[data-theme='dark']")] : []),
    rulesFor(`:root[data-accent='${accent}']`),
    ...(mode === 'dark' ? [rulesFor(`:root[data-theme='dark'][data-accent='${accent}']`)] : []),
  ]
  const merged: Decls = new Map()
  for (const layer of layers) for (const [name, value] of layer) merged.set(name, value)
  return merged
}

function resolve(value: string, decls: Decls, trail: string[] = []): string {
  return value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, name: string) => {
    const next = decls.get(name)
    if (next === undefined) throw new Error(`${name} is not declared`)
    if (trail.includes(name)) throw new Error(`${name} is circular`)
    return resolve(next, decls, [...trail, name])
  })
}

function hexOf(decls: Decls, name: string): string {
  const raw = decls.get(name)
  if (raw === undefined) throw new Error(`${name} is not declared`)
  let value = resolve(raw, decls).toLowerCase()
  if (/^#[\da-f]{3}$/.test(value)) value = '#' + [...value.slice(1)].map((ch) => ch + ch).join('')
  if (!/^#[\da-f]{6}$/.test(value)) throw new Error(`${name} is not a literal colour: ${raw}`)
  return value
}

const rgb = (hex: string): Rgb => {
  const parsed = parseHex(hex)
  if (!parsed) throw new Error(`bad colour ${hex}`)
  return parsed
}
const ratio = (a: string, b: string) => contrast(rgb(a), rgb(b))
const lightness = (hex: string) => rgbToOklch(rgb(hex)).l

const combos = MODES.flatMap((mode) => ACCENT_KEYS.map((accent) => ({ mode, accent })))
const surfacesOf = (decls: Decls) => ({
  background: hexOf(decls, '--background'),
  surface: hexOf(decls, '--surface'),
  inset: hexOf(decls, '--surface-inset'),
})

// --- CSS equals the shared table ---------------------------------------------------------------

describe.each(combos)('$mode / $accent tokens', ({ mode, accent }) => {
  const decls = cascade(mode, accent)
  const theme = THEMES[accent][mode]
  const hex = (name: string) => hexOf(decls, name)

  it('matches the shared table', () => {
    expect(hex('--accent')).toBe(theme.fill)
    expect(hex('--accent-foreground')).toBe(theme.foreground)
    expect(hex('--accent-text')).toBe(theme.text)
    expect(hex('--accent-on-tint')).toBe(theme.text)
    expect(hex('--accent-tint')).toBe(theme.tint)
    expect(hex('--focus')).toBe(theme.fill)
    expect(hex('--heat-contour')).toBe(theme.contour)
    expect(hex(`--swatch-${accent}`)).toBe(theme.fill)
    theme.comparison.forEach((color, index) => {
      expect(hex(`--cmp-${index + 1}`)).toBe(color)
      expect(hex(`--kc-chart-${index + 1}`)).toBe(color)
    })
    theme.heat.forEach((step, index) => {
      expect(hex(`--heat-${index + 1}`)).toBe(step.color)
      expect(hex(`--heat-${index + 1}-text`)).toBe(step.foreground)
      expect(hex(`--map-bucket-${index + 1}`)).toBe(step.color)
    })
    ;[0, 1, 2, 3].forEach((index) =>
      expect(hex(`--mark-${index + 1}`)).toBe(theme.comparison[index]),
    )
  })

  it('draws the rest of a peak-vs-rest metric in the accent ramp, readable on the surface', () => {
    expect(hex('--mark-rest')).toBe(hex('--heat-3'))
    expect(hex('--mark-rest')).toBe(theme.heat[2].color)
    expect(
      ratio(hex('--mark-rest'), hex('--surface')),
      '--mark-rest on surface',
    ).toBeGreaterThanOrEqual(3)
  })

  it('keeps text, muted and accent text readable on every surface and the tint', () => {
    const { background, surface, inset } = surfacesOf(decls)
    for (const bg of [background, surface, inset]) {
      for (const name of ['--text', '--text-muted', '--accent-text']) {
        expect(ratio(hex(name), bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const name of ['--text', '--text-muted', '--accent-text', '--accent-on-tint']) {
      expect(ratio(hex(name), hex('--accent-tint')), `${name} on tint`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the action label readable on the accent fill', () => {
    expect(ratio(hex('--accent-foreground'), hex('--accent'))).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps focus, comparison, makers, regions and the heat contour at 3:1 on every surface', () => {
    const { background, surface, inset } = surfacesOf(decls)
    const marks = [
      '--focus',
      '--heat-contour',
      '--missing',
      '--cat-maker-unknown',
      '--brand-neutral',
      ...[1, 2, 3, 4, 5].map((n) => `--cmp-${n}`),
      ...MAKER_KEYS.map((key) => `--cat-maker-${key}`),
      ...REGION_KEYS.map((key) => `--cat-region-${key}`),
    ]
    for (const name of marks) {
      for (const bg of [background, surface, inset]) {
        expect(ratio(hex(name), bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('keeps the rest mark, peak mark, accent and control border at 3:1 on the floating sheet', () => {
    const floating = hex('--surface-floating')
    for (const name of ['--mark-rest', '--mark-1', '--accent', '--control-border']) {
      expect(ratio(hex(name), floating), `${name} on floating`).toBeGreaterThanOrEqual(3)
    }
  })

  it('labels every heat cell at 4.5:1 and keeps the ramp monotonic', () => {
    const cells = [1, 2, 3, 4].map((n) => hex(`--heat-${n}`))
    ;[1, 2, 3, 4].forEach((n) => {
      expect(
        ratio(hex(`--heat-${n}-text`), cells[n - 1]),
        `heat-${n} label`,
      ).toBeGreaterThanOrEqual(4.5)
    })
    const levels = cells.map(lightness)
    for (let i = 1; i < levels.length; i++) {
      if (mode === 'light') expect(levels[i]).toBeLessThan(levels[i - 1])
      else expect(levels[i]).toBeGreaterThan(levels[i - 1])
    }
  })
})

describe.each(MODES)('%s mode tokens', (mode) => {
  const decls = cascade(mode, 'shu')
  const hex = (name: string) => hexOf(decls, name)

  it('matches the shared surfaces, categories and neutral roles', () => {
    const surfaces = SURFACES[mode]
    expect(hex('--background')).toBe(surfaces.background)
    expect(hex('--surface')).toBe(surfaces.surface)
    expect(hex('--surface-inset')).toBe(surfaces.inset)
    expect(hex('--text')).toBe(surfaces.text)
    expect(hex('--text-muted')).toBe(surfaces.muted)
    for (const key of MAKER_KEYS) expect(hex(`--cat-maker-${key}`)).toBe(MAKERS[mode][key])
    for (const key of REGION_KEYS) expect(hex(`--cat-region-${key}`)).toBe(REGIONS[mode][key])
    const neutrals = NEUTRALS[mode]
    expect(hex('--zero')).toBe(neutrals.zero)
    expect(hex('--missing')).toBe(neutrals.missing)
    expect(hex('--cat-maker-unknown')).toBe(neutrals.makerUnknown)
    expect(hex('--mark-ghost')).toBe(neutrals.markGhost)
    expect(hex('--brand-neutral')).toBe(neutrals.brandNeutral)
  })

  it('keeps the known zero as the heat-0 cell and the contour identical across accents', () => {
    expect(hex('--heat-0')).toBe(hex('--surface-inset'))
    for (const accent of ACCENT_KEYS) {
      expect(THEMES[accent][mode].contour).toBe(THEMES.shu[mode].contour)
    }
  })

  it('keeps the skeleton fill visible on the surface and the floating sheet', () => {
    for (const name of ['--surface', '--surface-floating']) {
      expect(ratio(hex('--skeleton'), hex(name)), `--skeleton on ${name}`).toBeGreaterThanOrEqual(
        1.3,
      )
    }
  })

  it('declares the distinct neutral roles as their own tokens', () => {
    const own = rulesFor(mode === 'dark' ? ":root[data-theme='dark']" : ':root')
    for (const name of [
      '--zero',
      '--missing',
      '--cat-maker-unknown',
      '--mark-ghost',
      '--brand-neutral',
    ]) {
      expect(own.has(name), name).toBe(true)
    }
  })
})

// --- non-CSS consumers -------------------------------------------------------------------------

describe('non-CSS colour constants', () => {
  it.each(MODES)('THEME_COLOR, SURFACE_COLOR and NEUTRAL_INK mirror the %s tokens', (mode) => {
    const decls = cascade(mode, 'shu')
    expect(THEME_COLOR[mode]).toBe(hexOf(decls, '--background'))
    expect(SURFACE_COLOR[mode]).toBe(hexOf(decls, '--surface'))
    expect(NEUTRAL_INK[mode]).toBe(hexOf(decls, '--text-muted'))
    expect(THEME_COLOR[mode]).toBe(SURFACES[mode].background)
    expect(SURFACE_COLOR[mode]).toBe(SURFACES[mode].surface)
    expect(NEUTRAL_INK[mode]).toBe(SURFACES[mode].muted)
  })

  it('resolves legacy and unknown accent names', () => {
    for (const accent of ACCENT_KEYS) expect(resolveAccent(accent)).toBe(accent)
    const legacy = {
      terracotta: 'shu',
      kincha: 'shu',
      sumi: 'shu',
      yellow: 'shu',
      red: 'shu',
      orange: 'shu',
      blue: 'ai',
      cyan: 'asagi',
      teal: 'asagi',
      purple: 'sakura',
      coral: 'sakura',
    }
    for (const [from, to] of Object.entries(legacy)) expect(resolveAccent(from)).toBe(to)
    for (const bad of [undefined, null, 4, '', 'SHU', 'toString', '__proto__', 'green']) {
      expect(resolveAccent(bad)).toBe('shu')
    }
  })
})

// --- airline brands ----------------------------------------------------------------------------

describe.each(MODES)('airline brand colours in %s mode', (mode) => {
  const decls = cascade(mode, 'shu')
  const { background, surface, inset } = surfacesOf(decls)
  const bounds = {
    lMin: Number(decls.get('--brand-l-min')),
    lMax: Number(decls.get('--brand-l-max')),
    cMax: Number(decls.get('--brand-c-max')),
  }
  const branded = airlines.filter((row) => row.primaryColor)

  it('reads numeric bounds from styles.css', () => {
    expect(Object.values(bounds).every(Number.isFinite)).toBe(true)
    expect(bounds.lMin).toBeLessThan(bounds.lMax)
  })

  it('holds 3:1 on background, surface and inset for every catalog brand', () => {
    const formula =
      /^oklch\(from (#[\da-f]{3,8}) clamp\(var\(--brand-l-min\), l, var\(--brand-l-max\)\) min\(c, var\(--brand-c-max\)\) h\)$/i
    expect(branded.length).toBeGreaterThan(100)
    let min = Infinity
    for (const row of branded) {
      const match = formula.exec(airlineColor(row.iata))
      expect(match, `${row.iata} formula`).not.toBeNull()
      const source = rgbToOklch(rgb(match![1]))
      const mark = toHex(
        oklchToRgb({
          l: Math.min(Math.max(source.l, bounds.lMin), bounds.lMax),
          c: Math.min(source.c, bounds.cMax),
          h: source.h,
        }),
      )
      for (const bg of [background, surface, inset]) {
        const r = ratio(mark, bg)
        min = Math.min(min, r)
        expect(r, `${row.iata} ${mark} on ${bg}`).toBeGreaterThanOrEqual(3)
      }
    }
    expect(min).toBeGreaterThanOrEqual(3)
  })

  it('sends an airline without a catalog colour to the neutral role', () => {
    expect(airlineColor('ZZZ')).toBe('var(--brand-neutral)')
    const missing = airlines.find((row) => !row.primaryColor)
    if (missing) expect(airlineColor(missing.iata)).toBe('var(--brand-neutral)')
  })
})
