// Proposal generator; no application tokens or project dependencies are changed.
import Color from '/tmp/kuuki-colorjs-0.7.1.mjs'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

const contrast = (a, b) => new Color(a).contrast(new Color(b), 'WCAG21')
const hex = (color) => color.to('srgb').toString({ format: 'hex' })
const lightness = (color) => new Color(color).to('oklch').coords[0]
const modes = {
  light: { background: '#fbfaf8', surface: '#ffffff', inset: '#f2f0ed', text: '#302d2a', muted: '#66605b' },
  dark: { background: '#292827', surface: '#353331', inset: '#403d3a', text: '#f1efeb', muted: '#c4beb7' },
}
const accents = {
  shu: { name: 'Shu', light: '#c23417', dark: '#ea846f' },
  ai: { name: 'Ai', light: '#4e5ea2', dark: '#acbbef' },
  matcha: { name: 'Matcha', light: '#59702a', dark: '#b7ce92' },
  asagi: { name: 'Asagi', light: '#0c747d', dark: '#85cfd8' },
  sakura: { name: 'Sakura', light: '#964969', dark: '#e8a9c0' },
}

// Keep L/h; reduce C to a chosen fraction of the hue's actual sRGB gamut.
function paint(L, H, fraction = .58, cap = .13) {
  let low = 0, high = .4
  for (let i = 0; i < 24; i++) {
    const C = (low + high) / 2
    const rgb = new Color('oklch', [L, C, H]).to('srgb').coords
    if (rgb.every((v) => v >= 0 && v <= 1)) low = C
    else high = C
  }
  return hex(new Color('oklch', [L, Math.min(low * fraction, cap), H]))
}

function role(H, mode, target = 3.15, backgrounds = Object.values(modes[mode]).slice(0, 3), cap = .13, offset = 0) {
  let L = (mode === 'light' ? .54 : .74) + offset
  for (let i = 0; i < 100; i++) {
    const color = paint(L, H, .58, cap)
    if (backgrounds.every((bg) => contrast(color, bg) >= target)) return color
    L += mode === 'light' ? -.002 : .002
  }
  throw new Error(`No usable role for ${H}/${mode}`)
}

const makers = [
  ['airbus', 'Airbus', '#0f6390', .08], ['boeing', 'Boeing', '#16a384', 0],
  ['embraer', 'Embraer', '#8c6d08', .08], ['atr', 'ATR', '#9a52cf', 0],
]
const regions = [
  ['africa', 'Африка', 78, .08], ['americas', 'Америка', 35, -.08],
  ['antarctica', 'Антарктида', 265, -.08], ['asia', 'Азия', 325, 0],
  ['europe', 'Европа', 245, .08], ['oceania', 'Океания', 175, 0],
]
// Fixed categorical profiles selected by a bounded CVD/lightness review, not a numeric ordering.
const comparisonOffsets = {
  shu: [-.08, 0, -.08, .08, 0], ai: [0, .08, 0, .04, -.08],
  matcha: [0, -.08, .08, .08, -.08], asagi: [-.08, .04, .08, -.08, 0],
  sakura: [-.08, -.04, .04, -.04, .08],
}
const catalog = JSON.parse(await readFile(new URL('../../packages/data/src/airlines.json', import.meta.url), 'utf8'))
const brands = ['TK', 'EK'].map((iata) => {
  const row = catalog.find((r) => r.iata === iata)
  assert(row?.primaryColor, `Missing example brand ${iata}`)
  return { key: iata, source: row.primaryColor }
})
const data = { status: 'final agent recommendation; not applied to app', version: 1, library: 'colorjs.io@0.7.1', modes, accents, makers: {}, regions: {}, brands: {}, themes: {} }
const measurements = []
const heatFillObservations = []
function measure(roleName, fg, bg, target) {
  const ratio = contrast(fg, bg)
  measurements.push({ role: roleName, foreground: fg, background: bg, ratio: +ratio.toFixed(4), target })
  assert(ratio >= target, `${roleName}: ${ratio} < ${target}`)
}
for (const mode of Object.keys(modes)) {
  const base = modes[mode]
  for (const bg of [base.background, base.surface, base.inset]) {
    measure(`${mode}:text`, base.text, bg, 4.5)
    measure(`${mode}:muted`, base.muted, bg, 4.5)
  }
  data.makers[mode] = makers.map(([key, name, original, offset]) => ({ key, name, color: role(new Color(original).to('oklch').coords[2], mode, 3.15, [base.background, base.surface, base.inset], .13, offset) }))
  data.regions[mode] = regions.map(([key, name, hue, offset]) => ({ key, name, color: role(hue, mode, 3.15, [base.background, base.surface, base.inset], key === 'antarctica' ? .035 : .13, offset) }))
  data.brands[mode] = brands.map((row) => ({ ...row, color: role(new Color(row.source).to('oklch').coords[2], mode) }))
  const neutral = role(70, mode)
  for (const bg of [base.background, base.surface, base.inset]) measure(`${mode}:control-and-heat-contour`, neutral, bg, 3)
  data.makers[mode].push({ key: 'other', name: 'Other', color: paint((mode === 'light' ? .54 : .74) - .08, 70, .16, .022) })
  for (const row of [...data.makers[mode], ...data.regions[mode]]) {
    for (const bg of [base.background, base.surface, base.inset]) measure(`${mode}:category:${row.key}`, row.color, bg, 3)
  }
  for (const row of data.brands[mode]) for (const bg of [base.background, base.surface, base.inset]) measure(`${mode}:brand:${row.key}`, row.color, bg, 3)
  for (const [key, accent] of Object.entries(accents)) {
    const hue = new Color(accent.light).to('oklch').coords[2]
    const tint = paint(mode === 'light' ? .95 : .38, hue, .25, .025)
    const text = role(hue, mode, 4.65, [base.background, base.surface, base.inset, tint])
    const comparison = [0, 85, 165, 245, 300].map((offset, i) => role((hue + offset) % 360, mode, 3.15, [base.background, base.surface, base.inset], .13, comparisonOffsets[key][i]))
    const heat = (mode === 'light' ? [.90, .79, .66, .53] : [.45, .55, .66, .77]).map((L, i) => {
      const color = paint(L, hue, [.30, .42, .54, .58][i], [.04, .07, .10, .12][i])
      const candidates = [base.text, '#ffffff', '#000000']
      const foreground = candidates.find((fg) => contrast(fg, color) >= 4.55) ?? candidates.sort((a, b) => contrast(b, color) - contrast(a, color))[0]
      measure(`${mode}:${key}:heat-${i + 1}:label`, foreground, color, 4.5)
      for (const bg of [base.background, base.surface, base.inset]) heatFillObservations.push({ role: `${mode}:${key}:heat-${i + 1}:fill`, foreground: color, background: bg, ratio: +contrast(color, bg).toFixed(4), target: null, cue: 'visible contour, numeral, legend' })
      return { color, foreground }
    })
    const foreground = mode === 'light' ? '#ffffff' : '#292827'
    measure(`${mode}:${key}:action`, foreground, accent[mode], 4.5)
    for (const bg of [base.background, base.surface, base.inset, tint]) measure(`${mode}:${key}:accent-text`, text, bg, 4.5)
    for (const color of comparison) for (const bg of [base.background, base.surface, base.inset]) measure(`${mode}:${key}:comparison`, color, bg, 3)
    for (const bg of [base.background, base.surface, base.inset]) measure(`${mode}:${key}:focus`, accent[mode], bg, 3)
    const heatL = heat.map((row) => lightness(row.color))
    assert(heatL.every((L, i) => i === 0 || (mode === 'light' ? L < heatL[i - 1] : L > heatL[i - 1])))
    data.themes[`${mode}:${key}`] = { accent: accent[mode], foreground, tint, text, comparison, heat, border: role(70, mode) }
  }
}
assert.equal(contrast('#ffffff', '#000000'), 21)
const summary = { pairs: measurements.length, minRatio: Math.min(...measurements.map((m) => m.ratio)), exceptions: 'Heat fill/background ratios are reported separately; visible contours and numerals carry the level.' }
await writeFile(new URL('./palette-proposal.json', import.meta.url), JSON.stringify(data, null, 2) + '\n')
await writeFile(new URL('./palette-measurements.json', import.meta.url), JSON.stringify({ status: 'declared opaque sRGB pairs only', summary, measurements, heatFillObservations }, null, 2) + '\n')
console.log(JSON.stringify(summary))
