// Lion Mountain (Sierra Leone): a ridge shaped like a crouching lion, head and mane high on the
// left, a long back dipping then rising to the haunch on the right. Rising faces are lit with
// sparse diagonals (T2), the faces that look right are T4. Nothing is drawn under the ridge at the
// foot: the town module sits on the waterline. The box bottom is the ridge foot.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

function catmull(pts: Pt[], n = 8): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let k = 0; k < n; k++) {
      const t = k / n,
        t2 = t * t,
        t3 = t2 * t
      out.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

export const lionMountainB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 17)))
  const base = y + h
  const at = (u: number, v: number): Pt => [x + w * u, y + h * v]
  const key: Pt[] = [
    at(0.0, 0.78),
    at(0.012, 0.6),
    at(0.05, 0.56),
    at(0.075, 0.46),
    at(0.1, 0.3),
    at(0.145, 0.08),
    at(0.2, 0.0),
    at(0.255, 0.1),
    at(0.3, 0.34),
    at(0.38, 0.38),
    at(0.5, 0.28),
    at(0.64, 0.13),
    at(0.76, 0.06),
    at(0.86, 0.15),
    at(0.94, 0.4),
    at(1, 0.64),
  ]
  const ridge = catmull(key, 7).map(([px, py], i, a): Pt =>
    i === 0 || i === a.length - 1
      ? [px, py]
      : [px + (rand() - 0.5) * 0.7, py + (rand() - 0.5) * 0.9],
  )
  const poly: Pt[] = [...ridge, [x + w, base], [x, base]]
  const out: SvgNode[] = [occlude(poly, { halo: 1.6 })]
  // Lit rock: sparse diagonals closing towards the foot.
  out.push(
    ...toneFill(poly, 'T2', { angle: -58, gap: [5.6, 3.8], weight: 'fine', ramp: [y, base] }),
  )
  // Shaded faces: under the mane's back and under the haunch.
  const seg = (u0: number, u1: number): Pt[] =>
    ridge.filter(([px]) => px >= x + w * u0 && px <= x + w * u1)
  for (const [u0, u1, toe] of [
    [0.21, 0.32, 0.22],
    [0.77, 1, 0.8],
  ] as const) {
    const r = seg(u0, u1)
    const shade: Pt[] = [...r, [x + w * u1, base], [x + w * toe, base]]
    out.push(...toneFill(shade, 'T4', { angle: 72, gap: 2.6, weight: 'hair', inset: 0.2 }))
  }
  out.push(stroke('line', ridge))
  // Mane: a few short strokes at the head, reading as shaggy texture, not detail.
  for (let k = 0; k < 5; k++) {
    const u = 0.12 + k * 0.025
    const top = ridge.reduce(
      (m, q) => (Math.abs(q[0] - (x + w * u)) < Math.abs(m[0] - (x + w * u)) ? q : m),
      ridge[0],
    )
    out.push(
      stroke('fine', [
        [top[0] + 1, top[1] + 3],
        [top[0] + 3.2, top[1] + 8 + rand() * 4],
      ]),
    )
  }
  return out
}
