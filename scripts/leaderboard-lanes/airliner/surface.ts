// A parametric surface drawn in the anatomy kit's light: the true silhouette as fill and outline, and the kit's five
// tone bands (four shades and the top) as one polygon each with interpolated, smooth boundaries. The kit's lathe only
// turns circles about a straight axis; an airliner needs bodies that are not turned (a fuselage with a drooped nose and
// an upswept tail cone, airfoil wings and tails, pylons, winglets), so this renders any S(u, v).
//
// Method: sample S on a (u, v) grid, take each vertex's normal from the grid, march every cell against the visibility
// n·V (clipped at 0 with linear interpolation, so the silhouette is the true limb, not a facet edge) and against the
// light n·L at the kit's band thresholds, then union each band's pieces. A surface may be open (an inlet's hole, a wing
// root standing on the fuselage): what is not front-facing is simply not drawn, so the hole reads through.
import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping'

export type V3 = [number, number, number]
export type Pt = [number, number]

export type Camera = {
  /** World to build screen units (before the level shear, which the serializer applies). */
  project(p: V3): Pt
  /** Unit vector toward the viewer. */
  V: V3
  /** Unit vector toward the light. */
  L: V3
  /** The kit's band thresholds on n·L: band = how many thresholds the score reaches (0..4; 4 is the top tone). */
  bands: readonly number[]
}

export type Surface = {
  /** The point at (u, v); u and v run over [0, 1]. */
  at(u: number, v: number): V3
  /** Grid rows along u (or the exact u values) and columns around v. */
  u: number | number[]
  v: number | number[]
  /** v wraps around (a closed section). */
  closed: boolean
  /** Flips the normal: the side with n = ∂S/∂u × ∂S/∂v must face out of the solid. */
  flip?: boolean
}

export type Drawn = {
  /** One path per tone band, 0 (darkest) to 4 (top); '' when the band is absent. */
  tones: string[]
  /** The visible surface: paper fill under the tones. */
  fill: string
  /** Its boundary rings: the silhouette, the visible end rims and any holes. */
  outline: string
  /** The fill as polygons, for occlusion clipping of later details. */
  shape: MultiPolygon
}

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
export const unit = (a: V3): V3 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const lerp = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

const steps = (n: number | number[]) =>
  Array.isArray(n) ? n : Array.from({ length: n + 1 }, (_, i) => i / n)

/** The surface normal at (u, v) from central differences, falling back to the nearest regular row at a pole. */
export function normalAt(s: Surface, u: number, v: number): V3 {
  const h = 1e-4
  const du = sub(s.at(Math.min(1, u + h), v), s.at(Math.max(0, u - h), v))
  const vp = s.closed ? (v + h) % 1 : Math.min(1, v + h)
  const vm = s.closed ? (v - h + 1) % 1 : Math.max(0, v - h)
  const dv = sub(s.at(u, vp), s.at(u, vm))
  let n = cross(du, dv)
  if (len(n) < 1e-12) {
    // A pole (a nose or tip that closes to a point): take the normal a little way in.
    const u2 = u < 0.5 ? u + 0.002 : u - 0.002
    return normalAt(s, u2, v)
  }
  n = unit(n)
  return s.flip ? mul(n, -1) : n
}

type Vx = { p: Pt; f: number; t: number }

/** Sutherland–Hodgman against a scalar field: keeps g ≥ 0, interpolating position and both fields on the cut. */
function clip(poly: Vx[], g: (v: Vx) => number): Vx[] {
  const out: Vx[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length]
    const ga = g(a),
      gb = g(b)
    if (ga >= 0) out.push(a)
    if (ga >= 0 !== gb >= 0) {
      const k = ga / (ga - gb)
      out.push({
        p: [a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k],
        f: a.f + (b.f - a.f) * k,
        t: a.t + (b.t - a.t) * k,
      })
    }
  }
  return out
}

const Q = 1e4
const q = (n: number) => Math.round(n * Q) / Q
const ringOf = (poly: Vx[]): Ring => poly.map((v) => [q(v.p[0]), q(v.p[1])] as [number, number])
const area = (r: Ring) => {
  let a = 0
  for (let i = 0; i < r.length; i++) {
    const [x0, y0] = r[i],
      [x1, y1] = r[(i + 1) % r.length]
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

/** Snaps a geometry to a grid (polygon-clipping's sweep line fails on nearly coincident vertices). */
const snap = (m: MultiPolygon, grid: number): MultiPolygon =>
  m
    .map((poly) =>
      poly
        .map((ring) => {
          const out: [number, number][] = []
          for (const [x, y] of ring) {
            const p: [number, number] = [Math.round(x / grid) * grid, Math.round(y / grid) * grid]
            const last = out[out.length - 1]
            if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p)
          }
          // Rings may come closed or open: drop a repeated first point, keep any three distinct corners.
          const [f, l] = [out[0], out[out.length - 1]]
          if (out.length > 1 && f[0] === l[0] && f[1] === l[1]) out.pop()
          return out
        })
        .filter((ring) => ring.length >= 3),
    )
    .filter((poly) => poly.length)

/** Unions two geometries; on a sweep-line failure retries on coarser grids, and fails the build if none works. */
function union2(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
  for (const grid of [0, 1e-3, 1e-2, 5e-2]) {
    try {
      return grid
        ? polygonClipping.union(snap(a, grid), snap(b, grid))
        : polygonClipping.union(a, b)
    } catch {
      // try the next grid
    }
  }
  throw new Error('airliner: polygon union failed on every snapping grid')
}

/** Unions many polygons in balanced batches (polygon-clipping is fastest on similar-sized inputs). */
export function unionAll(polys: Polygon[] | MultiPolygon[]): MultiPolygon {
  let list: MultiPolygon[] = (polys as (Polygon | MultiPolygon)[])
    .filter((p) => p.length)
    .map((p) => (typeof p[0][0][0] === 'number' ? [p as Polygon] : (p as MultiPolygon)))
  if (!list.length) return []
  while (list.length > 1) {
    const next: MultiPolygon[] = []
    for (let i = 0; i < list.length; i += 64) {
      const batch = list.slice(i, i + 64)
      if (batch.length === 1) {
        next.push(batch[0])
        continue
      }
      try {
        next.push(polygonClipping.union(batch[0], ...batch.slice(1)))
      } catch {
        next.push(batch.reduce((acc, m) => union2(acc, m)))
      }
    }
    list = next
  }
  return list[0]
}

/**
 * Closes the slivers a union leaves where a cut point, rounded, misses its neighbour's edge by a hair: any hole thinner
 * than half a build unit on average (twice its area over its perimeter) goes. Real openings (an inlet) are far wider.
 */
function solidHoles(m: MultiPolygon): MultiPolygon {
  const width = (r: Ring) => {
    let p = 0
    for (let i = 1; i < r.length; i++) p += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1])
    return p ? (2 * Math.abs(area(r))) / p : 0
  }
  return m.map(([outer, ...holes]) => [outer, ...holes.filter((h) => width(h) > 0.5)])
}

export const pathOfMulti = (m: MultiPolygon, f: (p: Pt) => string) =>
  m
    .map((poly) =>
      poly
        .map((ring) => {
          const pts = ring.slice(0, ring.length - 1)
          return pts.length > 2 ? 'M' + pts.map((p) => f(p as Pt)).join('L') + 'Z' : ''
        })
        .join(''),
    )
    .join('')

/** Draws the visible surface. Paths are in build screen units with full precision ('x y' pairs, M/L/Z only). */
export function drawSurface(s: Surface, cam: Camera): Drawn {
  const us = steps(s.u)
  const vs = steps(s.v)
  const nu = us.length,
    nv = vs.length
  const grid: Vx[][] = []
  const band: number[][] = []
  for (let i = 0; i < nu; i++) {
    const row: Vx[] = []
    const brow: number[] = []
    for (let j = 0; j < nv; j++) {
      const u = us[i],
        v = vs[j]
      const p = s.at(u, v)
      const n = normalAt(s, u, v)
      const vx = { p: cam.project(p), f: dot(n, cam.V), t: dot(n, cam.L) }
      row.push(vx)
      brow.push(bandOf(vx.t, cam.bands))
    }
    grid.push(row)
    band.push(brow)
  }
  const pieces: Polygon[][] = [[], [], [], [], []]
  const cols = s.closed ? nv : nv - 1
  for (let i = 0; i < nu - 1; i++) {
    let j = 0
    while (j < cols) {
      const j1 = (j + 1) % nv
      const c = [grid[i][j], grid[i + 1][j], grid[i + 1][j1], grid[i][j1]]
      const whole =
        c.every((x) => x.f > 0) &&
        band[i][j] === band[i + 1][j] &&
        band[i][j] === band[i + 1][j1] &&
        band[i][j] === band[i][j1]
      if (whole) {
        // Merge the run of whole cells that share this band into one strip.
        const b = band[i][j]
        let k = j + 1
        while (k < cols) {
          const k1 = (k + 1) % nv
          const ok =
            grid[i][k1].f > 0 &&
            grid[i + 1][k1].f > 0 &&
            band[i][k1] === b &&
            band[i + 1][k1] === b &&
            band[i][k] === b &&
            band[i + 1][k] === b
          if (!ok) break
          k++
        }
        const top: Vx[] = [],
          bottom: Vx[] = []
        for (let m = j; m <= k; m++) {
          top.push(grid[i][m % nv])
          bottom.push(grid[i + 1][m % nv])
        }
        const r = ringOf([...top, ...bottom.reverse()])
        if (Math.abs(area(r)) > 1e-9) pieces[b].push([r])
        j = k
        continue
      }
      let poly = clip(c, (x) => x.f)
      if (poly.length >= 3) {
        for (let b = 0; b < cam.bands.length; b++) {
          const T = cam.bands[b]
          const below = clip(poly, (x) => T - x.t)
          if (below.length >= 3) {
            const r = ringOf(below)
            if (Math.abs(area(r)) > 1e-9) pieces[b].push([r])
          }
          poly = clip(poly, (x) => x.t - T)
          if (poly.length < 3) break
        }
        if (poly.length >= 3) {
          const r = ringOf(poly)
          if (Math.abs(area(r)) > 1e-9) pieces[cam.bands.length].push([r])
        }
      }
      j++
    }
  }
  const unions = pieces.map((list) => unionAll(list))
  const shape = solidHoles(unionAll(unions.filter((m) => m.length)))
  const f = (p: Pt) => `${p[0]} ${p[1]}`
  return {
    tones: unions.map((m) => pathOfMulti(m, f)),
    fill: pathOfMulti(shape, f),
    outline: pathOfMulti(shape, f),
    shape,
  }
}

export const bandOf = (score: number, bands: readonly number[]) => {
  let b = 0
  while (b < bands.length && score >= bands[b]) b++
  return b
}

/**
 * A curve on the surface through (u, v) points, cut to its front-facing runs. Each run ends exactly at the limb, so a
 * seam drawn under the outline lands on it. `least` keeps a run off the limb by that much facing (for marks that should
 * not reach the silhouette, such as windows).
 */
export function curveOn(
  s: Surface,
  cam: Camera,
  uv: [number, number][],
  { spacing = 0, least = 0 }: { spacing?: number; least?: number } = {},
): Pt[][] {
  let pts = uv
  if (spacing > 0) {
    pts = []
    for (let i = 0; i < uv.length - 1; i++) {
      const a = uv[i],
        b = uv[i + 1]
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing))
      for (let k = 0; k < n; k++)
        pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
    }
    pts.push(uv[uv.length - 1])
  }
  const runs: Pt[][] = []
  let run: Pt[] = []
  let prev: { p: V3; f: number } | null = null
  for (const [u, v] of pts) {
    const p = s.at(u, v)
    const f = dot(normalAt(s, u, v), cam.V) - least
    if (prev && prev.f >= 0 !== f >= 0) {
      const k = prev.f / (prev.f - f)
      const cut = cam.project(lerp(prev.p, p, k))
      if (f >= 0) run = [cut]
      else {
        run.push(cut)
        if (run.length > 1) runs.push(run)
        run = []
      }
    }
    if (f >= 0) run.push(cam.project(p))
    prev = { p, f }
  }
  if (run.length > 1) runs.push(run)
  return runs
}
