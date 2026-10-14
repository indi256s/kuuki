// Mount Paektu crater lake (Heaven Lake): a deep caldera seen from the rim. A jagged ring of
// peaks across the far side with their right faces hatched along the fall line, the lit left
// faces bare, a still lake of horizontal lines below, and two dark near-rim slopes framing the
// view at the bottom corners. The box bottom is the near rim.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

const PEAKS: Pt[] = [
  [0, 0.5],
  [0.07, 0.62],
  [0.14, 0.86],
  [0.22, 0.58],
  [0.31, 0.72],
  [0.4, 0.5],
  [0.5, 0.96],
  [0.6, 0.58],
  [0.7, 0.8],
  [0.79, 0.52],
  [0.88, 0.74],
  [0.95, 0.56],
  [1, 0.5],
]

export const paektu: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 7)))
  const lakeY = y + h * 0.74
  const lakeRx = w * 0.42
  const lakeRy = h * 0.11
  const cx = x + w / 2
  const rise = (lakeY - y - 4) * 0.98
  const out: SvgNode[] = []
  // Far rim.
  const ridge: Pt[] = []
  for (let i = 0; i + 1 < PEAKS.length; i++) {
    const [ax, ay] = PEAKS[i]
    const [bx, by] = PEAKS[i + 1]
    for (let k = 0; k < 4; k++) {
      const t = k / 4
      const jag = (rand() - 0.5) * 2.2 * Math.sin(Math.PI * t)
      ridge.push([x + w * (ax + (bx - ax) * t), lakeY - rise * (ay + (by - ay) * t) + jag])
    }
  }
  ridge.push([x + w, lakeY - rise * 0.5])
  const rim: Pt[] = [...ridge, [x + w, lakeY + 2], [x, lakeY + 2]]
  out.push(...body(rim, 'line').slice(0, 1))
  out.push(stroke('line', ridge))
  // Shaded right face under each peak, down to the next valley.
  const peakIdx = PEAKS.map((q, i) => ({ q, i })).filter(
    ({ q, i }) => i > 0 && i < PEAKS.length - 1 && q[1] > PEAKS[i - 1][1] && q[1] > PEAKS[i + 1][1],
  )
  for (const { i } of peakIdx) {
    const px = x + w * PEAKS[i][0]
    const vx = x + w * PEAKS[i + 1][0]
    const slope = ridge.filter((q) => q[0] >= px - 0.1 && q[0] <= vx + 0.1)
    const sh: Pt[] = [...slope, [vx, lakeY - lakeRy * 0.4], [px, lakeY - lakeRy * 0.4]]
    out.push(...toneFill(sh, 'T4', { inset: 0.6, gap: [2.5, 2.5] }))
    // Lit-face gullies on the left.
    const lx = x + w * PEAKS[i - 1][0]
    for (let k = 1; k < 3; k++) {
      const gx = px - (px - lx) * (0.18 + k * 0.2)
      const gy =
        lakeY - rise * (PEAKS[i][1] - (PEAKS[i][1] - PEAKS[i - 1][1]) * (0.18 + k * 0.2)) + 3
      out.push(
        stroke('fine', [
          [gx, gy],
          [gx - 1.5, gy + (lakeY - gy) * 0.55],
        ]),
      )
    }
  }
  // Lake.
  const lake: Pt[] = Array.from({ length: 32 }, (_, i): Pt => {
    const a = (i / 32) * Math.PI * 2
    return [cx + Math.cos(a) * lakeRx, lakeY + lakeRy * 0.6 + Math.sin(a) * lakeRy]
  })
  out.push(
    occlude(lake),
    stroke('hair', lake, true),
    ...toneFill(lake, 'T3', { inset: 1, gap: [2.2, 2.2] }),
  )
  // Near rim slopes, dark, at both bottom corners.
  const base = y + h
  const slope = (side: -1 | 1, reach: number, top: number): Pt[] => {
    const x0 = side < 0 ? x : x + w
    const pts: Pt[] = [
      [x0, base],
      [x0, base - h * top],
    ]
    for (let i = 1; i <= 8; i++) {
      const t = i / 8
      pts.push([x0 - side * reach * t, base - h * top * (1 - t) ** 1.6 + (rand() - 0.5) * 1.2])
    }
    return pts
  }
  for (const [side, reach, top] of [
    [-1, w * 0.36, 0.2],
    [1, w * 0.3, 0.15],
  ] as const) {
    const pts = slope(side, reach, top)
    pts[pts.length - 1] = [pts[pts.length - 1][0], base]
    out.push(...body(pts, 'line'))
    out.push(...toneFill(pts, 'T4', { inset: 0.8, gap: [2.3, 2.3] }))
  }
  return out
}
