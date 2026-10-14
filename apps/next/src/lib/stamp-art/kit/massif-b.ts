// Mulanje-type granite massif: a high plateau of steep buttresses and gullied cliff faces, jagged
// at the top, under a dark forest skirt. Each buttress peak casts a shaded right flank. The box
// bottom is the foot of the forest; `ridge` is the skyline as [x, y] fractions of the box.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num, pairs } from './util'

function yAtX(line: Pt[], px: number): number {
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      b = line[i + 1]
    if (a[0] <= px && px <= b[0]) return a[1] + ((px - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1])
  }
  return line[line.length - 1][1]
}

export const massifB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 12)))
  const base = y + h
  const foot = y + h * num(p, 'forest', 0.84)
  const ridge = pairs(p, 'ridge', [
    [0, 0.74],
    [0.05, 0.3],
    [0.16, 0.2],
    [0.3, 0.26],
    [0.42, 0.1],
    [0.5, 0.18],
    [0.64, 0.06],
    [0.76, 0.2],
    [0.9, 0.16],
    [1, 0.74],
  ]).map(([fx, fy]): Pt => [x + fx * w, y + fy * h])
  const sky: Pt[] = []
  for (let i = 0; i + 1 < ridge.length; i++) {
    const a = ridge[i],
      b = ridge[i + 1]
    const n = Math.max(2, Math.round(Math.abs(b[0] - a[0]) / 5))
    for (let k = 0; k < n; k++) {
      const t = k / n
      sky.push([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t + (k ? (rand() - 0.5) * 1.8 : 0),
      ])
    }
  }
  sky.push(ridge[ridge.length - 1])
  const massif: Pt[] = [...sky, [sky[sky.length - 1][0], foot + 3], [sky[0][0], foot + 3]]
  const out: SvgNode[] = [occlude(massif)]
  // Shaded right flank under each summit (local maxima of the skyline).
  for (let i = 1; i + 1 < ridge.length; i++) {
    if (!(ridge[i][1] < ridge[i - 1][1] && ridge[i][1] <= ridge[i + 1][1])) continue
    const px = ridge[i][0]
    const wd = Math.min(w * 0.2, ridge[i + 1][0] - px)
    const flank: Pt[] = []
    for (let k = 0; k <= 4; k++) {
      const qx = px + (wd * k) / 4
      flank.push([qx, Math.max(yAtX(sky, qx), ridge[i][1])])
    }
    flank.push([px + wd * 0.7, foot], [px + 1, foot])
    out.push(
      ...toneFill(flank, 'T4', { angle: 90, gap: 2, weight: 'fine', inset: 0.5 }),
      stroke('hair', [
        [px, ridge[i][1] + 1],
        [px + 1.5, foot - 2],
      ]),
    )
  }
  // Gullies down the lit face.
  for (let gx = x + 6; gx < x + w - 4; gx += 5 + rand() * 6) {
    const top = yAtX(sky, gx) + 5 + rand() * 6
    const bot = top + (foot - top) * (0.35 + rand() * 0.45)
    if (bot - top < 8) continue
    out.push(
      stroke('fine', [
        [gx, top],
        [gx + (rand() - 0.5) * 2.4, (top + bot) / 2],
        [gx + (rand() - 0.5) * 3, bot],
      ]),
    )
  }
  out.push(stroke('line', sky))
  // Forest skirt: dark scalloped band.
  const crown: Pt[] = []
  for (let px = x; px <= x + w + 0.1; px += 4) crown.push([px, foot - 1 + (rand() - 0.5) * 3.2])
  const skirt: Pt[] = [...crown, [x + w, base], [x, base]]
  out.push(occlude(skirt), ...toneFill(skirt, 'T4', { angle: 82, gap: 2, weight: 'hair' }))
  out.push(stroke('line', crown), hline('hair', x, x + w, base - 0.5))
  return out
}
