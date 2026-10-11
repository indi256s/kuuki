import { LAND_RINGS } from './land.generated'
import { Scene, type P3, type Pt } from './scene'

// The globe: radius R, its axis tilted TILT toward screen right, on a meridian ring and a post over a round base.
const R = 40,
  TILT = (23.4 * Math.PI) / 180,
  BASE = { r: 22, h: 5 },
  POST = 14,
  RING = { inner: R + 2.5, outer: R + 4.5 }
const RAD = Math.PI / 180

type V3 = [number, number, number]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const scale = (a: V3, f: number): V3 => [a[0] * f, a[1] * f, a[2] * f]
const plus = (...vs: V3[]): V3 =>
  vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0])
const unit = (a: V3) => scale(a, 1 / Math.hypot(...a))
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
/** Toward the viewer: the kernel projects (1, 1, 1) to a point. */
const VIEW = unit([1, 1, 1])

/**
 * Crossings: a desk globe turned to face the time zones flown through. The equator is cut into the 24 hourly zones; `offsets` (whole hours from UTC) that were reached are lit. The Arctic Circle is drawn, and both lines turn solid when crossed.
 * Land is the true coast; anything over the horizon is pressed onto the rim, so a continent never shows through.
 * Parts: `backlight` (the lit zones' glow, which hover raises).
 */
export function globe(
  offsets: readonly number[],
  { equator = false, arctic = false }: { equator?: boolean; arctic?: boolean } = {},
  k = 1,
) {
  const s = new Scene(k)
  const lift = BASE.h + POST + RING.outer * Math.cos(TILT)
  const C: V3 = [0, 0, lift]
  const axis: V3 = [Math.sin(TILT) / Math.SQRT2, -Math.sin(TILT) / Math.SQRT2, Math.cos(TILT)]
  // The meridian facing the viewer, and east, which runs to screen right.
  const facing = unit(plus(VIEW, scale(axis, -dot(VIEW, axis))))
  const east = cross(facing, axis)
  // Face the middle of the lit zones (a circular mean, so +12 and −11 sit together); none lit, face Greenwich.
  const sx = offsets.reduce((a, o) => a + Math.cos(o * 15 * RAD), 0),
    sy = offsets.reduce((a, o) => a + Math.sin(o * 15 * RAD), 0)
  const lon0 = offsets.length ? Math.atan2(sy, sx) / RAD : 0

  /** A point on the globe, `r` from its centre, as an offset from C. */
  const at = (lon: number, lat: number, r = R): V3 => {
    const f = lat * RAD,
      l = (lon - lon0) * RAD
    return scale(
      plus(
        scale(axis, Math.sin(f)),
        scale(facing, Math.cos(f) * Math.cos(l)),
        scale(east, Math.cos(f) * Math.sin(l)),
      ),
      r,
    )
  }
  const world = (q: V3): P3 => plus(C, q)
  const seen = (q: V3) => dot(q, VIEW) > 0
  /** Over the horizon, pressed onto the rim. */
  const onRim = (q: V3): V3 =>
    seen(q) ? q : scale(unit(plus(q, scale(VIEW, -dot(q, VIEW)))), Math.hypot(...q))
  /** The visible runs of a line on the sphere. */
  const runs = (pts: V3[]) => {
    const out: P3[][] = []
    let run: P3[] = []
    for (const q of pts) {
      if (seen(q)) run.push(world(q))
      else if (run.length) {
        out.push(run)
        run = []
      }
    }
    if (run.length) out.push(run)
    // A closed line that starts on the front joins its last run to its first.
    if (out.length > 1 && seen(pts[0]) && seen(pts[pts.length - 1]))
      out[0] = [...out.pop()!, ...out[0]]
    return out.filter((r) => r.length > 1)
  }
  const circleOf = (u: V3, v: V3, r: number, from = 0, to = 360, step = 6) => {
    const out: V3[] = []
    for (let a = from; a <= to + 1e-9; a += step)
      out.push(plus(scale(u, r * Math.cos(a * RAD)), scale(v, r * Math.sin(a * RAD))))
    return out
  }

  // Base and post.
  s.poly(
    circleOf([1, 0, 0], [0, 1, 0], BASE.r + 4, 0, 354, 6).map(([x, y]) => [x + 3, y + 3, 0]),
    'shadow',
    'none',
  )
  s.rbox(-BASE.r, -BASE.r, 0, BASE.r * 2, BASE.r * 2, BASE.h, BASE.r, { top: 'top', wall: 'front' })
  s.rbox(-7, -7, BASE.h, 14, 14, 2, 7, { top: 'top', wall: 'front' })
  s.box(-1.6, -1.6, BASE.h + 2, 3.2, 3.2, lift - RING.outer * Math.cos(TILT) - BASE.h - 1)

  // The meridian ring lies in the plane of the axis and east: its lower half is behind the globe, its upper half in front.
  const band = (from: number, to: number) => {
    const outer = circleOf(axis, east, RING.outer, from, to, 4),
      inner = circleOf(axis, east, RING.inner, from, to, 4).reverse()
    s.poly([...outer, ...inner].map(world), 'front')
  }
  band(90, 270)

  // The sphere, its land, and a shaded crescent away from the light.
  // The outline: the great circle square to the view.
  const sphere = circleOf(
    unit(cross(VIEW, [0, 0, 1])),
    unit(cross(VIEW, cross(VIEW, [0, 0, 1]))),
    R,
    0,
    356,
    4,
  )
  s.poly(sphere.map(world), 'top')
  const centre = s.project(world([0, 0, 0])),
    edge = s.project(world(sphere[0]))
  const rs = Math.hypot(edge[0] - centre[0], edge[1] - centre[1])
  const shift: Pt = [-0.32 * rs, -0.22 * rs]
  const inA = (p: Pt) => Math.hypot(p[0] - centre[0], p[1] - centre[1]) <= rs + 1e-6,
    inB = (p: Pt) => Math.hypot(p[0] - centre[0] - shift[0], p[1] - centre[1] - shift[1]) <= rs
  const lune: Pt[] = []
  for (let a = 0; a < 360; a += 3) {
    const p: Pt = [centre[0] + rs * Math.cos(a * RAD), centre[1] + rs * Math.sin(a * RAD)]
    if (!inB(p)) lune.push(p)
  }
  // Start the outer arc at its first point after a gap, so it runs unbroken.
  const gapAt = lune.findIndex((p, i) => {
    const q = lune[(i + lune.length - 1) % lune.length]
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > rs * 0.2
  })
  const outer = gapAt > 0 ? [...lune.slice(gapAt), ...lune.slice(0, gapAt)] : lune
  const innerArc: Pt[] = []
  for (let a = 0; a < 360; a += 3) {
    const p: Pt = [
      centre[0] + shift[0] + rs * Math.cos(a * RAD),
      centre[1] + shift[1] + rs * Math.sin(a * RAD),
    ]
    if (inA(p)) innerArc.push(p)
  }
  const innerStart = innerArc.findIndex((p, i) => {
    const q = innerArc[(i + innerArc.length - 1) % innerArc.length]
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > rs * 0.2
  })
  const inner =
    innerStart > 0 ? [...innerArc.slice(innerStart), ...innerArc.slice(0, innerStart)] : innerArc
  s.area([[...outer, ...inner.reverse()]], 'side')

  // Land goes over the shade, which only darkens the paper under it.
  for (const flat of LAND_RINGS) {
    const ring: V3[] = []
    for (let i = 0; i < flat.length; i += 2) ring.push(at(flat[i], flat[i + 1]))
    if (!ring.some(seen)) continue
    s.poly(ring.map(onRim).map(world), 'land', 'detail', undefined, 0.6)
  }

  // Graticule: meridians every 30°, then the Arctic Circle and the equator.
  const grat: P3[][] = []
  for (let lon = 0; lon < 360; lon += 30) {
    const pts: V3[] = []
    for (let lat = -84; lat <= 84; lat += 6) pts.push(at(lon, lat))
    grat.push(...runs(pts))
  }
  s.segs(grat, 'detail', 0.6)
  const parallel = (lat: number) => {
    const pts: V3[] = []
    for (let lon = 0; lon <= 360; lon += 4) pts.push(at(lon, lat))
    return runs(pts)
  }
  for (const [lat, crossed] of [
    [66.56, arctic],
    [0, equator],
  ] as const)
    for (const run of parallel(lat))
      s.line(run, crossed ? 'muted' : 'detail', 0.9, crossed ? undefined : '2 2.5')

  // The 24 zones along the equator, each 15° wide around its whole-hour offset, standing just off the surface.
  const zone = (offset: number) => {
    const pts: V3[] = []
    for (let lon = offset * 15 - 6.5; lon <= offset * 15 + 6.5 + 1e-9; lon += 1.625)
      pts.push(at(lon, 0, R + 0.4))
    return runs(pts)
  }
  const reached = new Set(offsets.map((o) => ((((o + 12) % 24) + 24) % 24) - 12))
  const dim: P3[][] = [],
    lit: P3[][] = []
  for (let o = -12; o < 12; o++) (reached.has(o) ? lit : dim).push(...zone(o))
  s.segs(dim, 'ghost', 2.2)
  if (lit.length) {
    s.group('backlight', () => s.glow(2.6, () => s.segs(lit, 'accent', 2.6)))
    s.segs(lit, 'accent', 2.2)
  }

  // The ring's upper half, in front, and the pivots where the axis meets it.
  band(-90, 90)
  for (const sign of [1, -1]) {
    const p = scale(axis, (sign * (RING.inner + RING.outer)) / 2)
    if (!seen(p)) continue
    s.poly(
      circleOf(east, cross(axis, east), 1.3, 0, 330, 30).map((d) => world(plus(p, d))),
      'detail',
      'line',
      undefined,
      0.6,
    )
  }
  return s.done()
}
