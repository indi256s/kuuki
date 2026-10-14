// Chateau hotel on a cliff (Chateau Frontenac type). The box is chateau plus cliff; the cliff takes
// the bottom `cliff` fraction. Lit walls under solid steep roofs: a tall central tower with a
// pyramid roof, hip-roofed wings left and right, conical corner turrets and small lit dormers.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num } from './util'

type Bay = { a: number; b: number; wall: number; roof: number; kind: 'hip' | 'pyr' | 'cone' }

export const chateau: KitModule = ([x, y, w, h], p) => {
  const cliffH = h * num(p, 'cliff', 0.2)
  const base = y + h - cliffH
  const bh = base - y
  const out: SvgNode[] = []
  // Cliff: a rock face under the building, ledges at the corners, vertical strata.
  const cliff: Pt[] = [
    [x, y + h],
    [x + w * 0.02, base + cliffH * 0.35],
    [x + w * 0.06, base + 1],
    [x + w * 0.94, base + 1],
    [x + w * 0.98, base + cliffH * 0.3],
    [x + w, y + h],
  ]
  out.push(
    occlude(cliff),
    stroke('line', cliff.slice(1, -1)),
    hline('bold', x + w * 0.04, x + w * 0.96, base),
  )
  for (let px = x + 3; px < x + w - 2; px += 4.6) {
    const t = (px - x) / w
    const top = base + 2 + (Math.sin(px * 1.7) + 1) * 1.2
    const len = (y + h - top) * (0.45 + 0.55 * ((Math.sin(px * 3.1) + 1) / 2))
    out.push(
      stroke('fine', [
        [px, top],
        [px + (t - 0.5) * 0.8, Math.min(y + h - 1, top + len)],
      ]),
    )
  }
  const bays: Bay[] = [
    { a: 0, b: 0.2, wall: 0.3, roof: 0.28, kind: 'hip' },
    { a: 0.2, b: 0.4, wall: 0.4, roof: 0.3, kind: 'hip' },
    { a: 0.4, b: 0.6, wall: 0.58, roof: 0.4, kind: 'pyr' },
    { a: 0.6, b: 0.8, wall: 0.4, roof: 0.3, kind: 'hip' },
    { a: 0.8, b: 1, wall: 0.3, roof: 0.28, kind: 'hip' },
    { a: 0.36, b: 0.43, wall: 0.5, roof: 0.34, kind: 'cone' },
    { a: 0.57, b: 0.64, wall: 0.5, roof: 0.34, kind: 'cone' },
    { a: 0.94, b: 1, wall: 0.38, roof: 0.3, kind: 'cone' },
    { a: 0, b: 0.06, wall: 0.38, roof: 0.3, kind: 'cone' },
  ]
  const order = [0, 4, 1, 3, 2, 5, 6, 7, 8]
  for (const i of order) {
    const { a, b, wall, roof, kind } = bays[i]
    const x0 = x + w * a + (kind === 'cone' ? 0 : 0.3)
    const x1 = x + w * b - (kind === 'cone' ? 0 : 0.3)
    const wallTop = base - bh * wall
    const roofTop = wallTop - bh * roof
    const mid = (x0 + x1) / 2
    out.push(...body(rectPts(x0, wallTop, x1 - x0, base - wallTop), 'hair'))
    const lit = kind === 'cone' ? 0.68 : 0.82
    out.push(
      ...toneFill(
        rectPts(x0 + (x1 - x0) * lit, wallTop, (x1 - x0) * (1 - lit), base - wallTop),
        'T4',
        { gap: 1.8, inset: 0.3 },
      ),
    )
    // Window rows.
    const rows = kind === 'pyr' ? 3 : 1
    const cols = Math.max(1, Math.round((x1 - x0) / 5))
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x0 + ((c + 0.5) * (x1 - x0) * lit) / cols - 0.7
        out.push(fill(rectPts(wx, wallTop + 2.2 + r * ((base - wallTop - 5) / rows), 1.4, 2.2)))
      }
    }
    const eave = 1.4
    const poly: Pt[] =
      kind === 'hip'
        ? [
            [x0 - eave, wallTop],
            [x0 + (x1 - x0) * 0.14, roofTop],
            [x1 - (x1 - x0) * 0.14, roofTop],
            [x1 + eave, wallTop],
          ]
        : [
            [x0 - eave, wallTop],
            [mid, roofTop],
            [x1 + eave, wallTop],
          ]
    out.push(
      occlude(poly),
      ...toneFill(poly, 'T4', { gap: num(p, 'roofGap', 2.4), inset: 0.3 }),
      stroke('line', poly, true),
    )
    if (kind === 'hip' && x1 - x0 > 10) {
      // Two lit dormers on the roof.
      for (const f of [0.28, 0.66]) {
        const dx = x0 + (x1 - x0) * f
        const dy = roofTop + (wallTop - roofTop) * 0.45
        const dorm: Pt[] = [
          [dx - 1.8, dy + 4],
          [dx - 1.8, dy + 1.4],
          [dx, dy - 0.6],
          [dx + 1.8, dy + 1.4],
          [dx + 1.8, dy + 4],
        ]
        out.push(...body(dorm, 'hair'))
      }
    }
    if (kind === 'pyr')
      out.push(
        stroke('hair', [
          [mid, roofTop],
          [mid, roofTop - 3],
        ]),
      )
  }
  return out
}
