// Murchison-type falls: the whole river squeezed through a narrow rock cleft, dropping as a single
// white plume into a boiling pool. Two close walls, the left lit with ledge lines, the right
// shaded in vertical hatching. The box bottom is the pool surface.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const cleftFallsB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const base = y + h
  const cx = x + w * num(p, 'axis', 0.5)
  const poolH = h * 0.14
  const lip = y + h * 0.16
  const fallEnd = base - poolH
  const topHalf = num(p, 'topHalf', 6)
  const footHalf = num(p, 'footHalf', 16)
  const edge = (side: number): Pt[] =>
    Array.from({ length: 9 }, (_, i) => {
      const t = i / 8
      return [
        cx + side * (topHalf + (footHalf - topHalf) * t ** 1.4) + (rand() - 0.5) * 0.8,
        lip + (fallEnd - lip) * t,
      ]
    })
  const le = edge(-1),
    re = edge(1)
  const roof = (x0: number, x1: number, dir: number): Pt[] => {
    const pts: Pt[] = []
    for (let px = x0; dir > 0 ? px <= x1 : px >= x1; px += dir * 5)
      pts.push([px, lip - 4 - rand() * 5 + Math.abs(px - cx) * num(p, 'slope', 0.17)])
    return pts
  }
  const lw: Pt[] = [...roof(x, le[0][0] - 2, 1), le[0], ...le, [le[8][0], base], [x, base]]
  const rw: Pt[] = [
    re[0],
    ...roof(re[0][0] + 2, x + w, 1),
    [x + w, base],
    [re[8][0], base],
    ...re.slice().reverse(),
  ]
  const out: SvgNode[] = [occlude([...lw]), occlude([...rw])]
  // Cleft interior: paper with the plume's own streaks and a shaded left lip.
  out.push(occlude([...le, ...re.slice().reverse()]))
  for (let k = 0; k < 5; k++) {
    const f = -0.55 + k * 0.28
    const a = lip + 3 + rand() * 10
    const t0 = (a - lip) / (fallEnd - lip)
    const half0 = topHalf + (footHalf - topHalf) * t0 ** 1.4
    out.push(
      stroke('fine', [
        [cx + f * half0, a],
        [cx + f * footHalf * 0.9, fallEnd - rand() * 10],
      ]),
    )
  }
  out.push(...toneFill(lw, 'T3', { angle: 66, gap: 3, weight: 'fine', inset: 1 }))
  // Lit left wall: ledge lines; shaded right wall: vertical hair hatching.
  for (let ly = lip + 6; ly < base - 3; ly += 6 + rand() * 4) {
    const xe = le[Math.min(8, Math.round(((ly - lip) / (fallEnd - lip)) * 8))][0]
    out.push(
      stroke('fine', [
        [xe - 8 - rand() * 18, ly],
        [xe - 1.2, ly + rand() * 1.4],
      ]),
    )
  }
  out.push(
    ...toneFill([...rw.slice(1, rw.length - 2)], 'T4', {
      angle: 112,
      gap: 2.6,
      weight: 'fine',
      inset: 0.6,
    }),
  )
  // Mist banks drifting over the lower walls: scalloped paper blobs outlined with hair strokes.
  const mist = (mx: number, my: number, r: number): void => {
    const blob: Pt[] = Array.from({ length: 17 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2
      const rr = r * (i % 2 ? 0.8 : 1)
      return [mx + Math.cos(a) * rr * 1.8, my + Math.sin(a) * rr * 0.7]
    })
    out.push(occlude(blob, { halo: 0.8 }), stroke('fine', blob))
  }
  mist(cx - footHalf - 18, fallEnd - 14, 10)
  mist(cx + footHalf + 18, fallEnd - 22, 10)
  mist(cx - footHalf - 30, fallEnd - 38, 8)
  mist(cx + footHalf + 28, fallEnd - 44, 8)
  mist(cx - footHalf - 14, fallEnd - 54, 6)
  out.push(
    stroke('line', [...roof(x, le[0][0] - 2, 1), ...le]),
    stroke('line', [...re, ...roof(re[0][0] + 2, x + w, 1)].reverse().reverse()),
  )
  // Spray at the foot and the pool.
  const spray: Pt[] = []
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI * (i / 14)
    const r = footHalf * 1.7 * (i % 2 ? 0.85 : 1)
    spray.push([
      cx - Math.cos(a) * r,
      fallEnd + 1 - Math.sin(a) * (footHalf * 0.9) * (i % 2 ? 0.8 : 1),
    ])
  }
  out.push(occlude(spray), stroke('hair', spray))
  for (let ry = fallEnd + 5; ry < base - 1; ry += 3.2) out.push(hline('hair', x + 2, x + w - 2, ry))
  return out
}
