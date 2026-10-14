// Khor Al Adaid: a tall sand dune with a knife crest sliding into a flat sea inlet. The windward
// face is bare paper with a few wind ripples; the lee face right of the curved arris is hatched
// along the fall line. A low companion dune stands to the right and a far shore bar behind. The box
// is the scene; the dunes meet the water on its bottom edge (the horizon).
import { type Pt, type SvgNode, body, hatchPoly, occlude, stroke, toneFill } from '../grid'
import { type KitModule, xAtY } from './util'

export const inlandSeaB: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const at = ([t, s]: [number, number]): Pt => [x + w * t, y + h * s]
  const out: SvgNode[] = []
  // Far shore: a low bar in T2 across the whole width.
  const bar: Pt[] = [at([0.1, 1])]
  for (let t = 0.1; t <= 0.8801; t += 0.04) {
    bar.push(at([t, 0.74 + 0.05 * Math.sin(t * 11 + 2) + 0.015 * Math.sin(t * 23)]))
  }
  bar.push(at([0.88, 1]))
  out.push(occlude(bar), ...toneFill(bar, 'T2', { gap: 2.4, weight: 'fine', inset: 0.4 }))
  out.push(stroke('hair', bar.slice(1, -1)))
  // The big dune: smooth windward curve, rounded crest, lee slope sliding into the water.
  const smooth = (q: [number, number][]): Pt[] => {
    const P = q.map(at)
    const o: Pt[] = []
    for (let i = 0; i + 1 < P.length; i++) {
      const p0 = P[Math.max(0, i - 1)],
        p1 = P[i],
        p2 = P[i + 1],
        p3 = P[Math.min(P.length - 1, i + 2)]
      for (let k = 0; k < 6; k++) {
        const t = k / 6
        const f = (a: number, b: number, c: number, d: number) =>
          0.5 *
          (2 * b +
            (-a + c) * t +
            (2 * a - 5 * b + 4 * c - d) * t * t +
            (-a + 3 * b - 3 * c + d) * t * t * t)
        o.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
      }
    }
    o.push(P[P.length - 1])
    return o
  }
  const crest = smooth([
    [0.1, 1],
    [0.14, 0.9],
    [0.22, 0.7],
    [0.3, 0.48],
    [0.4, 0.33],
    [0.49, 0.29],
    [0.56, 0.35],
    [0.63, 0.5],
    [0.71, 0.68],
    [0.8, 0.84],
    [0.84, 0.95],
    [0.88, 1],
  ])
  const arris = smooth([
    [0.49, 0.29],
    [0.5, 0.5],
    [0.55, 0.74],
    [0.64, 0.92],
    [0.73, 1],
  ])
  out.push(...body(crest, 'line'))
  const shade: Pt[] = [
    ...crest.filter((q) => q[0] >= arris[0][0] - 0.01),
    ...arris.slice().reverse().slice(0, -1),
  ]
  out.push(...hatchPoly(shade, { angle: 62, gap: 2.2, weight: 'hair', inset: 0.5 }))
  out.push(stroke('hair', arris))
  const wSorted = crest.filter((q) => q[0] <= arris[0][0]).sort((m, n) => m[1] - n[1])
  const aSorted = arris.slice().sort((m, n) => m[1] - n[1])
  // Wind ripples on the windward face.
  for (const s of [0.42, 0.52, 0.62, 0.72, 0.82, 0.91]) {
    const yy = y + h * s
    const xa = xAtY(wSorted, yy) + 3,
      xb = xAtY(aSorted, yy) - 3
    const pts: Pt[] = []
    for (let k = 0; k <= 8; k++) {
      const t = k / 8
      pts.push([xa + (xb - xa) * t, yy + Math.sin(t * Math.PI * 2 + s * 9) * 0.9])
    }
    out.push(stroke('fine', pts))
  }
  out.push(
    stroke('bold', [
      [x + w * 0.105, base],
      [x + w * 0.88, base],
    ]),
  )
  return out
}
