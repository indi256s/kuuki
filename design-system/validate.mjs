import fs from 'node:fs'
import { wcagContrast, displayable, converter, differenceCiede2000 } from 'culori'
const deltaE = differenceCiede2000()
const palette = JSON.parse(fs.readFileSync(new URL('./palette.json', import.meta.url)))
const checks = []
const gamut = []
for (const [name, t] of Object.entries(palette.themes)) {
  for (const [role, value] of Object.entries(t))
    gamut.push({ name, role, value, pass: displayable(value) })
  const pair = (fg, bg, threshold) => {
    const ratio = wcagContrast(t[fg], t[bg])
    checks.push({ name, fg, bg, ratio, threshold, pass: ratio >= threshold })
  }
  for (const bg of ['background', 'surface', 'surface-inset', 'surface-floating']) {
    for (const fg of [
      'text',
      'text-muted',
      'accent-text',
      'danger-text',
      'success-text',
      'warning-text',
      'info-text',
    ])
      pair(fg, bg, 4.5)
    for (const fg of [
      'control-border',
      'focus',
      'mark-rest',
      'mark-peak',
      'heat-contour',
      'heat-4',
      'missing',
      'cat-maker-airbus',
      'cat-maker-boeing',
      'cat-maker-embraer',
      'cat-maker-atr',
      'cat-maker-other',
      'cat-maker-unknown',
      'cmp-1',
      'cmp-2',
      'cmp-3',
      'cmp-4',
      'cmp-5',
    ])
      pair(fg, bg, 3)
  }
  for (const fg of ['text', 'text-muted', 'accent-on-tint']) pair(fg, 'accent-tint', 4.5)
  pair('accent-foreground', 'accent', 4.5)
  pair('accent-foreground', 'figure-live-fill', 4.5)
  pair('accent-hover-foreground', 'accent-hover', 4.5)
  pair('mark-peak', 'mark-rest', 1.4)
  for (const status of ['danger', 'success', 'warning', 'info'])
    pair(status + '-foreground', status + '-fill', 4.5)
  for (let i = 1; i <= 4; i++) pair('heat-' + i + '-text', 'heat-' + i, 4.5)
  const lightness = [0, 1, 2, 3, 4].map((i) => converter('oklch')(t['heat-' + i]).l)
  checks.push({
    name,
    rule: 'Heat lightness monotonic',
    pass: lightness.every(
      (l, i) => i === 0 || (name.startsWith('light') ? l < lightness[i - 1] : l > lightness[i - 1]),
    ),
  })
  // Role uniqueness: thresholds are CIEDE2000 distances between roles that can share a view.
  const distinct = (a, b, threshold, rule) => {
    const distance = deltaE(t[a], t[b])
    checks.push({ name, rule, fg: a, bg: b, distance, threshold, pass: distance >= threshold })
  }
  // Status is never conveyed by colour alone (icon or label), so 10 suffices.
  for (const status of ['danger', 'info', 'success', 'warning'])
    distinct('accent-text', status + '-text', 10, 'Accent/status text distance')
  // mark-peak is the selected reading: the accent's text colour, apart from ramps and slots.
  // Category charts never use it; they show selection with --selection-contour.
  checks.push({
    name,
    rule: 'mark-peak equals accent-text',
    pass: t['mark-peak'] === t['accent-text'],
  })
  for (let i = 1; i <= 4; i++) distinct('mark-peak', 'heat-' + i, 8, 'Selection/heat distance')
  for (let i = 1; i <= 5; i++) distinct('mark-peak', 'cmp-' + i, 8, 'Selection/comparison distance')
  distinct('accent', 'accent-hover', 6, 'Accent hover distance')
  const accentHue = converter('oklch')(t.accent).h
  for (const status of ['danger', 'success', 'warning', 'info']) {
    const hue = converter('oklch')(t[status + '-fill']).h
    const distance = Math.min(Math.abs(hue - accentHue), 360 - Math.abs(hue - accentHue))
    checks.push({
      name,
      rule: 'Accent/status hue distance: ' + status,
      distance,
      pass: distance >= 15,
    })
  }
}
const failures = [...checks, ...gamut].filter((c) => !c.pass)
const report = {
  combinations: Object.keys(palette.themes).length,
  checks: checks.length,
  gamutChecks: gamut.length,
  minimumTextContrast: Math.min(...checks.filter((c) => c.threshold === 4.5).map((c) => c.ratio)),
  failures,
  coverage:
    'Declared opaque pairs only. Browser compositing, disabled exceptions, airline/stamp inks, and complete application behavior are outside this check.',
  pairs: checks,
}
fs.writeFileSync(
  new URL('./contrast-report.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
)
console.log(JSON.stringify({ ...report, pairs: undefined }, null, 2))
if (failures.length) process.exitCode = 1
