// Iceberg module: a tabular berg (flat top, near-vertical flanks, a ledge on the shaded side) or an
// arched berg (two buttresses and a natural arch). The box is the visible berg, its bottom the
// waterline. The lit left face is paper with sparse fine crevasse lines; everything right of `lit`
// (fraction of the width) is T4 vertical hatching; a broken hair waterline closes the base.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, hline, quad, stroke, toneFill, vline } from '../grid'
import { type KitModule, num, str } from './util'

export const iceberg: KitModule = ([x, y, w, h], p) => {
  const kind = str(p, 'kind', ['tabular', 'arch'] as const, 'tabular')
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const base = y + h
  const x1 = x + w
  const j = (v: number) => (rand() - 0.5) * v
  let outline: Pt[]
  if (kind === 'tabular') {
    outline = [
      [x - w * 0.03, base],
      [x + w * 0.02, y + h * 0.62],
      [x + w * 0.0, y + h * 0.4],
      [x + w * 0.05, y + h * 0.16],
      [x + w * 0.14, y + h * 0.1],
      [x + w * 0.24, y + h * 0.03],
      [x + w * 0.4, y + h * 0.0],
      [x + w * 0.52, y + h * 0.07],
      [x + w * 0.62, y + h * 0.02],
      [x + w * 0.78, y + h * 0.05],
      [x + w * 0.88, y + h * 0.18],
      [x + w * 0.96, y + h * 0.2],
      [x + w * 0.99, y + h * 0.52],
      [x1 + w * 0.02, base],
    ]
  } else {
    const aw = w * num(p, 'archW', 0.3)
    const ah = h * num(p, 'archH', 0.55)
    const ax = x + w * num(p, 'archX', 0.5)
    const hole = quad([ax + aw / 2, base], [ax + aw / 2, base - ah * 1.5], [ax, base - ah * 1.5], 8)
    const holeR = quad(
      [ax, base - ah * 1.5],
      [ax - aw / 2, base - ah * 1.5],
      [ax - aw / 2, base],
      8,
    )
    outline = [
      [x, base],
      [x + w * 0.04, y + h * 0.4],
      [x + w * 0.14, y + h * 0.12],
      [x + w * 0.3, y + h * 0.04],
      [x + w * 0.5, y],
      [x + w * 0.7, y + h * 0.08],
      [x + w * 0.88, y + h * 0.3],
      [x1, base],
      ...hole.slice(0, -1),
      ...holeR.slice(0, -1),
      [ax - aw / 2, base],
    ]
    outline = [
      [x, base],
      [x + w * 0.04, y + h * 0.4],
      [x + w * 0.14, y + h * 0.12],
      [x + w * 0.3, y + h * 0.04],
      [x + w * 0.5, y],
      [x + w * 0.7, y + h * 0.08],
      [x + w * 0.88, y + h * 0.3],
      [x1, base],
      [ax + aw / 2, base],
      ...quad(
        [ax + aw / 2, base],
        [ax + aw / 2, base - ah * 1.35],
        [ax, base - ah * 1.35],
        8,
      ).slice(1),
      ...quad(
        [ax, base - ah * 1.35],
        [ax - aw / 2, base - ah * 1.35],
        [ax - aw / 2, base],
        8,
      ).slice(1),
    ]
  }
  const out: SvgNode[] = body(outline, 'line')
  const split = x + w * num(p, 'lit', 0.5)
  for (const s of toneFill(outline, 'T4', { inset: 0.6 })) {
    if (s.kind === 'stroke' && s.pts[0][0] >= split) out.push(s)
  }
  // Crevasses on the lit side: short fine verticals of staggered length.
  for (let px = x + 4; px < split - 3; px += 6.5) {
    const len = h * (0.2 + rand() * 0.3)
    out.push(vline('fine', px + j(2), y + h * 0.1 + rand() * h * 0.2, y + h * 0.1 + len))
  }
  // Facet edge: a hair line down the berg where the lit and shaded faces meet.
  out.push(
    stroke('hair', [
      [split, y + h * 0.04],
      [split + w * 0.03, y + h * 0.5],
      [split, base],
    ]),
  )
  // Waterline: a broken hair line either side of the berg.
  out.push(
    hline('hair', x - 4, x + w * 0.2, base + 1.2),
    hline('hair', x + w * 0.35, x1 + 5, base + 1.2),
  )
  return out
}
