// A hillside stepped into dry-stone terrace rows. Each row is a curved wall following the contour,
// the slope above it in fine diagonal hatching (T2) and the wall face in short vertical ticks. The
// hill rises on the left and falls off to the right; the box bottom is the horizon.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const hillTerracesB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const base = num(p, 'horizonY', y + h * 0.74)
  const rows = Math.max(3, Math.round(num(p, 'rows', 6)))
  const out: SvgNode[] = []
  const crestAt = (t: number) => {
    const top = y + h * 0.3
    const left = y + h * 0.5
    const k = Math.exp(-Math.pow((t - 0.08) / 0.55, 2))
    return base - (base - top) * k * 0.95 - (t < 0.1 ? 0 : 0) + (left - left)
  }
  const hill: Pt[] = [[x, base]]
  for (let t = 0; t <= 1.001; t += 0.04) hill.push([x + w * t, crestAt(t)])
  hill.push([x + w, base])
  out.push(occlude(hill, { halo: 1.5 }))
  out.push(...toneFill(hill, 'T2', { gap: 3, weight: 'fine', inset: 0.4 }))
  out.push(stroke('hair', hill.slice(1, -1)))
  // Terrace walls: contour lines at fixed depth below the crest, each with ticks beneath.
  for (let r = 1; r <= rows; r++) {
    const depth = ((base - y - h * 0.3) * r) / (rows + 0.6)
    const line: Pt[] = []
    for (let t = 0; t <= 1.001; t += 0.04) {
      const yy = Math.min(
        base - 2,
        crestAt(t) +
          depth * (0.5 + 0.5 * Math.min(1, (base - crestAt(t)) / (base - y - h * 0.3 + 1))),
      )
      line.push([x + w * t, yy])
    }
    out.push(stroke('line', line))
    for (let i = 1; i < line.length - 1; i++) {
      if (line[i][1] > base - 3 || rand() < 0.45) continue
      out.push(hline('fine', line[i][0] - 0.01, line[i][0] + 0.01, line[i][1]))
      out.push(
        stroke('fine', [
          [line[i][0], line[i][1]],
          [line[i][0], line[i][1] + 1.8],
        ]),
      )
    }
  }
  return out
}
