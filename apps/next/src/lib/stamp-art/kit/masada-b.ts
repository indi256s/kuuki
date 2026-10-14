// Masada: a wide flat-topped plateau with sheer cliffs. The lit left face is paper with horizontal
// strata and a few fracture ticks, the shaded right face is T4 with irregular gullies, the snake
// path is a paper zigzag climbing it, and a few ruin blocks sit on the rim. Talus skirts the
// foot. The box bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, stroke, toneFill } from '../grid'
import { clipPoly, rockMass } from './rock-b'
import { type KitModule, num } from './util'

export const masadaB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 8)))
  const base = y + h
  const X = (u: number) => x + w * u
  const top = y + h * 0.04
  const out: SvgNode[] = []

  const ridge: Pt[] = [
    [X(-0.07), top + 3],
    [X(-0.05), top],
    [X(0.3), top - 0.6],
    [X(0.55), top + 0.4],
    [X(0.8), top - 0.3],
    [X(1.04), top + 1.2],
    [X(1.07), top + 4],
  ]
  const poly: Pt[] = [
    ...ridge,
    [X(1.04), top + h * 0.3],
    [X(1.0), base],
    [X(0), base],
    [X(-0.03), top + h * 0.3],
  ]
  out.push(
    ...rockMass(poly, rand, {
      ridge,
      shade: 1,
      fracture: 0,
      strata: true,
      strataGap: 3.2,
      cracks: 6,
    }),
  )
  // Shaded right face: T4 hatching leaning off the vertical, broken into stacked bands by paper
  // ledges so it reads as bedded rock, not a drape.
  const cut = (yy: number) => X(0.52) + 0.3 * (yy - (top + base) / 2)
  const dark = clipPoly(poly, ([px, py]) => px - cut(py))
  out.push(...toneFill(dark, 'T4', { angle: 76, gap: 2.4, weight: 'hair', inset: 0.2 }))
  for (const f of [0.24, 0.47, 0.7]) {
    const ly = top + (base - top) * f
    const ledge: Pt[] = [
      [cut(ly) - 1, ly - 0.7],
      [X(1.05), ly - 0.9],
      [X(1.05), ly + 0.9],
      [cut(ly) + 4 + rand() * 6, ly + 0.9],
    ]
    out.push(occlude(ledge, { halo: 0 }), stroke('fine', [ledge[3], ledge[2]]))
  }

  // Gullies: a few irregular, uneven weathering lines on the lit face only.
  for (const [u, len] of [
    [0.17, 18],
    [0.31, 28],
    [0.43, 12],
  ] as const) {
    const sx = X(u)
    const pts: Pt[] = []
    for (let k = 0; k <= 6; k++)
      pts.push([sx + Math.sin(k * 1.7 + u * 9) * 0.9, top + 4 + (len * k) / 6])
    out.push(stroke('fine', pts))
  }

  // Snake path: a paper zigzag ribbon climbing the shaded face.
  const path: Pt[] = [
    [X(0.93), base - 1],
    [X(0.76), base - h * 0.2],
    [X(0.9), base - h * 0.4],
    [X(0.72), base - h * 0.62],
    [X(0.6), top + 3],
  ]
  const edge = (s: number): Pt[] =>
    path.map(([px, py], i) => [px + s * (1.5 + (i / path.length) * 0.4), py])
  out.push(occlude([...edge(-1), ...edge(1).reverse()], { halo: 0.5 }))
  out.push(stroke('hair', edge(-1)), stroke('hair', edge(1)))

  // Ruins on the rim.
  for (const [u, bw, bh] of [
    [0.22, 8, 3.6],
    [0.38, 6, 5],
    [0.5, 10, 3],
    [0.6, 5, 4.2],
  ] as const) {
    const bx = X(u)
    const r: Pt[] = [
      [bx, top + 1],
      [bx, top - bh],
      [bx + bw, top - bh],
      [bx + bw, top + 1],
    ]
    out.push(occlude(r, { halo: 0.8 }), stroke('hair', r.slice(0, 4)))
  }

  // Talus skirts at both feet.
  const talus = (x0: number, x1: number, sign: 1 | -1): SvgNode[] => {
    const t: Pt[] = [
      [x0, base],
      [x0, base - 7],
      [x1, base],
    ]
    return [
      ...toneFill(t, 'T2', { angle: sign * -58, gap: 2.4, weight: 'fine', inset: 0.2 }),
      stroke('hair', [t[1], t[2]]),
    ]
  }
  out.push(...talus(X(-0.02), X(-0.08), -1), ...talus(X(1.02), X(1.08), 1))
  return out
}
