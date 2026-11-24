import { clamp, D2R, stations } from './airframe'
import type { Ink, Item, Lines, Mat } from './model'
import type { Kit } from './kit'
import {
  curveOn,
  dot,
  drawSurface,
  normalAt,
  sub,
  type Camera,
  type Pt,
  type Rings,
  type Surface,
  type V3,
} from './surface'

const naca = (c: number, t: number) =>
  5 *
  t *
  (0.2969 * Math.sqrt(Math.max(0, c)) -
    0.126 * c -
    0.3516 * c * c +
    0.2843 * c * c * c -
    0.1036 * c * c * c * c)

const chordOf = (v: number) => ({ c: (1 + Math.cos(2 * Math.PI * v)) / 2, upper: v <= 0.5 })
export const vChord = (c: number) => Math.acos(2 * c - 1) / (2 * Math.PI)

export const oriented = (s: Surface, u: number, inward = false): Surface => {
  const n = normalAt({ ...s, flip: false }, u, 0.25)
  const across = sub(s.at(u, 0.25), s.at(u, 0.75))
  return { ...s, flip: dot(n, across) < 0 !== inward }
}

export const dihedralUp = (sg: number, t: number): [number, number] => {
  const norm = Math.hypot(1, t)
  return [(-sg * t) / norm, 1 / norm]
}
export const closed = (rings: Rings): Rings => rings.map((r) => [...r, r[0]])

export type Foil = {
  path: (t: number) => [number, number]
  le: (t: number) => number
  te: (t: number) => number
  tau: (t: number) => number
  up: (t: number) => [number, number]
  root?: (xg: number, y: number, z: number) => [number, number]
  rows: number
  at?: number[]
  camber?: number
}
export const foilAt =
  (f: Foil) =>
  (t: number, v: number): V3 => {
    const { c, upper } = chordOf(v)
    const [py, pz] = f.path(t)
    const le = f.le(t),
      te = f.te(t)
    const chord = te - le
    const tk = naca(c, f.tau(t)) * chord
    const camber = (f.camber ?? 0) * chord * 4 * c * (1 - c)
    const [uy, uz] = f.up(t)
    const off = (upper ? tk : -tk) + camber
    let y = py + uy * off,
      z = pz + uz * off
    const xg = le + c * chord
    if (f.root) {
      const [ry, rz] = f.root(xg, y, z)
      const k = Math.pow(1 - clamp(t / 0.25), 3)
      y += (ry - y) * k
      z += (rz - z) * k
    }
    return [-xg, y, z]
  }
export const foil = (f: Foil): Surface =>
  oriented({ at: foilAt(f), u: stations(f.rows, f.at ?? []), v: 72, closed: true }, 0.5)

export const revolve = (
  ax: { x: number; y: number; z: number },
  meridian: (m: number) => [number, number],
  rows: number,
  flat = 1,
): Surface => ({
  at: (m, v) => {
    const [s, r] = meridian(m)
    const th = v * 2 * Math.PI
    const c = Math.cos(th)
    const rz = c < 0 ? r * flat : r
    return [ax.x - s, ax.y + r * Math.sin(th), ax.z + rz * c]
  },
  u: stations(rows),
  v: 64,
  closed: true,
})

const curveUV = (n: number, f: (t: number) => [number, number]) =>
  Array.from({ length: n + 1 }, (_, i) => f(i / n))

export const roundedUV = (
  cu: number,
  cv: number,
  hu: number,
  hv: number,
  r = 0.35,
  n = 4,
): [number, number][] => {
  const out: [number, number][] = []
  const ru = hu * r,
    rv = hv * r
  const corners: [number, number, number][] = [
    [cu + hu - ru, cv + hv - rv, 0],
    [cu - hu + ru, cv + hv - rv, 90],
    [cu - hu + ru, cv - hv + rv, 180],
    [cu + hu - ru, cv - hv + rv, 270],
  ]
  for (const [x, y, a0] of corners)
    for (let i = 0; i <= n; i++) {
      const a = (a0 + (90 * i) / n) * D2R
      out.push([x + ru * Math.cos(a), y + rv * Math.sin(a)])
    }
  return out
}

export function ringsOfPath(d: string): Rings {
  if (!d) return []
  const out: Rings = []
  for (const run of d.split('M').filter(Boolean)) {
    const pts = run
      .replace(/Z/g, '')
      .split('L')
      .map((p) => {
        const [x, y] = p
          .trim()
          .split(/[\s,]+/)
          .map(Number)
        return [x, y] as Pt
      })
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    if (pts.length > 1) out.push(pts)
  }
  return out
}

export function drawing(cam: Camera, kit: Pick<Kit, 'G' | 'P'>) {
  const { G, P } = kit
  const solid = (
    s: Surface,
    mat: Mat,
    inner: Lines[] = [],
    edge?: number,
  ): Extract<Item, { kind: 'solid' }> => {
    const d = drawSurface(s, cam)
    return { kind: 'solid', mat, tones: d.tones, fill: d.rings, outline: d.rings, inner, edge }
  }
  const kitSolid = (paths: any, mat: Mat, inner: Lines[] = [], edge?: number): Item => ({
    kind: 'solid',
    mat,
    tones: [...paths.shades, paths.top].map((d: string) => ringsOfPath(d ?? '')),
    fill: ringsOfPath(paths.fill),
    outline: ringsOfPath(paths.outline),
    inner: paths.crease
      ? [{ runs: ringsOfPath(paths.crease), ink: 'faint', width: 0.2 }, ...inner]
      : inner,
    edge,
  })
  const seam = (
    s: Surface,
    n: number,
    f: (t: number) => [number, number],
    ink: Ink = 'seam',
    width = 0.22,
  ): Lines => ({
    runs: curveOn(s, cam, curveUV(n, f), { spacing: 0.004 }),
    ink,
    width,
  })
  const twoTone = (
    s: Surface,
    base: Mat,
    from: number,
    to: number,
    seams: [number, Ink][] = [],
  ): Item[] => {
    const under = solid(s, base)
    const paint: Surface = { ...s, at: (a, v) => s.at(from + a * (to - from), v), u: stations(40) }
    const ends = [from, to].filter((m) => m > 0 && m < 1).map((m): [number, Ink] => [m, 'seam'])
    const across = ([m, ink]: [number, Ink]) =>
      seam(paint, 64, (t) => [(m - from) / (to - from), t], ink)
    return [
      under,
      solid(paint, 'livery', [...ends, ...seams].map(across), 0),
      {
        kind: 'lines',
        lines: { runs: closed(under.outline), ink: 'line', width: 0.75 },
      },
    ]
  }
  const patch = (s: Surface, uv: [number, number][], least = 0.08): Rings => {
    const [cu, cv] = uv.reduce((a, b) => [a[0] + b[0] / uv.length, a[1] + b[1] / uv.length], [0, 0])
    if (dot(normalAt(s, cu, cv), cam.V) < least) return []
    const pts: Pt[] = []
    for (let i = 0; i < uv.length; i++) {
      const [u0, v0] = uv[i],
        [u1, v1] = uv[(i + 1) % uv.length]
      for (let k = 0; k < 6; k++)
        pts.push(
          cam.project(s.at(u0 + ((u1 - u0) * k) / 6, (((v0 + ((v1 - v0) * k) / 6) % 1) + 1) % 1)),
        )
    }
    return [pts]
  }
  return { cam, G, P, solid, kitSolid, seam, twoTone, patch }
}
export type Draw = ReturnType<typeof drawing>
