// Mount Mulanje: a massif of domed granite summits over sheer walls broken by horizontal
// fracture ledges (T4 on the shaded side only), forested lower slopes in a hatched canopy band,
// and curved tea rows on a foreground mound. The box bottom is the horizon.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, quad, stroke, toneFill } from '../grid'
import { canopyNodes } from './mass-b'
import { rockMass } from './rock-b'
import { type KitModule, num } from './util'

export const mulanjeB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 12)))
  const base = y + h
  const X = (u: number) => x + w * u
  const Y = (v: number) => y + h * v
  const out: SvgNode[] = []

  // Top line: three domes with saddles, then sheer sides.
  const d1 = quad([X(0), Y(0.58)], [X(0.1), Y(0.14)], [X(0.28), Y(0.46)], 10)
  const d2 = quad([X(0.3), Y(0.5)], [X(0.52), Y(-0.36)], [X(0.76), Y(0.32)], 14)
  const d3 = quad([X(0.78), Y(0.34)], [X(0.88), Y(0.02)], [X(1), Y(0.36)], 10)
  const top: Pt[] = [...d1, ...d2, ...d3]
  const poly: Pt[] = [...top, [X(1), base], [X(0), base]]
  out.push(
    ...rockMass(poly, rand, {
      ridge: top,
      shade: 1,
      fracture: 5.4,
      angle: -58,
      strata: false,
      cracks: 10,
    }),
  )
  // Shaded sides: T4 under the right slope of each dome, leaning off the vertical, then broken by
  // paper fracture ledges so the wall reads as bedded rock rather than a drape.
  const wallBase = Y(0.8)
  const apex = (pts: Pt[]) => pts.reduce((m, q) => (q[1] < m[1] ? q : m), pts[0])
  for (const dome of [d1, d2, d3]) {
    const A = apex(dome)
    const right = dome.filter((q) => q[0] >= A[0])
    const lastR = right[right.length - 1]
    const shade: Pt[] = [
      [A[0] + 1.5, A[1] + 1],
      ...right.slice(1),
      [lastR[0], wallBase],
      [A[0] + 7 + (lastR[0] - A[0]) * 0.1, wallBase],
    ]
    out.push(...toneFill(shade, 'T4', { angle: 74, gap: 2.5, weight: 'hair', inset: 0.2 }))
    for (const f of [0.36, 0.55, 0.73]) {
      const ly = A[1] + (wallBase - A[1]) * f
      const x0 = A[0] + 4 + (ly - A[1]) * 0.12
      const x1 = lastR[0] + 0.5
      if (x1 - x0 < 6) continue
      out.push(
        occlude(
          [
            [x0, ly - 0.7],
            [x1, ly - 0.9],
            [x1, ly + 0.9],
            [x0 + rand() * 6, ly + 0.9],
          ],
          { halo: 0 },
        ),
        stroke('fine', [
          [x0 + 5 + rand() * 4, ly + 0.9],
          [x1, ly + 0.9],
        ]),
      )
    }
  }

  // Forested lower slopes.
  out.push(
    ...canopyNodes(x, x + w, base + 1, h * 0.2, rand, { crowns: Math.round(w / 11), thr: 0.08 }),
  )

  // Tea mound: curved rows follow the crest, spaced wider near the crest and closing downwards.
  const crest: Pt[] = quad([X(0), Y(1.0)], [X(0.28), Y(0.78)], [X(0.62), Y(1.02)], 16)
  const rows = 6
  const lowY = base + h * 0.16
  const mound: Pt[] = [...crest, [X(0.62), lowY], [X(0), lowY]]
  out.push(occlude(mound, { halo: 1.6 }))
  for (let r = 0; r < rows; r++) {
    const off = 0.8 + r * 3.1
    const row = crest.map(([px, py]) => [px, Math.min(lowY - 0.5, py + off)] as Pt)
    // Rows stop where the mound ends; trim with a gentle taper.
    out.push(stroke(r === 0 ? 'line' : 'hair', row))
  }
  return out
}
