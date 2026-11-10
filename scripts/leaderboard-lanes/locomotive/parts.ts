// Drawing helpers for the locomotive: the item makers of the airliner pipeline bound to a camera, plus the shapes a
// rail vehicle is made of (boxes, prisms of a side profile, rods, lathed bodies, plates on the near flank).
import { ringsOfPath, type Draw } from '../airliner/draw'
import type { Ink, Item, Mat } from '../airliner/model'
import { len, sub, unit, type Pt, type V3 } from '../airliner/surface'
import { HW, LENGTH, at } from './model'

export const loop = (p: Pt[]) => [...p, p[0]]
export const sample = (n: number, f: (t: number) => V3) =>
  Array.from({ length: n + 1 }, (_, i) => f(i / n))
/** An ellipse as a loop of (a, z) points. */
export const ellipse = (a: number, b: number, ra: number, rb: number, n = 24): Pt[] =>
  Array.from({ length: n }, (_, i) => [
    a + ra * Math.cos((i * 2 * Math.PI) / n),
    b + rb * Math.sin((i * 2 * Math.PI) / n),
  ])
export const rect = (a0: number, a1: number, z0: number, z1: number): Pt[] => [
  [a0, z0],
  [a1, z0],
  [a1, z1],
  [a0, z1],
]
/** A rounded rectangle, each corner cut by r in n steps. */
export const rrect = (a0: number, a1: number, z0: number, z1: number, r: number, n = 4): Pt[] => {
  const out: Pt[] = []
  const c: [number, number, number][] = [
    [a1 - r, z1 - r, 0],
    [a0 + r, z1 - r, 90],
    [a0 + r, z0 + r, 180],
    [a1 - r, z0 + r, 270],
  ]
  for (const [x, z, t0] of c)
    for (let i = 0; i <= n; i++) {
      const t = ((t0 + (90 * i) / n) * Math.PI) / 180
      out.push([x + r * Math.cos(t), z + r * Math.sin(t)])
    }
  return out
}
export const shrink = (pts: Pt[], k: number): Pt[] => {
  const cx = pts.reduce((n, p) => n + p[0] / pts.length, 0)
  const cz = pts.reduce((n, p) => n + p[1] / pts.length, 0)
  return pts.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k])
}

export function makeCtx(d: Draw) {
  const { cam, solid, kitSolid, G, P } = d
  const out: Item[] = []
  const fill = (points: V3[], mat: Mat | 'shadow', edge?: Ink, width = 0.22) =>
    out.push({ kind: 'fill', rings: [points.map(cam.project)], mat, edge, width })
  const line = (points: V3[], ink: Ink = 'seam', width = 0.22, closed = false) => {
    const p = points.map(cam.project)
    out.push({ kind: 'lines', lines: { runs: [closed ? loop(p) : p], ink, width } })
  }
  /** A polygon in (a, z) on the near flank plane, `off` m proud of it. */
  const flank = (pts: Pt[], mat: Mat, edge: Ink | undefined = 'seam', width = 0.2, off = 0.004) =>
    fill(
      pts.map(([a, z]) => at(a, HW + off, z)),
      mat,
      edge,
      width,
    )
  const flankLine = (pts: Pt[], ink: Ink = 'seam', width = 0.2, closed = false, off = 0.004) =>
    line(
      pts.map(([a, z]) => at(a, HW + off, z)),
      ink,
      width,
      closed,
    )
  /** A prism of an (a, z) side profile between y0 and y1. */
  const prismY = (pts: Pt[], y0: number, y1: number, mat: Mat, edge = 0.3) => {
    const F = { o: [0, y1, 0] as V3, a: [0, -1, 0] as V3, u: [1, 0, 0] as V3, v: [0, 0, 1] as V3 }
    out.push(
      kitSolid(
        G.prismOf(
          F,
          pts.map(([a, z]) => [a - LENGTH, z]),
          0,
          y1 - y0,
          P,
        ),
        mat,
        [],
        edge,
      ),
    )
  }
  /** A prism of an (a, y) plan between z0 and z1. */
  const prismZ = (pts: Pt[], z0: number, z1: number, mat: Mat, edge = 0.3) => {
    const F = { o: [0, 0, z0] as V3, a: [0, 0, 1] as V3, u: [1, 0, 0] as V3, v: [0, 1, 0] as V3 }
    out.push(
      kitSolid(
        G.prismOf(
          F,
          pts.map(([a, y]) => [a - LENGTH, y]),
          0,
          z1 - z0,
          P,
        ),
        mat,
        [],
        edge,
      ),
    )
  }
  const box = (
    a0: number,
    a1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    mat: Mat,
    edge = 0.3,
  ) =>
    prismZ(
      [
        [a0, y0],
        [a1, y0],
        [a1, y1],
        [a0, y1],
      ],
      z0,
      z1,
      mat,
      edge,
    )
  /** A cylinder along the line p to q. */
  const rod = (p: V3, q: V3, r: number, mat: Mat = 'metal', edge = 0.2) => {
    const F = G.frameAlong(p, unit(sub(q, p)))
    out.push(kitSolid(G.disc(0, len(sub(q, p)), r, F, P, { steps: 14 }), mat, [], edge))
  }
  /** A body of revolution about the axis p → q: profile [s, r] along it, s from 0. */
  const lathe = (
    p: V3,
    q: V3,
    profile: [number, number, number?][],
    mat: Mat,
    edge = 0.2,
    steps = 20,
  ) => {
    const F = G.frameAlong(p, unit(sub(q, p)))
    out.push(kitSolid(G.solidOf(profile, F, P, { steps }), mat, [], edge))
    return F
  }
  /** A flat closed ring of a frame as a fill (a lens, a bore, a lamp face). */
  const ring = (F: unknown, s: number, r: number, mat: Mat, edge: Ink = 'seam', width = 0.14) =>
    out.push({ kind: 'fill', rings: ringsOfPath(G.circleOf(F, s, r, P)), mat, edge, width })
  const circle = (F: unknown, s: number, r: number, ink: Ink = 'faint', width = 0.14) =>
    out.push({ kind: 'lines', lines: { runs: ringsOfPath(G.circleOf(F, s, r, P)), ink, width } })
  return {
    d,
    out,
    cam,
    solid,
    kitSolid,
    G,
    P,
    fill,
    line,
    flank,
    flankLine,
    prismY,
    prismZ,
    box,
    rod,
    lathe,
    ring,
    circle,
  }
}
export type Ctx = ReturnType<typeof makeCtx>
