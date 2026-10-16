import { hull, roundRect, Scene, type P3, type Paint, type Pt } from '../../../overview/iso/scene'
import { rrOn, shadowRect, X, Y } from '../../../overview/iso/solids'
import {
  add,
  comb,
  cross,
  dot,
  facing,
  frameAlong,
  knurl,
  lathe,
  mix,
  mul,
  pipe,
  radialTicks,
  screw,
  spline,
  sub,
  toneOf,
  unit,
} from './parts'
import type { LadderFigureDef } from './types'

// Airports: a radar scope unit. A heavy console on rubber feet with a sloped deck; a square bezel plate holds a round CRT
// recessed under a visor, with range rings, an azimuth tick ring, a sweep and its afterglow. Knurled knobs, a pilot lamp
// and toggles sit on the strip in front; a cable leaves a gland on the side. Rung = blips on the glass; from rung 3 one
// flies a holding pattern. The newest blip is lit (rung 3: the holding blip and the head of its trail; rung 5: a sticky
// note on the bezel, the glass too crowded to read).

const Z: P3 = [0, 0, 1]
const D2R = Math.PI / 180

/** Housing: x 0..W, y 0..D on feet Z0 tall; the deck slopes down towards +y from ZB; BEV is the chamfer on its visible top edges. */
const W = 96,
  D = 100,
  ZB = 40,
  SLOPE = 0.2,
  Z0 = 4,
  BEV = 1.8
const top = (y: number) => ZB - SLOPE * y
/** Deck axes: V runs down the slope, N is its normal. */
const V: P3 = unit([0, 1, -SLOPE]),
  N: P3 = unit([0, SLOPE, 1])
/** A point on the deck above (x, y), lifted l along its normal. */
const dk = (x: number, y: number, l = 0): P3 => [x, y + l * N[1], top(y) + l * N[2]]

/** The scope: centre on the deck, bezel plate (half side, thickness), turned ring, opening and glass. */
const CX = (W - BEV) / 2,
  CY = 40,
  HS = 37.5,
  PT = 2.4,
  RING = 1.8,
  RT = PT + RING,
  R_RING = 33.6,
  R_TOP = 32.8,
  R_SCALE = 32.3,
  R_OPEN = 30,
  R_GLASS = 28.4,
  DEPTH = 3
/** A point in the scope's frame: (u, v) on the deck round the scope centre, l along the normal. */
const sp = (u: number, v: number, l = 0): P3 => comb(dk(CX, CY), [u, X], [v, V], [l, N])
/** The control strip: its seam, and the row the knobs and toggles stand on. */
const YS = 80,
  KY = 89

/** The holding pattern: a racetrack on the far side of the glass (straights 2a long, ends of radius b). */
const OVAL = { cx: -7, cy: -6, a: 8, b: 6.5, turn: 28 * D2R }
const oval = (t: number): Pt => {
  const half = 2 * OVAL.a,
    arc = Math.PI * OVAL.b,
    len = 2 * half + 2 * arc
  let d = (((t % 1) + 1) % 1) * len,
    x: number,
    y: number
  if (d < half) [x, y] = [-OVAL.a + d, -OVAL.b]
  else if ((d -= half) < arc) {
    const g = -Math.PI / 2 + d / OVAL.b
    ;[x, y] = [OVAL.a + OVAL.b * Math.cos(g), OVAL.b * Math.sin(g)]
  } else if ((d -= arc) < half) [x, y] = [OVAL.a - d, OVAL.b]
  else {
    const g = Math.PI / 2 + (d - half) / OVAL.b
    ;[x, y] = [-OVAL.a + OVAL.b * Math.cos(g), OVAL.b * Math.sin(g)]
  }
  const c = Math.cos(OVAL.turn),
    sn = Math.sin(OVAL.turn)
  return [OVAL.cx + x * c - y * sn, OVAL.cy + x * sn + y * c]
}

/** Blips off the holding pattern, seeded so a longer prefix only adds blips; each has a heading its echoes trail behind. */
type Blip = { x: number; y: number; dx: number; dy: number }
const BLIPS: Blip[] = []
{
  const track = Array.from({ length: 60 }, (_, i) => oval(i / 60))
  let seed = 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  while (BLIPS.length < 30) {
    const ang = rnd() * 2 * Math.PI,
      rad = 4.5 + 18.5 * Math.sqrt(rnd())
    const x = rad * Math.cos(ang),
      y = rad * Math.sin(ang)
    // Keep the near-left of the glass clear for the first rungs: that is where the top rung's note lands.
    if (BLIPS.length < 10 && Math.hypot(x + 15, y - 17) < 10) continue
    if (track.some(([a, b]) => Math.hypot(x - a, y - b) < 5.5)) continue
    if (BLIPS.some((o) => Math.hypot(x - o.x, y - o.y) < 5.8)) continue
    const h = rnd() * 2 * Math.PI
    BLIPS.push({ x, y, dx: Math.cos(h), dy: Math.sin(h) })
  }
}
/** Blips on the glass per rung, not counting the one in the holding pattern. */
const COUNT = [1, 4, 6, 10, 26]
/** The sweep's bearing on the glass, and how far its afterglow trails. */
const SWEEP = -38 * D2R,
  FAN = 62 * D2R

/** Keeps the part of a polygon where f(p) ≥ 0, for a linear f (one Sutherland–Hodgman pass). */
function cutBy(poly: readonly Pt[], f: (p: Pt) => number): Pt[] {
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
function clipTo(subject: readonly Pt[], clip: readonly Pt[]): Pt[] {
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

/** A flat plane in the world: O + u·U + v·V + w·N (N = U × V points out of the face). */
type Plane = { O: P3; U: P3; V: P3; N: P3 }
const onPlane =
  (F: Plane) =>
  (u: number, v: number, w = 0): P3 =>
    comb(F.O, [u, F.U], [v, F.V], [w, F.N])

/** Runs of consecutive facets that share a tone, as index lists (each run ends one past its last facet). */
function toneRuns(tone: readonly (Paint | null)[]): [Paint, number[]][] {
  const m = tone.length,
    out: [Paint, number[]][] = []
  for (let i = 0; i < m; i++) {
    const t = tone[i]
    if (!t || tone[(i + m - 1) % m] === t) continue
    const run = [i]
    while (run.length < m && tone[(run[run.length - 1] + 1) % m] === t)
      run.push((run[run.length - 1] + 1) % m)
    out.push([t, [...run, (run[run.length - 1] + 1) % m]])
  }
  return out
}

/**
 * A rounded-rectangle plate standing `t` proud of plane F, with a 45° bevel `bev` round its top: walls, bevel and top each shaded by facing.
 * Returns a mapper onto its top face.
 */
function plate(
  s: Scene,
  F: Plane,
  x: number,
  y: number,
  w: number,
  d: number,
  r: number,
  t: number,
  bev: number,
  hero: boolean,
) {
  const at = onPlane(F)
  const fp = roundRect(x, y, w, d, r),
    fi = roundRect(x + bev, y + bev, w - 2 * bev, d - 2 * bev, r - bev)
  const m = fp.length
  const B = fp.map(([u, v]) => at(u, v)),
    M = fp.map(([u, v]) => at(u, v, t - bev)),
    T = fi.map(([u, v]) => at(u, v, t))
  const out = fp.map(([u0, v0], i) => {
    const [u1, v1] = fp[(i + 1) % m]
    return unit(comb([0, 0, 0], [v1 - v0, F.U], [u0 - u1, F.V]))
  })
  const band = (lo: P3[], hi: P3[], normal: (i: number) => P3) => {
    for (const [tone, run] of toneRuns(
      out.map((_, i) => (facing(normal(i)) ? toneOf(normal(i)) : null)),
    ))
      s.poly([...run.map((j) => lo[j]), ...[...run].reverse().map((j) => hi[j])], tone, 'none')
  }
  band(B, M, (i) => out[i])
  if (hero) band(M, T, (i) => unit(add(out[i], F.N)))
  s.poly(T, 'top', 'crease', undefined, 0.6)
  if (hero)
    s.segs(
      out.flatMap((n, i) => (facing(n) ? [[M[i], M[(i + 1) % m]]] : [])),
      'crease',
      0.5,
    )
  s.poly2(hull(s.pp([...B, ...T])), 'none', 'line')
  return (u: number, v: number, w = 0) => at(u, v, t + w)
}

export const airports: LadderFigureDef = {
  id: 'airports',
  rungs: 5,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    const circ = (
      c: P3,
      U: P3,
      Vv: P3,
      r: number,
      n: number,
      a0 = 0,
      a1 = 2 * Math.PI,
      closed = true,
    ): P3[] =>
      Array.from({ length: closed ? n : n + 1 }, (_, i) => {
        const a = a0 + ((a1 - a0) * i) / n
        return comb(c, [r * Math.cos(a), U], [r * Math.sin(a), Vv])
      })

    // ---------------------------------------------------------------- housing (hero)
    if (hero) {
      shadowRect(s, 0, 0, W, D, 5)

      // Rubber feet under the three corners that show, far to near.
      for (const [x, y] of [
        [W - 5, 5],
        [5, D - 5],
        [W - 5, D - 5],
      ]) {
        const prof = spline([
          [0, 3.1],
          [0.5, 3.5],
          [Z0, 3.7],
        ])
        lathe(s, frameAlong([x, y, 0], Z), (t) => ({ r: prof(t)[0] }), 0, Z0, {
          steps: 3,
          ring: 28,
          shade: true,
          tint: 'shade',
          caps: false,
        })
      }

      // The shell: side (+x) and front (+y) walls, the chamfered vertical corner, chamfers along both top edges, the deck.
      const yb = D - BEV,
        xb = W - BEV
      const face = (pts: P3[], paint?: Paint) => {
        const n = unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])))
        s.poly(
          pts,
          paint ?? toneOf(dot(n, [1, 1, 1]) < 0 ? mul(n, -1) : n),
          'crease',
          undefined,
          0.6,
        )
      }
      face(
        [
          [W, 0, Z0],
          [W, yb, Z0],
          [W, yb, top(yb) - BEV],
          [W, 0, top(0) - BEV],
        ],
        'side',
      )
      face(
        [
          [0, D, Z0],
          [xb, D, Z0],
          [xb, D, top(D) - BEV],
          [0, D, top(D) - BEV],
        ],
        'front',
      )
      face(
        [
          [W, yb, Z0],
          [xb, D, Z0],
          [xb, D, top(D) - BEV],
          [W, yb, top(yb) - BEV],
        ],
        'front',
      )
      face(
        [
          [xb, 0, top(0)],
          [xb, yb, top(yb)],
          [W, yb, top(yb) - BEV],
          [W, 0, top(0) - BEV],
        ],
        'front',
      )
      face(
        [
          [0, yb, top(yb)],
          [xb, yb, top(yb)],
          [xb, D, top(D) - BEV],
          [0, D, top(D) - BEV],
        ],
        'top',
      )
      face(
        [
          [xb, yb, top(yb)],
          [W, yb, top(yb) - BEV],
          [xb, D, top(D) - BEV],
        ],
        'front',
      )
      face(
        [
          [0, 0, top(0)],
          [xb, 0, top(0)],
          [xb, yb, top(yb)],
          [0, yb, top(yb)],
        ],
        'top',
      )
      s.poly2(
        hull(
          s.pp([
            [0, 0, top(0)],
            [W, 0, top(0) - BEV],
            [W, 0, Z0],
            [W, yb, Z0],
            [xb, D, Z0],
            [0, D, Z0],
            [0, D, top(D) - BEV],
          ]),
        ),
        'none',
        'line',
      )

      // Kick-plate seam round both walls, and one panel joint on each.
      const zk = Z0 + 3.2
      s.line(
        [
          [0, D, zk],
          [xb, D, zk],
          [W, yb, zk],
          [W, 0, zk],
        ],
        'crease',
        0.6,
      )
      s.line(
        [
          [44, D, zk],
          [44, D, top(D) - BEV],
        ],
        'crease',
        0.6,
      )
      s.line(
        [
          [W, 47, zk],
          [W, 47, top(47) - BEV],
        ],
        'crease',
        0.6,
      )

      // Front wall: a vent grille and a label plate with rule lines for print and four screws.
      for (let i = 0; i < 4; i++)
        s.poly(
          rrOn(s, [0, D + 0.02, 0], X, Z, 8, 8.4 + i * 2.3, 26, 1.1, 0.55),
          'shade',
          'crease',
          undefined,
          0.4,
        )
      const front: Plane = { O: [0, D, 0], U: X, V: [0, 0, -1], N: Y }
      const lp = plate(s, front, 52, -15.4, 32, 7.6, 1, 0.6, 0.25, hero)
      for (const [i, len] of [22, 15, 19].entries())
        s.line([lp(55, -13.4 + i * 1.8), lp(55 + len, -13.4 + i * 1.8)], 'crease', 0.6)
      for (const [u, v] of [
        [53.6, -14],
        [82.4, -14],
        [53.6, -9.2],
        [82.4, -9.2],
      ])
        screw(s, lp(u, v), Y, 0.4)

      // Side wall: a data plate and a cable gland on the rear panel, a vent grille on the front one.
      const side: Plane = { O: [W, 0, 0], U: Y, V: Z, N: X }
      const dp = plate(s, side, 18, 16, 22, 9, 1, 0.6, 0.25, hero)
      for (const [i, len] of [16, 11, 14].entries())
        s.line([dp(21, 22.4 - i * 1.9), dp(21 + len, 22.4 - i * 1.9)], 'crease', 0.6)
      for (const [u, v] of [
        [19.5, 17.5],
        [38.5, 17.5],
        [19.5, 23.5],
        [38.5, 23.5],
      ])
        screw(s, dp(u, v), X, 0.4)
      for (let i = 0; i < 4; i++)
        s.poly(
          rrOn(s, [W + 0.02, 0, 0], Y, Z, 54, 8.4 + i * 2.3, 28, 1.1, 0.55),
          'shade',
          'crease',
          undefined,
          0.4,
        )

      // Cable gland: a hex nut and a domed cap; the cable loops down to the floor and back under the console.
      const yg = 11,
        zg = 12
      lathe(s, frameAlong([W, yg, zg], X), () => ({ r: 2.4 }), 0, 1.1, {
        steps: 1,
        ring: 6,
        shade: true,
      })
      const cap = spline([
        [0, 2],
        [1.3, 1.9],
        [2, 1.55],
        [2.4, 1.15],
      ])
      lathe(s, frameAlong([W + 1.1, yg, zg], X), (t) => ({ r: cap(t)[0] }), 0, 2.4, {
        steps: 6,
        ring: 20,
        shade: true,
      })
      const route = spline([
        [0, W + 3.3, yg, zg],
        [1, W + 6.5, yg + 0.3, zg - 1],
        [2, W + 9.5, yg + 1, zg - 4.5],
        [3, W + 11, yg + 2, 3.5],
        [4, W + 11, yg + 4, 1],
        [5, W + 8, yg + 8, 1],
        [6, W + 4, yg + 11, 1],
        [7, W - 0.3, yg + 13, 1],
        [8, W - 10, yg + 15, 1],
      ])
      const cable = Array.from({ length: 65 }, (_, i) => route((i / 64) * 8) as unknown as P3)
      // A contact shadow under the run that lies on the floor.
      const lying = cable.filter((p) => p[2] < 1.6)
      const off = (sg: number) =>
        lying.map((p, i): P3 => {
          const q = lying[Math.min(lying.length - 1, i + 1)],
            o = lying[Math.max(0, i - 1)]
          const t = unit([q[0] - o[0], q[1] - o[1], 0])
          return [p[0] - sg * 1.7 * t[1], p[1] + sg * 1.7 * t[0], 0]
        })
      // Where the cable passes under the console it goes out of sight: everything left of that point on screen is clipped.
      const [xc, yc] = [W - 4, yg + 13.8]
      s.group(
        'cable',
        () => {
          s.poly([...off(1), ...off(-1).reverse()], 'shadow', 'none')
          pipe(s, cable, 1, { ring: 14, fill: 'front' })
        },
        {
          clip: [
            [xc, yc, 300],
            [xc, yc, -300],
            [xc + 400, yc, 300],
            [xc + 400, yc, -300],
          ],
        },
      )

      // Deck: the seam that frames the control strip, and screws at the panel corners.
      s.line([dk(0, YS, 0.02), dk(xb, YS, 0.02)], 'crease', 0.7)
      s.line([dk(0, YS + 1, 0.02), dk(xb, YS + 1, 0.02)], 'detail', 0.6)
      for (const [x, y] of [
        [4, 4],
        [xb - 4, 4],
        [4, YS + 4],
        [xb - 4, YS + 4],
        [4, yb - 3.6],
        [xb - 4, yb - 3.6],
      ])
        screw(s, dk(x, y, 0.02), N, 0.45, { ring: 1 })

      // Bezel plate with a corner screw at each corner.
      const deck: Plane = { O: dk(CX, CY), U: X, V, N }
      const bz = plate(s, deck, -HS, -HS, 2 * HS, 2 * HS, 5, PT, 1, hero)
      for (const [u, v] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ])
        screw(s, bz(u * (HS - 4.4), v * (HS - 4.4), 0.02), N, 0.55, { ring: 1.3 })

      // The visor: a curved shade over the far half of the scope, tapering into the plate at both ends.
      const RV = 34.4,
        TV = 1.5,
        HV = 8,
        C0 = -135 * D2R,
        HALF = 70 * D2R,
        nv = 40
      const ids = Array.from({ length: nv + 1 }, (_, i) => C0 - HALF + (2 * HALF * i) / nv)
      const hv = (a: number) =>
        HV * Math.max(0, Math.cos((Math.PI / 2) * ((a - C0) / HALF))) ** 0.75
      const vat = (r: number, a: number, l: number) => sp(r * Math.cos(a), r * Math.sin(a), PT + l)
      const foot = ids.map((a) => vat(RV, a, 0)),
        lipIn = ids.map((a) => vat(RV, a, hv(a))),
        lipOut = ids.map((a) => vat(RV + TV * Math.sqrt(hv(a) / HV), a, hv(a)))
      s.poly([...foot, ...[...lipIn].reverse()], 'side', 'none')
      // Inside the shade it darkens towards the plate.
      for (const f of [0.6, 0.3])
        s.poly(
          [...foot, ...[...ids].reverse().map((a) => vat(RV, a, hv(a) * f))],
          'shade',
          'none',
          undefined,
          undefined,
          0.35,
        )
      s.line(foot, 'crease', 0.6)
      s.poly([...lipIn, ...[...lipOut].reverse()], 'top', 'none')
      s.line(lipIn, 'crease', 0.6)
      s.line(lipOut, 'line', 1)
    }

    // ---------------------------------------------------------------- the scope
    const ringN = hero ? 72 : 40
    const prof = spline([
      [0, R_RING],
      [1.0, R_RING],
      [1.5, R_RING - 0.3],
      [RING, R_TOP],
    ])
    lathe(s, frameAlong(sp(0, 0, PT), N), (t) => ({ r: prof(t)[0] }), 0, RING, {
      steps: hero ? 6 : 2,
      ring: ringN,
      shade: hero,
    })
    if (hero) {
      // Azimuth ring: a printed circle with ticks every 5°, longer every 30°, hanging inward towards the opening.
      const c = sp(0, 0, RT + 0.01)
      s.poly(circ(c, X, V, R_SCALE, ringN), 'none', 'crease', undefined, 0.5)
      const t = radialTicks(c, X, V, R_SCALE, 72, 6, [0.8, 1.7])
      s.segs(t.minor, 'crease', 0.5)
      s.segs(t.major, 'line', 0.7)
    }

    // The recess: the opening in the ring, its inner wall shaded by facing, and the glass at the bottom.
    const openPts = circ(sp(0, 0, RT), X, V, R_OPEN, ringN)
    const lowPts = circ(sp(0, 0, RT - DEPTH), X, V, R_GLASS, ringN)
    {
      const open = s.pp(openPts),
        low = s.pp(lowPts),
        axis = sp(0, 0, RT - DEPTH / 2),
        m = openPts.length
      s.poly2(open, 'side', 'none')
      const tone = openPts.map((p, i) => {
        const q = openPts[(i + 1) % m]
        let n = unit(cross(sub(q, p), sub(lowPts[i], p)))
        if (dot(n, sub(axis, mix(p, q, 0.5))) < 0) n = mul(n, -1)
        return facing(n) ? toneOf(n) : null
      })
      if (hero)
        for (const [paint, run] of toneRuns(tone)) {
          const strip = clipTo(
            [...run.map((j) => open[j]), ...[...run].reverse().map((j) => low[j])],
            open,
          )
          if (strip.length > 2) s.poly2(strip, paint, 'none')
        }
      const floor = clipTo(low, open)
      if (floor.length > 2) s.poly2(floor, 'glass', hero ? 'crease' : 'none', 0.5)
    }

    // On the glass, clipped to the opening so nothing shows past the rim.
    const GL = RT - DEPTH + 0.02
    const g = (x: number, y: number): P3 => sp(x, y, GL)
    const gc = sp(0, 0, GL)
    const dotAt = (x: number, y: number, r: number, paint: Paint, op?: number) =>
      s.poly(circ(g(x, y), X, V, r, hero ? 12 : 10), paint, 'none', undefined, undefined, op)
    const br = hero ? 1.25 : 3.2
    const holding = rung >= 3
    const N_TRAIL = hero ? 40 : 22,
      headRuns = rung === 3 ? (hero ? 12 : 8) : 0
    // The holding pattern's trail: solid, each short run fainter and thinner than the one before it.
    // A ribbon painted on the glass, cut into short runs that share their ends exactly, so it never beads or reads as dashed.
    const edge = (i: number, side: number): P3 => {
      const f = i / N_TRAIL,
        [x, y] = oval(-f * 0.96),
        [x0, y0] = oval(-((i - 1) / N_TRAIL) * 0.96),
        [x1, y1] = oval(-((i + 1) / N_TRAIL) * 0.96)
      const l = Math.hypot(x1 - x0, y1 - y0) || 1,
        w = (hero ? 0.42 : 1) * (1 - 0.55 * f) * side
      return g(x - ((y1 - y0) / l) * w, y + ((x1 - x0) / l) * w)
    }
    const run = (i: number, paint: 'line' | 'accent') => {
      const op = 0.9 * (1 - i / N_TRAIL) ** 1.15
      if (op < 0.02) return
      s.poly(
        [edge(i, 1), edge(i + 1, 1), edge(i + 1, -1), edge(i, -1)],
        paint,
        'none',
        undefined,
        undefined,
        Math.round(op * 1000) / 1000,
      )
    }
    // A blip and, on the hero, two echoes behind it along its track, each smaller and fainter.
    const blip = (b: Blip, paint: 'ink' | 'accent', grow = 0) => {
      if (hero)
        for (const [j, op] of [
          [2, 0.2],
          [1, 0.42],
        ])
          dotAt(b.x - b.dx * j * 2.5, b.y - b.dy * j * 2.5, (br + grow) * (1 - j * 0.24), paint, op)
      dotAt(b.x, b.y, br + grow, paint)
    }
    const [hx, hy] = oval(0)
    const litIdx = rung === 1 || rung === 2 || rung === 4 ? COUNT[rung - 1] - 1 : -1

    s.group(
      'scope',
      () => {
        if (hero) {
          for (const r of [8, 16, 24])
            s.poly(circ(gc, X, V, r, 48), 'none', 'detail', undefined, 0.6)
          s.segs(
            [0, 90, 180, 270].map((d) => [
              g(1.6 * Math.cos(d * D2R), 1.6 * Math.sin(d * D2R)),
              g(24 * Math.cos(d * D2R), 24 * Math.sin(d * D2R)),
            ]),
            'detail',
            0.5,
          )
          // Phosphor afterglow: overlapping fans behind the sweep, so it fades the further it trails.
          for (let i = 1; i <= 12; i++) {
            const span = (FAN * i) / 12
            s.poly(
              [gc, ...circ(gc, X, V, R_GLASS + 1, 16, SWEEP - span, SWEEP, false)],
              'ink',
              'none',
              undefined,
              undefined,
              0.024,
            )
          }
        } else s.poly(circ(gc, X, V, 15, 32), 'none', 'detail', undefined, 1)

        if (holding) for (let i = headRuns; i < N_TRAIL; i++) run(i, 'line')
        BLIPS.slice(0, COUNT[rung - 1]).forEach((b, i) => {
          if (i !== litIdx) blip(b, 'ink')
        })
        if (holding && rung !== 3) {
          dotAt(hx, hy, br + 0.5, 'ink')
          if (hero) s.poly(circ(g(hx, hy), X, V, br + 2.2, 16), 'none', 'line', 0.6, 0.6)
        }

        if (rung < 5)
          s.group('lit', () => {
            if (rung === 3) for (let i = 0; i < headRuns; i++) run(i, 'accent')
            s.glow(hero ? 2.5 : 2, () => {
              if (litIdx >= 0) dotAt(BLIPS[litIdx].x, BLIPS[litIdx].y, br + 0.4, 'accent')
              if (rung === 3) dotAt(hx, hy, br + 0.9, 'accent')
            })
            if (litIdx >= 0) blip(BLIPS[litIdx], 'accent', 0.4)
            if (rung === 3) {
              dotAt(hx, hy, br + 0.9, 'accent')
              if (hero) s.poly(circ(g(hx, hy), X, V, br + 2.4, 16), 'none', 'accent', 0.8, 0.7)
            }
          })

        // The sweep, rooted on the hub.
        const tip = g((R_GLASS + 1) * Math.cos(SWEEP), (R_GLASS + 1) * Math.sin(SWEEP))
        s.line([gc, tip], hero ? 'ink' : 'crease', hero ? 0.9 : 1.2)
        if (hero) {
          s.poly(circ(gc, X, V, 1.7, 16), 'glass', 'crease', undefined, 0.5)
          s.poly(circ(gc, X, V, 0.8, 10), 'ink', 'none')
        }
      },
      { clip: openPts },
    )
    s.poly(openPts, 'none', 'crease', undefined, hero ? 0.8 : 1)

    // ---------------------------------------------------------------- controls (hero)
    if (hero) {
      // Knurled knobs over printed 270° scales, pointers rooted on a hub dot.
      for (const [kx, ang] of [
        [13, 200],
        [28, 300],
        [43, 20],
      ]) {
        const sc = dk(kx, KY, 0.02)
        s.line(circ(sc, X, V, 6.2, 30, 135 * D2R, 405 * D2R, false), 'crease', 0.5)
        const t = radialTicks(sc, X, V, 6.2, 10, 5, [-0.8, -1.5], {
          from: 135 * D2R,
          span: 270 * D2R,
        })
        s.segs(t.minor, 'crease', 0.5)
        s.segs(t.major, 'line', 0.6)
        lathe(s, frameAlong(dk(kx, KY), N), () => ({ r: 5.1 }), 0, 0.9, {
          steps: 1,
          ring: 36,
          shade: true,
        })
        const kp = spline([
          [0, 4.25],
          [3.1, 4.15],
          [3.7, 3.85],
          [4.2, 3.3],
        ])
        const knob = lathe(s, frameAlong(dk(kx, KY, 0.9), N), (u) => ({ r: kp(u)[0] }), 0, 4.2, {
          steps: 10,
          ring: 36,
          shade: true,
        })
        knob.seam(0.25)
        knob.seam(3.1)
        knurl(knob, 0.25, 3.1, 32)
        const capC = dk(kx, KY, 5.12)
        const a = ang * D2R
        s.line([capC, comb(capC, [2.9 * Math.cos(a), X], [2.9 * Math.sin(a), V])], 'line', 1)
        s.poly(circ(capC, X, V, 0.55, 8), 'line', 'none')
      }

      // Pilot lamp: a turned bezel and a domed lens, unlit.
      lathe(s, frameAlong(dk(56, KY), N), () => ({ r: 2.5 }), 0, 1, {
        steps: 1,
        ring: 24,
        shade: true,
      })
      const lens = spline([
        [0, 1.75],
        [0.5, 1.6],
        [0.95, 1.1],
        [1.2, 0],
      ])
      lathe(s, frameAlong(dk(56, KY, 1), N), (u) => ({ r: lens(u)[0] }), 0, 1.2, {
        steps: 6,
        ring: 20,
        ramp: { dark: 'glass', mid: 'glass', light: 'top' },
        shade: true,
      })

      // Toggles: an escutcheon with two screws, hex nut, threaded bushing, a lever with a ball tip; two up, one down.
      for (const [tx, tilt] of [
        [68, -24],
        [76, -24],
        [84, 24],
      ]) {
        const es = plate(s, { O: dk(tx, KY), U: X, V, N }, -2.4, -4.2, 4.8, 8.4, 1, 0.6, 0.25, hero)
        for (const v of [-3.1, 3.1]) screw(s, es(0, v, 0.01), N, 0.36)
        lathe(s, frameAlong(dk(tx, KY, 0.6), N), () => ({ r: 1.75 }), 0, 0.9, {
          steps: 1,
          ring: 6,
          shade: true,
        })
        const bush = lathe(s, frameAlong(dk(tx, KY, 1.5), N), () => ({ r: 1.05 }), 0, 1.3, {
          steps: 1,
          ring: 20,
          shade: true,
        })
        bush.seam(0.45)
        bush.seam(0.9)
        const dir = unit(add(mul(N, Math.cos(tilt * D2R)), mul(V, Math.sin(tilt * D2R))))
        const base = dk(tx, KY, 2.6)
        lathe(s, frameAlong(base, dir), (u) => ({ r: 0.55 - 0.03 * u }), 0, 5, {
          steps: 2,
          ring: 14,
          shade: true,
        })
        const R = 0.85
        lathe(
          s,
          frameAlong(add(base, mul(dir, 5.5)), dir),
          (u) => ({ r: Math.sqrt(Math.max(0, R * R - u * u)) }),
          -R,
          R,
          {
            steps: 8,
            ring: 16,
            shade: true,
            caps: false,
          },
        )
      }
    }

    // ---------------------------------------------------------------- top rung: a sticky note on the bezel
    if (rung === 5) {
      const NL = RT + 0.3
      const ca = 0.2,
        cs = Math.cos(ca),
        sn = Math.sin(ca)
      const cx = -22.5,
        cy = 26.5
      const np = (u: number, v: number, l = NL): P3 =>
        sp(cx + u * cs - v * sn, cy + u * sn + v * cs, l)
      const h = hero ? 7.8 : 10.5,
        c = h - 4.2
      s.group('lit', () => {
        s.poly(
          [
            np(-h + 1.6, -h + 1.6, PT),
            np(h + 1.6, -h + 1.6, PT),
            np(h + 1.6, h + 1.6, PT),
            np(-h + 1.6, h + 1.6, PT),
          ],
          'shadow',
          'none',
        )
        // An outline with a faint tint, not a slab: the bezel stays visible through it.
        const note = [np(-h, -h), np(h, -h), np(h, c), np(c, h), np(-h, h)]
        s.poly(note, 'accent', 'none', undefined, undefined, 0.22)
        s.poly(note, 'none', 'accent', undefined, hero ? 1 : undefined)
        s.poly(
          [np(h, c), np(c, h), np(c, c, NL + 0.6)],
          'none',
          'accent',
          undefined,
          hero ? 0.8 : undefined,
        )
        if (hero) {
          s.line([np(-h, -h + 2.2), np(h, -h + 2.2)], 'accent', 0.5)
          s.line([np(-5.6, -1.6), np(5.6, -1.6)], 'accent', 0.7)
          s.line([np(-5.6, 1.4), np(2.2, 1.4)], 'accent', 0.7)
        } else s.line([np(-h + 2.5, -1.5), np(h - 2.5, -1.5)], 'accent', 1.2)
      })
    }

    return s.done()
  },
}
