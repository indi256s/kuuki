import { hull, type P3, type Paint, type Pt, type Scene } from '../../../overview/iso/scene'

// Turned and lofted parts for the ladder figures, built on the app Scene's public API.
// The Scene camera looks from +x +y +z, so a face is visible when its normal has a positive component along (1, 1, 1).
// Faces shade from one light so curved parts match the Scene's boxes: tops `top`, +y faces `front`, +x faces `side`.

// ---------------------------------------------------------------- vectors

export const add = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const mul = (a: P3, k: number): P3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: P3, b: P3): P3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const len = (a: P3) => Math.hypot(a[0], a[1], a[2])
export const unit = (a: P3): P3 => {
  const l = len(a)
  return l > 1e-9 ? mul(a, 1 / l) : [0, 0, 0]
}
export const mix = (a: P3, b: P3, t: number): P3 => add(a, mul(sub(b, a), t))
/** a + u·U + v·V + w·W */
export const comb = (o: P3, ...terms: [number, P3][]): P3 =>
  terms.reduce<P3>((p, [k, v]) => add(p, mul(v, k)), o)

/** Towards the viewer. */
export const VIEW = unit([1, 1, 1])
/** Towards the light: brightest on tops, then +y faces, then +x faces, as the Scene's boxes are painted. */
export const LIGHT = unit([0.15, 0.45, 0.88])
const B_SIDE = LIGHT[0],
  B_FRONT = LIGHT[1],
  B_TOP = LIGHT[2]

/** Whether a face with outward normal `n` faces the viewer. */
export const facing = (n: P3) => dot(n, VIEW) > 1e-6

/** Three paints from dark to light: a material's tone ramp. */
export type Ramp = { dark: Paint; mid: Paint; light: Paint }
export const GREY: Ramp = { dark: 'side', mid: 'front', light: 'top' }
export const ACCENT: Ramp = { dark: 'accent-side', mid: 'accent', light: 'accent' }

/** The flat tone of a face with outward normal `n`, picked from `ramp` by how much light it catches. */
export function toneOf(n: P3, ramp: Ramp = GREY): Paint {
  const b = dot(unit(n), LIGHT)
  return b >= (B_FRONT + B_TOP) / 2
    ? ramp.light
    : b >= (B_SIDE + B_FRONT) / 2
      ? ramp.mid
      : ramp.dark
}

// ---------------------------------------------------------------- frames and profiles

/** A local frame: `a` is the axis, `u` the 0° direction round it, `v` the 90° direction. */
export type Frame = { o: P3; a: P3; u: P3; v: P3 }

/** A frame along `axis` with its 90° direction as close to `up` as the axis allows (world z by default; world y for an upright axis). */
export function frameAlong(o: P3, axis: P3, up: P3 = [0, 0, 1]): Frame {
  const a = unit(axis)
  let v = sub(up, mul(a, dot(up, a)))
  if (len(v) < 1e-6) v = sub([0, 1, 0], mul(a, a[1]))
  v = unit(v)
  return { o, a, u: unit(cross(v, a)), v }
}

/**
 * A smooth curve through a table of rows `[s, ...values]` (s ascending): monotone cubic (Fritsch–Carlson), so it never overshoots between rows and its slope is continuous, which keeps lathe shading free of steps at the rows.
 * Returns the values at `s`, clamped to the table's ends.
 */
export function spline(rows: readonly (readonly number[])[]): (s: number) => number[] {
  const n = rows.length,
    m = rows[0].length - 1
  const xs = rows.map((r) => r[0])
  const slopes = Array.from({ length: m }, (_, c) => {
    const ys = rows.map((r) => r[c + 1])
    const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]))
    const t = xs.map((_, i) =>
      i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2,
    )
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        t[i] = t[i + 1] = 0
        continue
      }
      const a = t[i] / d[i],
        b = t[i + 1] / d[i],
        h = Math.hypot(a, b)
      if (h > 3) {
        t[i] = (3 * a * d[i]) / h
        t[i + 1] = (3 * b * d[i]) / h
      }
    }
    return { ys, t }
  })
  return (s) => {
    const x = Math.min(xs[n - 1], Math.max(xs[0], s))
    let i = 0
    while (i < n - 2 && x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i],
      u = (x - xs[i]) / h
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1,
      h10 = u ** 3 - 2 * u ** 2 + u,
      h01 = -2 * u ** 3 + 3 * u ** 2,
      h11 = u ** 3 - u ** 2
    return slopes.map(
      ({ ys, t }) => h00 * ys[i] + h10 * h * t[i] + h01 * ys[i + 1] + h11 * h * t[i + 1],
    )
  }
}

// ---------------------------------------------------------------- lathe

/** One cross-section of a turned or lofted body: half-width `r` along u, half-height `rz` along v (defaults to r), centre lifted `lift` along v. */
export type Section = { r: number; rz?: number; lift?: number }

export type LatheOpts = {
  /** Segments along the axis (more for long curved bodies). */
  steps?: number
  /** Points round each ring. */
  ring?: number
  ramp?: Ramp
  line?: Paint
  crease?: Paint
  /** Silhouette width in px. */
  width?: number
  /** Smooth tone layers over the base (hero only: thumbs are line-only). */
  shade?: boolean
  /** Draw the end discs that face the viewer (default true). */
  caps?: boolean
  /** A translucent paint laid over the whole body after shading (rubber, a dark finish). */
  tint?: Paint
}

/** A drawn body of revolution: points and lines on its skin, for windows, doors, seams and anything that sits on it. */
export type Body = {
  /** Point on the skin at station `s`, angle `deg` (0 = u, 90 = v), `lift` off the skin. */
  at(s: number, deg: number, lift?: number): P3
  /** Outward unit normal at (s, deg). */
  normal(s: number, deg: number): P3
  /** The section at `s`. */
  section(s: number): { r: number; rz: number; lift: number }
  /** The visible angular range [lo, hi] in degrees at `s` (the limbs), or null when the ring is edge-on or hidden. */
  limbs(s: number): [number, number] | null
  /** A ring seam across the visible half at `s`, ending on the limbs. */
  seam(s: number, paint?: Paint, width?: number): void
  /** A line along the skin at angle `deg` from s0 to s1. */
  along(deg: number, s0: number, s1: number, paint?: Paint, width?: number): void
  /** A closed patch on the skin through (s, deg) corners, each edge followed along the skin. */
  patch(
    corners: readonly (readonly [number, number])[],
    fill: Paint,
    stroke?: Paint,
    width?: number,
  ): void
}

export const D2R = Math.PI / 180

/**
 * A body turned (or lofted, with elliptic sections) along the frame's axis from s0 to s1.
 * Drawn as: the silhouette (each segment's convex hull, stroked at twice the width and then filled over as one area, so only the outer half of the stroke shows and internal joins vanish), smooth tone layers (nested regions of equal light, each adding one step of the next tone), the end disc that faces the viewer, and its crease.
 */
export function lathe(
  s: Scene,
  F: Frame,
  sec: (s: number) => Section,
  s0: number,
  s1: number,
  o: LatheOpts = {},
): Body {
  const steps = o.steps ?? 24,
    M = o.ring ?? 32,
    ramp = o.ramp ?? GREY,
    line = o.line ?? 'line',
    crease = o.crease ?? 'crease',
    width = o.width ?? 1
  const geo = (t: number) => {
    const q = sec(t)
    return { r: q.r, rz: q.rz ?? q.r, lift: q.lift ?? 0 }
  }
  const h = Math.max(1e-4, (s1 - s0) * 1e-4)
  const deriv = (t: number) => {
    const a = geo(Math.max(s0, t - h)),
      b = geo(Math.min(s1, t + h)),
      d = Math.min(s1, t + h) - Math.max(s0, t - h)
    return { r: (b.r - a.r) / d, rz: (b.rz - a.rz) / d, lift: (b.lift - a.lift) / d }
  }
  const at = (t: number, deg: number, lift = 0): P3 => {
    const g = geo(t),
      th = deg * D2R
    return comb(
      F.o,
      [t, F.a],
      [(g.r + lift) * Math.cos(th), F.u],
      [g.lift + (g.rz + lift) * Math.sin(th), F.v],
    )
  }
  const normalRad = (t: number, th: number): P3 => {
    const g = geo(t),
      d = deriv(t),
      c = Math.cos(th),
      sn = Math.sin(th)
    const na = -(d.r * g.rz * c * c + g.r * sn * (d.lift + d.rz * sn))
    const n = comb([0, 0, 0], [na, F.a], [g.rz * c, F.u], [g.r * sn, F.v])
    // A pointed tip has no section: its normal is the axis.
    return len(n) > 1e-9 ? unit(n) : unit(mul(F.a, t > (s0 + s1) / 2 ? 1 : -1))
  }
  const normal = (t: number, deg: number) => normalRad(t, deg * D2R)

  // Fine angular samples for limbs, seams and tone regions.
  const FM = 96
  const COS = Array.from({ length: FM }, (_, j) => Math.cos((j / FM) * 2 * Math.PI)),
    SIN = Array.from({ length: FM }, (_, j) => Math.sin((j / FM) * 2 * Math.PI))
  /** The arc (radians, lo < hi) where f(j) > 0 over the FM samples round the ring, refined by linear interpolation; null when none is, the whole ring when all are. */
  const arcOf = (f: (j: number) => number): [number, number] | null => {
    const v = new Float64Array(FM)
    let pos = 0
    for (let j = 0; j < FM; j++) if ((v[j] = f(j)) > 0) pos++
    if (pos === FM) return [0, 2 * Math.PI]
    if (!pos) return null
    let start = 0
    while (!(v[start] > 0 && !(v[(start + FM - 1) % FM] > 0))) start++
    let end = start
    while (v[(end + 1) % FM] > 0) end++
    const root = (j0: number) => {
      const a = v[(j0 + FM) % FM],
        b = v[(j0 + 1) % FM]
      return ((j0 + a / (a - b)) / FM) * 2 * Math.PI
    }
    return [root(start - 1), root(end)]
  }
  /** How much each of the FM normals round the ring at s faces the viewer (g) and the light (b). The section and its slope are read once per ring. */
  const ringSamples = (t: number) => {
    const q = geo(t),
      d = deriv(t)
    const g = new Float64Array(FM),
      b = new Float64Array(FM)
    for (let j = 0; j < FM; j++) {
      const c = COS[j],
        sn = SIN[j]
      const na = -(d.r * q.rz * c * c + q.r * sn * (d.lift + d.rz * sn)),
        nu = q.rz * c,
        nv = q.r * sn
      const nx = na * F.a[0] + nu * F.u[0] + nv * F.v[0],
        ny = na * F.a[1] + nu * F.u[1] + nv * F.v[1],
        nz = na * F.a[2] + nu * F.u[2] + nv * F.v[2]
      const l = Math.hypot(nx, ny, nz) || 1
      g[j] = (nx * VIEW[0] + ny * VIEW[1] + nz * VIEW[2]) / l
      b[j] = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / l
    }
    return { g, b }
  }
  const limbsRad = (t: number) => {
    const { g } = ringSamples(t)
    return arcOf((j) => g[j])
  }
  // A fit probe (Scene measuring for fitBox) only needs bounds: tone layers sit inside the silhouette, so they are skipped. Scene.str returns '' only while measuring.
  const probing = s.str([[0, 0]]) === ''

  const ts = Array.from({ length: steps + 1 }, (_, i) => s0 + ((s1 - s0) * i) / steps)
  const angles = Array.from({ length: M }, (_, j) => (j / M) * 360)
  const rings = ts.map((t) => s.pp(angles.map((a) => at(t, a))))
  const hulls: Pt[][] = []
  for (let i = 0; i < steps; i++) hulls.push(hull([...rings[i], ...rings[i + 1]]))

  // Silhouette: the strokes first, then the fill covers their inner halves and every internal join.
  for (const hp of hulls) s.poly2(hp, 'none', line, 2 * width)
  s.area(hulls, ramp.dark)

  if (o.shade && !probing) {
    const levels: [number, Paint, number][] = []
    const N1 = 5,
      N2 = 5
    for (let i = 1; i <= N1; i++)
      levels.push([B_SIDE + ((B_FRONT - B_SIDE) * (i - 0.5)) / N1, ramp.mid, 1 / (N1 - i + 1)])
    for (let i = 1; i <= N2; i++)
      levels.push([B_FRONT + ((B_TOP - B_FRONT) * (i - 0.5)) / N2, ramp.light, 1 / (N2 - i + 1)])
    const fs = Array.from({ length: steps + 1 }, (_, i) => s0 + ((s1 - s0) * i) / steps)
    const samples = fs.map(ringSamples)
    for (const [thr, paint, op] of levels) {
      const arcs = samples.map(({ g, b }) => arcOf((j) => Math.min(g[j], b[j] - thr)))
      // Each contiguous run of stations with a lit arc is one region.
      let i = 0
      while (i < fs.length) {
        if (!arcs[i]) {
          i++
          continue
        }
        let j = i
        while (j + 1 < fs.length && arcs[j + 1]) j++
        const sweep = (t: number, a: number, b: number) => {
          const n = Math.max(2, Math.ceil(Math.abs(b - a) / (Math.PI / 24)))
          return Array.from({ length: n + 1 }, (_, k) => at(t, (a + ((b - a) * k) / n) / D2R))
        }
        const pts: P3[] = []
        const [a0, b0] = arcs[i]!,
          [a1, b1] = arcs[j]!
        pts.push(...sweep(fs[i], b0, a0))
        for (let k = i + 1; k < j; k++) pts.push(at(fs[k], arcs[k]![0] / D2R))
        pts.push(...sweep(fs[j], a1, b1))
        for (let k = j - 1; k > i; k--) pts.push(at(fs[k], arcs[k]![1] / D2R))
        if (j > i) s.poly(pts, paint, 'none', undefined, undefined, Math.round(op * 1000) / 1000)
        i = j + 1
      }
    }
  }
  if (o.tint) s.area(hulls, o.tint)

  // End discs that face the viewer, with a crease where they meet the visible skin.
  if (o.caps ?? true)
    for (const [t, dir] of [
      [s0, -1],
      [s1, 1],
    ] as const) {
      const g = geo(t)
      const n = mul(F.a, dir)
      if (g.r < 1e-3 || !facing(n)) continue
      s.poly(
        angles.map((a) => at(t, a)),
        toneOf(n, ramp),
        'none',
      )
      const lim = limbsRad(t)
      if (lim) arcLine(t, lim[0], lim[1], crease, 0.6 * width)
    }

  function arcLine(t: number, a: number, b: number, paint: Paint, w: number) {
    const n = Math.max(2, Math.ceil(Math.abs(b - a) / (Math.PI / 32)))
    s.line(
      Array.from({ length: n + 1 }, (_, k) => at(t, (a + ((b - a) * k) / n) / D2R)),
      paint,
      w,
    )
  }

  return {
    at,
    normal,
    section: geo,
    limbs(t) {
      const r = limbsRad(t)
      return r ? [r[0] / D2R, r[1] / D2R] : null
    },
    seam(t, paint = crease, w = 0.6 * width) {
      const r = limbsRad(t)
      if (r) arcLine(t, r[0], r[1], paint, w)
    },
    along(deg, a, b, paint = crease, w = 0.6 * width) {
      const n = Math.max(2, Math.ceil((Math.abs(b - a) / (s1 - s0)) * steps * 2))
      s.line(
        Array.from({ length: n + 1 }, (_, k) => at(a + ((b - a) * k) / n, deg)),
        paint,
        w,
      )
    },
    patch(corners, fill, stroke = crease, w = 0.6 * width) {
      const pts: P3[] = []
      corners.forEach(([sa, da], i) => {
        const [sb, db] = corners[(i + 1) % corners.length]
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(sb - sa) / 2, Math.abs(db - da) / 8)))
        for (let k = 0; k < n; k++) pts.push(at(sa + ((sb - sa) * k) / n, da + ((db - da) * k) / n))
      })
      s.poly(pts, fill, stroke, undefined, w)
    },
  }
}

/** A straight round rod from `a` to `b` (struts, axles, legs), shaded like any lathe. */
export function tube(s: Scene, a: P3, b: P3, r: number, o: LatheOpts = {}) {
  return lathe(s, frameAlong(a, sub(b, a)), () => ({ r }), 0, len(sub(b, a)), {
    steps: 1,
    ring: 16,
    ...o,
  })
}

/** A short disc (washer, hub, flange) centred on `c` along `axis`, `t` thick. */
export function disc(s: Scene, c: P3, axis: P3, r: number, t: number, o: LatheOpts = {}) {
  const F = frameAlong(c, axis)
  return lathe(s, F, () => ({ r }), -t / 2, t / 2, { steps: 1, ...o })
}

/** A circle of `n` points on the plane through `c` with normal `n`. */
export function circleOn(c: P3, n: P3, r: number, count = 12): P3[] {
  const F = frameAlong(c, n)
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * 2 * Math.PI
    return comb(c, [r * Math.cos(a), F.u], [r * Math.sin(a), F.v])
  })
}

/** A screw head or rivet: a dot, with a ring round it when `ring` is set; on the face through `c` with normal `n`. */
export function screw(s: Scene, c: P3, n: P3, r: number, o: { ring?: number; paint?: Paint } = {}) {
  if (o.ring) s.poly(circleOn(c, n, o.ring, 12), 'none', 'crease', undefined, 0.5)
  s.poly(circleOn(c, n, r, 8), o.paint ?? 'line', 'none')
}

/**
 * A wheel on an axle along `axis` (unit), centred on `c`: a rubber tyre with rounded shoulders, a hub with lug dots on the face that looks at the viewer.
 * `hero` adds the hub detail; a thumb keeps the tyre and its rim line.
 */
export function wheel(s: Scene, c: P3, axis: P3, r: number, w: number, hero: boolean) {
  const sh = w * 0.42
  const F = frameAlong(c, axis)
  lathe(
    s,
    F,
    (t) => {
      const e = Math.max(0, Math.abs(t) - (w / 2 - sh))
      return { r: r - sh + Math.sqrt(Math.max(0, sh * sh - e * e)) }
    },
    -w / 2,
    w / 2,
    { steps: hero ? 6 : 2, ring: hero ? 28 : 16, shade: hero, tint: hero ? 'shade' : undefined },
  )
  // The face towards the viewer carries the hub.
  const face = dot(F.a, VIEW) > 0 ? 1 : -1
  const fc = add(c, mul(F.a, (face * w) / 2))
  const n = mul(F.a, face)
  s.poly(circleOn(fc, n, r * 0.6, hero ? 20 : 12), toneOf(n), 'crease', undefined, 0.6)
  if (!hero) return
  disc(s, add(fc, mul(n, 0.15)), n, r * 0.34, 0.3, { ring: 16 })
  const H = frameAlong(fc, n)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 2 * Math.PI + 0.3
    s.poly(
      circleOn(
        comb(add(fc, mul(n, 0.31)), [r * 0.22 * Math.cos(a), H.u], [r * 0.22 * Math.sin(a), H.v]),
        n,
        Math.max(0.12, r * 0.045),
        6,
      ),
      'line',
      'none',
    )
  }
}

// ---------------------------------------------------------------- lifting surfaces

/** One chordwise station of a lifting surface: leading and trailing edge points on the chord line, and the section's thickness. */
export type FoilStation = { le: P3; te: P3; t: number }

export type FoilOpts = {
  /** The side the upper skin faces (world z for wings, +y for a fin). */
  up?: P3
  ramp?: Ramp
  line?: Paint
  crease?: Paint
  width?: number
  /** Strips round the leading-edge nose. */
  nose?: number
}

export type Foil = {
  /** A point on the upper skin at station index `i` (fractional between stations), chord fraction `f` (0 = LE, 1 = TE). */
  top(i: number, f: number): P3
  /** A line on the upper skin from (i0, f0) to (i1, f1), straight across stations. */
  line(i0: number, f0: number, i1: number, f1: number, paint?: Paint, width?: number): void
}

/**
 * A wing, tailplane or fin through two or more stations: a rounded leading edge (nose strips shaded by their facing), an upper skin that thins to a sharp trailing edge, end caps where a station faces the viewer, and one clean silhouette.
 * Stations run from root to tip (or tip to tip); the upper skin faces `up`.
 */
export function foil(s: Scene, st: readonly FoilStation[], o: FoilOpts = {}): Foil {
  const up = o.up ?? [0, 0, 1],
    ramp = o.ramp ?? GREY,
    line = o.line ?? 'line',
    crease = o.crease ?? 'crease',
    width = o.width ?? 1,
    NB = o.nose ?? 3
  const frames = st.map(({ le, te, t }) => {
    const c = unit(sub(te, le))
    const n = unit(sub(up, mul(c, dot(up, c))))
    const rho = t / 2
    const C = add(le, mul(c, rho))
    return { le, te, c, n, rho, C }
  })
  // Section outline, from the TE over the top, round the nose and back under to the TE.
  const nosePt = (i: number, phi: number) => {
    const f = frames[i]
    return comb(f.C, [-f.rho * Math.cos(phi), f.c], [f.rho * Math.sin(phi), f.n])
  }
  const teTop = (i: number) => {
    const f = frames[i]
    return add(f.te, mul(f.n, f.rho * 0.16))
  }
  const teBot = (i: number) => {
    const f = frames[i]
    return add(f.te, mul(f.n, -f.rho * 0.16))
  }
  const phis = Array.from({ length: NB + 1 }, (_, k) => Math.PI / 2 - (Math.PI * k) / NB)
  const section = (i: number) => [teTop(i), ...phis.map((p) => nosePt(i, p)), teBot(i)]
  const secs = st.map((_, i) => section(i))

  // Silhouette: every panel between two stations is convex.
  const hulls: Pt[][] = []
  for (let i = 0; i < st.length - 1; i++) hulls.push(hull(s.pp([...secs[i], ...secs[i + 1]])))
  for (const hp of hulls) s.poly2(hp, 'none', line, 2 * width)
  s.area(hulls, ramp.dark)

  const idx = st.map((_, i) => i)
  const quadStrip = (a: (i: number) => P3, b: (i: number) => P3, n: P3) => {
    if (!facing(n)) return
    s.poly([...idx.map(a), ...[...idx].reverse().map(b)], toneOf(n, ramp), 'none')
  }
  // Mean span direction, for normals of the strips and the caps.
  const span = unit(sub(st[st.length - 1].le, st[0].le))
  const mid = frames[Math.floor((st.length - 1) / 2)]
  // Lower skin (when it faces the viewer), trailing edge, nose strips, upper skin.
  quadStrip((i) => nosePt(i, -Math.PI / 2), teBot, mul(mid.n, -1))
  quadStrip(teTop, teBot, mid.c)
  for (let k = NB - 1; k >= 0; k--) {
    const pm = (phis[k] + phis[k + 1]) / 2
    const nn = unit(add(mul(mid.c, -Math.cos(pm)), mul(mid.n, Math.sin(pm))))
    quadStrip(
      (i) => nosePt(i, phis[k]),
      (i) => nosePt(i, phis[k + 1]),
      unit(sub(nn, mul(span, dot(nn, span)))),
    )
  }
  quadStrip((i) => nosePt(i, Math.PI / 2), teTop, mid.n)
  if (facing(mid.n))
    s.line(
      idx.map((i) => nosePt(i, Math.PI / 2)),
      crease,
      0.6 * width,
    )
  // End caps.
  for (const [i, dir] of [
    [0, -1],
    [st.length - 1, 1],
  ] as const) {
    const n = mul(span, dir)
    if (facing(n)) s.poly(secs[i], toneOf(n, ramp), crease, undefined, 0.6 * width)
  }

  const topAt = (i: number, f: number): P3 => {
    const i0 = Math.max(0, Math.min(st.length - 2, Math.floor(i))),
      p = (j: number) => mix(nosePt(j, Math.PI / 2), teTop(j), f)
    return mix(p(i0), p(i0 + 1), i - i0)
  }
  return {
    top: topAt,
    line(i0, f0, i1, f1, paint = crease, w = 0.6 * width) {
      s.line([topAt(i0, f0), topAt(i1, f1)], paint, w)
    },
  }
}

// ---------------------------------------------------------------- dials, knurls and cables

/**
 * Radial ticks on the plane through `c` spanned by unit `U` and `V`: `count` steps over `span` radians from `from` (measured from U towards V).
 * Each tick is rooted on radius `r` and runs towards the centre by its length (a negative length grows outward); every `every`-th tick is major.
 * Returns the segments so the caller picks paints: `s.segs(t.minor, …)`, `s.segs(t.major, …)`.
 */
export function radialTicks(
  c: P3,
  U: P3,
  V: P3,
  r: number,
  count: number,
  every: number,
  lengths: readonly [number, number],
  o: { from?: number; span?: number } = {},
): { minor: P3[][]; major: P3[][] } {
  const from = o.from ?? 0,
    span = o.span ?? 2 * Math.PI
  const closed = Math.abs(span - 2 * Math.PI) < 1e-9
  const minor: P3[][] = [],
    major: P3[][] = []
  for (let i = 0; i < (closed ? count : count + 1); i++) {
    const a = from + (span * i) / count,
      big = i % every === 0,
      r1 = r - (big ? lengths[1] : lengths[0])
    const at = (rr: number) => comb(c, [rr * Math.cos(a), U], [rr * Math.sin(a), V])
    ;(big ? major : minor).push([at(r), at(r1)])
  }
  return { minor, major }
}

/** Knurl lines along a turned body from station `s0` to `s1` (put seams there so they end on something): `count` round the full turn, only those on the visible half and `margin` degrees clear of its limbs. */
export function knurl(
  b: Body,
  s0: number,
  s1: number,
  count: number,
  paint: Paint = 'crease',
  width = 0.5,
  margin = 12,
) {
  const lim = b.limbs((s0 + s1) / 2)
  if (!lim) return
  const step = 360 / count
  for (let a = Math.ceil((lim[0] + margin) / step) * step; a <= lim[1] - margin; a += step)
    b.along(a, s0, s1, paint, width)
}

/**
 * A round flexible part (a cable, a hose) of radius `r` through `path`, a polyline already sampled finely along a smooth curve.
 * Drawn like a lathe's silhouette (stroked hulls of consecutive rings, filled over as one area, so no joins show) with a light stripe along the side that faces the light. No end discs: start and end it inside or under the parts it joins.
 */
export function pipe(
  s: Scene,
  path: readonly P3[],
  r: number,
  o: {
    ring?: number
    fill?: Paint
    light?: Paint
    line?: Paint
    width?: number
    stripe?: boolean
  } = {},
) {
  const M = o.ring ?? 16,
    width = o.width ?? 1,
    n = path.length
  const frames = path.map((p, i) =>
    frameAlong(p, sub(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)])),
  )
  const rings = frames.map((F) =>
    s.pp(
      Array.from({ length: M }, (_, j) => {
        const a = (j / M) * 2 * Math.PI
        return comb(F.o, [r * Math.cos(a), F.u], [r * Math.sin(a), F.v])
      }),
    ),
  )
  const hulls: Pt[][] = []
  for (let i = 0; i < n - 1; i++) hulls.push(hull([...rings[i], ...rings[i + 1]]))
  for (const hp of hulls) s.poly2(hp, 'none', o.line ?? 'line', 2 * width)
  s.area(hulls, o.fill ?? 'front')
  if (o.stripe === false || s.str([[0, 0]]) === '') return
  const side = (sign: number) =>
    frames.map((F) => {
      const a = Math.atan2(dot(F.v, LIGHT), dot(F.u, LIGHT)) + (sign * 38 * Math.PI) / 180
      return comb(F.o, [r * Math.cos(a), F.u], [r * Math.sin(a), F.v])
    })
  s.poly([...side(-1), ...side(1).reverse()], o.light ?? 'top', 'none')
}

// ---------------------------------------------------------------- bars

/**
 * A straight bar of rectangular section from `a` to `b` (ladder rails, legs, braces): `w` across the frame's u, `d` across its v (v as close to `up` as the axis allows).
 * Drawn like the Scene's boxes: each face that looks at the viewer in its own tone, creases between them, then one silhouette.
 */
export function beam(
  s: Scene,
  a: P3,
  b: P3,
  w: number,
  d: number,
  o: { up?: P3; ramp?: Ramp; line?: Paint; crease?: Paint; width?: number } = {},
) {
  const F = frameAlong(a, sub(b, a), o.up)
  const L = len(sub(b, a)),
    ramp = o.ramp ?? GREY,
    width = o.width ?? 1
  const c = (t: number, su: number, sv: number): P3 =>
    comb(a, [t, F.a], [(su * w) / 2, F.u], [(sv * d) / 2, F.v])
  const faces: [P3, P3[]][] = [
    [F.u, [c(0, 1, -1), c(L, 1, -1), c(L, 1, 1), c(0, 1, 1)]],
    [mul(F.u, -1), [c(0, -1, -1), c(0, -1, 1), c(L, -1, 1), c(L, -1, -1)]],
    [F.v, [c(0, -1, 1), c(0, 1, 1), c(L, 1, 1), c(L, -1, 1)]],
    [mul(F.v, -1), [c(0, -1, -1), c(L, -1, -1), c(L, 1, -1), c(0, 1, -1)]],
    [F.a, [c(L, -1, -1), c(L, -1, 1), c(L, 1, 1), c(L, 1, -1)]],
    [mul(F.a, -1), [c(0, -1, -1), c(0, 1, -1), c(0, 1, 1), c(0, -1, 1)]],
  ]
  for (const [n, pts] of faces)
    if (facing(n)) s.poly(pts, toneOf(n, ramp), o.crease ?? 'crease', undefined, 0.6 * width)
  const corners: P3[] = []
  for (const t of [0, L])
    for (const su of [-1, 1]) for (const sv of [-1, 1]) corners.push(c(t, su, sv))
  s.poly2(hull(s.pp(corners)), 'none', o.line ?? 'line', width)
}

// ---------------------------------------------------------------- stamps

/**
 * Draws `draw` once and returns a stamp that repeats it moved by (x, y) on the floor, for many identical parts (posts, bollards).
 * The projection is linear, so a moved copy is the same drawing shifted on screen: the stamp records the Scene calls `draw` makes on a
 * scratch Scene at the same scale and replays them through `s` with every point moved, so bounds, shadows and fit probes work as if
 * each copy were drawn from scratch, at a fraction of the cost. `draw` may use poly, poly2, area, line and segs (everything the turned
 * parts above use), not glow, group or text.
 */
export function stamp(s: Scene, draw: (r: Scene) => void): (x: number, y: number) => void {
  type Op = (dx: number, dy: number, v: Pt) => void
  const ops: Op[] = []
  const m3 = (pts: readonly P3[], dx: number, dy: number) =>
    pts.map(([a, b, c]): P3 => [a + dx, b + dy, c])
  const m2 = (pts: readonly Pt[], v: Pt) => pts.map(([a, b]): Pt => [a + v[0], b + v[1]])
  class Recorder extends (s.constructor as typeof Scene) {
    poly(...[pts, ...rest]: Parameters<Scene['poly']>) {
      ops.push((dx, dy) => s.poly(m3(pts, dx, dy), ...rest))
    }
    poly2(...[pts, ...rest]: Parameters<Scene['poly2']>) {
      ops.push((_x, _y, v) => s.poly2(m2(pts, v), ...rest))
    }
    area(...[polys, fill]: Parameters<Scene['area']>) {
      ops.push((_x, _y, v) =>
        s.area(
          polys.map((p) => m2(p, v)),
          fill,
        ),
      )
    }
    line(...[pts, ...rest]: Parameters<Scene['line']>) {
      ops.push((dx, dy) => s.line(m3(pts, dx, dy), ...rest))
    }
    segs(...[list, ...rest]: Parameters<Scene['segs']>) {
      ops.push((dx, dy) =>
        s.segs(
          list.map((seg) => m3(seg, dx, dy)),
          ...rest,
        ),
      )
    }
    glow(): never {
      throw new Error('stamp: glow is not recorded')
    }
    group(): never {
      throw new Error('stamp: group is not recorded')
    }
    text(): never {
      throw new Error('stamp: text is not recorded')
    }
  }
  draw(new Recorder(s.k))
  return (x, y) => {
    const v = s.project([x, y, 0])
    for (const op of ops) op(x, y, v)
  }
}

/** A stable 0–1 jitter for an index. */
export const hash = (n: number) => ((((n + 1) * 2654435761) >>> 0) % 1000) / 1000

/** Keeps the part of a polygon where f(p) ≥ 0, for a linear f (one Sutherland–Hodgman pass). */
export function cutBy(poly: readonly Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = []
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]
    const a = f(p),
      b = f(q)
    if (a >= 0) out.push(p)
    if (a >= 0 !== b >= 0) {
      const t = a / (a - b)
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
    }
  })
  return out
}

/** Clips a polygon to a convex one in screen space. */
export function clipTo(subject: readonly Pt[], clip: readonly Pt[]): Pt[] {
  let area = 0
  for (let i = 0; i < clip.length; i++) {
    const p = clip[i],
      q = clip[(i + 1) % clip.length]
    area += p[0] * q[1] - q[0] * p[1]
  }
  const sg = Math.sign(area)
  let out: Pt[] = [...subject]
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i],
      b = clip[(i + 1) % clip.length]
    out = cutBy(out, (p) => sg * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])))
  }
  return out
}
