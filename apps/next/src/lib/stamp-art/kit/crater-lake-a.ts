// Dominica: the Boiling Lake. A wide lit lake in a forested valley under a ridge, with billowing
// steam columns rising from the water. The box is the whole view; its bottom is the near shore.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

const circle = (cx: number, cy: number, r: number): Pt[] =>
  Array.from({ length: 16 }, (_, i): Pt => {
    const a = (i / 16) * Math.PI * 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9]
  })

export const craterLakeA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const cx = x + w / 2
  const lakeY = y + h * 0.72
  const out: SvgNode[] = []
  // Ridge behind: lighter diagonal hatching.
  const ridge: Pt[] = [[x, lakeY]]
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const bowl = 0.35 + 0.65 * Math.sin(Math.PI * t) ** 0.6
    ridge.push([x + w * t, lakeY - h * 0.1 - h * 0.24 * bowl + (rand() - 0.5) * 3])
  }
  ridge.push([x + w, lakeY])
  out.push(occlude(ridge), ...body(ridge, 'hair'), ...toneFill(ridge, 'T2', { inset: 1 }))
  // Lake.
  const lake: Pt[] = Array.from({ length: 28 }, (_, i): Pt => {
    const a = (i / 28) * Math.PI * 2
    return [cx + Math.cos(a) * w * 0.44, lakeY + h * 0.02 + Math.sin(a) * h * 0.085]
  })
  out.push(occlude(lake), ...body(lake, 'hair'))
  for (const dy of [-0.03, 0.01, 0.045]) {
    const hw = w * 0.38 * (1 - Math.abs(dy) * 4)
    out.push(hline('fine', cx - hw, cx + hw, lakeY + h * 0.02 + dy * h))
  }
  // Steam: stacked billows widening upwards.
  for (const [fx, n, r0] of [
    [-0.14, 4, 5.4],
    [0.06, 5, 6.2],
    [0.24, 3, 4.6],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const r = r0 + i * 1.7
      const px = cx + w * fx + (i % 2 ? 3 : -3) * (1 + i * 0.3)
      const py = lakeY - h * 0.02 - i * r0 * 1.5
      const c = circle(px, py, r)
      out.push(occlude(c), stroke('hair', c, true))
    }
  }
  // Near forest band along the shore.
  const band: Pt[] = [[x, y + h]]
  for (let i = 0; i <= 30; i++) {
    const t = i / 30
    band.push([x + w * t, y + h * 0.9 + (rand() - 0.5) * 4 - Math.sin(t * 3) * 2])
  }
  band.push([x + w, y + h])
  out.push(
    occlude(band),
    ...body(band, 'hair'),
    ...toneFill(band, 'T4', { inset: 1, gap: [2.4, 2.4] }),
  )
  return out
}
