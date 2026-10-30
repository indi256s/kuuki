// The lane locomotive, drawn with the ladder figures' parts. The car is built in scripts/leaderboard-lanes/car/.
// The livery (the accent ramp, which the lane points at --lane-livery) goes on the cab ends and side band.
//
// Frame as the airliners: metres; the front at local x = 0, the rear at −length; +y is the near flank; z up.

import { hull, type P3, type Paint, type Pt } from '../../../overview/iso/scene'
import {
  GREY,
  add,
  circleOn,
  disc,
  facing,
  frameAlong,
  lathe,
  mul,
  screw,
  toneOf,
  tube,
  type Ramp,
} from '../../../profile/ladders/figures/parts'
import { W, type LaneScene } from './lane-scene'

const X: P3 = [1, 0, 0],
  Y: P3 = [0, 1, 0],
  Z: P3 = [0, 0, 1]
const V = W

/** A convex prism: profile in local (x, z), extruded along local y from y0 to y1. Each face that looks at the viewer in its tone, creases between them, one silhouette. */
function prismY(
  s: LaneScene,
  profile: readonly Pt[],
  y0: number,
  y1: number,
  o: { ramp?: Ramp; line?: Paint; crease?: Paint; width?: number } = {},
) {
  const ramp = o.ramp ?? GREY
  // Wind counter-clockwise in (x, z) so an edge's outward normal is (dz, −dx).
  const area = profile.reduce((a, [x0, z0], i) => {
    const [x1, z1] = profile[(i + 1) % profile.length]
    return a + x0 * z1 - x1 * z0
  }, 0)
  const pr = area < 0 ? [...profile].reverse() : profile
  const n = pr.length
  const P = (i: number, y: number): P3 => W([pr[i % n][0], y, pr[i % n][1]])
  for (let i = 0; i < n; i++) {
    const [xa, za] = pr[i],
      [xb, zb] = pr[(i + 1) % n]
    const nrm = V([zb - za, 0, -(xb - xa)])
    if (!facing(nrm)) continue
    s.poly(
      [P(i, y0), P(i + 1, y0), P(i + 1, y1), P(i, y1)],
      toneOf(nrm, ramp),
      o.crease ?? 'crease',
      undefined,
      0.5,
    )
  }
  for (const [y, ny] of [
    [y1, 1],
    [y0, -1],
  ] as const) {
    const nrm = V([0, ny, 0])
    if (facing(nrm))
      s.poly(
        pr.map((_, i) => P(i, y)),
        toneOf(nrm, ramp),
        o.crease ?? 'crease',
        undefined,
        0.5,
      )
  }
  s.poly2(
    hull(s.pp([...pr.map((_, i) => P(i, y0)), ...pr.map((_, i) => P(i, y1))])),
    'none',
    o.line ?? 'line',
    o.width ?? 1,
  )
}

/** A box in local axes: x from x0 to x1, y from y0 to y1, z from z0 to z1. */
const boxL = (
  s: LaneScene,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  o?: { ramp?: Ramp },
) =>
  prismY(
    s,
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    y0,
    y1,
    o,
  )

/** Points of a rounded convex polygon in (x, z): corners [x, z, radius]. */
function rounded(corners: readonly (readonly [number, number, number])[], seg = 4): Pt[] {
  const n = corners.length,
    out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const [px, pz, r] = corners[i]
    if (!r) {
      out.push([px, pz])
      continue
    }
    const [ax, az] = corners[(i + n - 1) % n],
      [bx, bz] = corners[(i + 1) % n]
    const ua = [ax - px, az - pz],
      ub = [bx - px, bz - pz]
    const la = Math.hypot(ua[0], ua[1]),
      lb = Math.hypot(ub[0], ub[1])
    const ea = [ua[0] / la, ua[1] / la],
      eb = [ub[0] / lb, ub[1] / lb]
    const halfA = Math.acos(Math.max(-1, Math.min(1, ea[0] * eb[0] + ea[1] * eb[1]))) / 2
    const t = Math.min(r / Math.tan(halfA), la * 0.45, lb * 0.45)
    const p0: Pt = [px + ea[0] * t, pz + ea[1] * t],
      p1: Pt = [px + eb[0] * t, pz + eb[1] * t]
    // Quadratic through the corner: close enough to an arc at these sizes.
    for (let j = 0; j <= seg; j++) {
      const u = j / seg
      out.push([
        (1 - u) ** 2 * p0[0] + 2 * u * (1 - u) * px + u * u * p1[0],
        (1 - u) ** 2 * p0[1] + 2 * u * (1 - u) * pz + u * u * p1[1],
      ])
    }
  }
  return out
}

/** A closed outline on a flat face at local y = c: points in (x, z). */
const onFace = (s: LaneScene, c: number, pts: readonly Pt[], fill: Paint, stroke: Paint, w = 0.5) =>
  s.poly(
    pts.map(([x, z]) => W([x, c, z])),
    fill,
    stroke,
    undefined,
    w,
  )
const rectX = (x0: number, x1: number, z0: number, z1: number, r = 0): Pt[] =>
  r
    ? rounded([
        [x0, z0, r],
        [x1, z0, r],
        [x1, z1, r],
        [x0, z1, r],
      ])
    : [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ]

// ======================================================================================================
// Locomotive: a modern four-axle electric (Bo'Bo') with a Vectron's proportions: 18.98 m over buffers, 3.0 m wide,
// 4.05 m to the roof, 1.25 m wheels, 9.5 m bogie centres, 3.0 m bogie wheelbase. Cab ends, doors, windows, grilles and
// roof gear are estimated for a generic type, not one railway's.
// ======================================================================================================
export const LOCO_LENGTH = 18.98
/** Half the standard gauge, m: the rails' offset from the track's centre line. */
export const RAIL = 0.7175

export function locomotive(s: LaneScene) {
  const L = LOCO_LENGTH
  const HW = 1.5
  const WR = 0.625
  const ZF = 1.62,
    ZU = 1.18
  const ROOF = 4.05
  const B0 = 0.62
  const xs = (a: number) => -L + a // metres from the rear buffer face
  const mid = L / 2

  // Cast shadow under the frame.
  s.poly(
    [
      W([xs(0.3), -HW + 0.2, 0.01]),
      W([xs(L - 0.3), -HW + 0.2, 0.01]),
      W([xs(L - 0.3), HW + 0.3, 0.01]),
      W([xs(0.3), HW + 0.3, 0.01]),
    ],
    'shadow',
    'none',
  )

  // ------------------------------------------------------------ bogies: far side first, then the frame, then near
  const bogieX = [mid - 4.75, mid + 4.75]
  const wheelsetX = (b: number) => [b - 1.5, b + 1.5]
  const wheelAt = (x: number, y: number) => {
    // A rail wheel: the tyre and its flange on the inside, the web, the hub.
    const c = W([xs(x), y, WR])
    const ax = V(Y)
    const out = y > 0 ? 1 : -1
    disc(s, add(c, mul(ax, -out * 0.07)), ax, WR + 0.06, 0.03, { ring: 20 })
    disc(s, c, ax, WR, 0.13, { ring: 24, shade: true })
    const face = add(c, mul(ax, out * 0.066))
    s.poly(circleOn(face, mul(ax, out), WR * 0.78, 28), 'side', 'crease', undefined, 0.5)
    disc(s, add(face, mul(ax, out * 0.03)), ax, WR * 0.28, 0.06, { ring: 16 })
  }
  const bogie = (b: number, side: 1 | -1) => {
    const y = side * (RAIL + 0.08)
    const yo = side * (RAIL + 0.42)
    for (const x of wheelsetX(b)) wheelAt(x, y)
    // Side frame: a deep beam dipping between the axles, axle boxes on the wheel centres, primary springs over them.
    prismY(
      s,
      [
        [xs(b - 2.15), 0.78],
        [xs(b - 1.9), 0.62],
        [xs(b - 0.75), 0.42],
        [xs(b + 0.75), 0.42],
        [xs(b + 1.9), 0.62],
        [xs(b + 2.15), 0.78],
        [xs(b + 2.15), 1.0],
        [xs(b - 2.15), 1.0],
      ],
      yo - 0.1,
      yo + 0.1,
    )
    for (const x of wheelsetX(b)) {
      boxL(s, xs(x - 0.24), xs(x + 0.24), yo - 0.13, yo + 0.13, WR - 0.2, WR + 0.18)
      if (side > 0) screw(s, W([xs(x), yo + 0.14, WR]), V(Y), 0.05, { ring: 0.1 })
    }
    // Secondary springs: two coil nests between the frame and the underframe.
    for (const dx of [-0.55, 0.55]) {
      const c: P3 = [xs(b + dx), yo, 1.0]
      tube(s, W(c), W(add(c, [0, 0, ZU - 1.0])), 0.16, { shade: true })
      if (side > 0)
        for (let i = 1; i < 4; i++)
          s.line(
            [
              W([xs(b + dx) - 0.16, yo + 0.1, 1.0 + i * 0.045]),
              W([xs(b + dx) + 0.16, yo + 0.1, 1.0 + i * 0.045 + 0.03]),
            ],
            'crease',
            0.4,
          )
    }
    // Brake unit hanging off the frame end.
    boxL(s, xs(b - 2.1), xs(b - 1.75), yo - 0.12, yo + 0.12, 0.7, 0.95)
  }
  for (const b of bogieX) bogie(b, -1)

  // ------------------------------------------------------------ underframe, headstocks, buffers, plough
  boxL(s, xs(B0), xs(L - B0), -HW + 0.08, HW - 0.08, ZU, ZF)
  // Equipment boxes slung between the bogies: transformer tank and battery boxes.
  boxL(s, xs(mid - 2.2), xs(mid + 2.2), -1.15, 1.15, 0.72, ZU)
  boxL(s, xs(mid - 2.45), xs(mid - 2.25), -1.05, 1.05, 0.8, ZU)
  for (const x of [mid - 1.3, mid, mid + 1.3]) screw(s, W([xs(x), 1.16, 0.95]), V(Y), 0.04)
  for (const b of bogieX) bogie(b, 1)
  for (const end of [0, 1]) {
    const x0 = end ? L - B0 : 0
    const dir = end ? 1 : -1
    const xh = end ? L - B0 : B0
    // Headstock and a coupler pocket.
    boxL(s, xs(xh - (end ? 0 : 0.08)), xs(xh + (end ? 0.08 : 0)), -HW + 0.05, HW - 0.05, 0.98, ZF)
    // Buffers: a stock tube and a dished head, either side of the coupler.
    for (const y of [-0.875, 0.875]) {
      const a = W([xs(xh), y, 1.06])
      const b = W([xs(x0 + (end ? B0 : 0)) - dir * 0.05, y, 1.06])
      tube(s, a, b, 0.11, { shade: true })
      disc(s, W([xs(end ? L - 0.03 : 0.03), y, 1.06]), V(X), 0.2, 0.06, { ring: 24, shade: true })
    }
    // Snowplough under the cab end: a wedge down to rail height.
    const yp = 1.25
    prismY(
      s,
      end
        ? [
            [xs(L - B0), 0.98],
            [xs(L - B0 + 0.45), 0.98],
            [xs(L - B0 + 0.12), 0.22],
            [xs(L - B0 - 0.2), 0.22],
            [xs(L - B0 - 0.2), 0.98],
          ]
        : [
            [xs(B0 - 0.45), 0.98],
            [xs(B0), 0.98],
            [xs(B0 + 0.2), 0.98],
            [xs(B0 + 0.2), 0.22],
            [xs(B0 - 0.12), 0.22],
          ],
      -yp,
      yp,
    )
    // Coupler hook and its link.
    tube(s, W([xs(xh), 0, 1.06]), W([xs(x0 + (end ? B0 : 0) - dir * 0.1), 0, 1.06]), 0.07)
  }

  // ------------------------------------------------------------ body: side profile extruded, raked cab ends
  const prof: Pt[] = [
    [xs(B0), ZF],
    [xs(L - B0), ZF],
    [xs(L - B0), 2.62],
    [xs(L - 0.9), 3.6],
    [xs(L - 1.25), ROOF],
    [xs(1.25), ROOF],
    [xs(0.9), 3.6],
    [xs(B0), 2.62],
  ]
  prismY(s, prof, -HW, HW)
  // The livery: a band low on the flank, round both cab ends and up their faces as a nose, painted on each face.
  const band = (y: number, pts: readonly Pt[]) => onFace(s, y, pts, 'accent', 'none')
  band(HW + 0.005, [
    [xs(B0 + 0.01), ZF + 0.02],
    [xs(L - B0 - 0.01), ZF + 0.02],
    [xs(L - B0 - 0.01), 2.3],
    [xs(L - 2.6), 2.3],
    [xs(L - 3.4), 2.05],
    [xs(3.4), 2.05],
    [xs(2.6), 2.3],
    [xs(B0 + 0.01), 2.3],
  ])
  // Cab front (the +x end): the lower face and the raked windscreen face.
  const front = (t: number, y: number): P3 => W([xs(L - B0 - 0.28 * t), y, 2.62 + 0.98 * t])
  const fx = xs(L - B0) + 0.005
  s.poly(
    [
      W([fx, -HW + 0.01, ZF + 0.02]),
      W([fx, HW - 0.01, ZF + 0.02]),
      W([fx, HW - 0.01, 2.6]),
      W([fx, -HW + 0.01, 2.6]),
    ],
    'accent',
    'none',
  )
  s.poly(
    [front(0.1, -1.22), front(0.1, 1.22), front(0.9, 1.12), front(0.9, -1.12)],
    'glass',
    'line',
    undefined,
    0.6,
  )
  // Wiper, headlamps and marker lights on the front.
  s.line([front(0.12, 0.2), front(0.62, 0.55)], 'crease', 0.5)
  for (const y of [-1.05, 1.05])
    s.poly(circleOn(W([fx + 0.005, y, 2.05]), V(X), 0.13, 12), 'glass', 'line', undefined, 0.5)
  s.poly(circleOn(front(0.97, 0), V(add(X, mul(Z, 0.3))), 0.1, 10), 'glass', 'line', undefined, 0.5)
  // Near flank: cab doors and cab side windows at both ends, machine-room windows, a louvred grille, the waist line.
  const F = HW + 0.006
  for (const [d0, d1, w0, w1] of [
    [1.55, 2.35, 1.65, 2.25],
    [L - 2.35, L - 1.55, L - 2.25, L - 1.65],
  ]) {
    onFace(s, F, rectX(xs(d0), xs(d1), 1.78, 3.62, 0.08), 'none', 'line', 0.6)
    onFace(s, F, rectX(xs(w0), xs(w1), 2.75, 3.42, 0.06), 'glass', 'crease', 0.5)
    onFace(s, F, rectX(xs(d1 - 0.18), xs(d1 - 0.12), 2.2, 2.6), 'side', 'none')
    // Grab rails beside the door, and the step under it.
    for (const x of [d0 - 0.14, d1 + 0.14])
      tube(s, W([xs(x), F + 0.06, 1.9]), W([xs(x), F + 0.06, 3.15]), 0.025)
    boxL(s, xs(d0 + 0.05), xs(d1 - 0.05), HW - 0.25, HW - 0.05, 1.0, 1.08)
  }
  for (let i = 0; i < 4; i++) {
    const x0 = 4.1 + i * 2.95
    onFace(s, F, rectX(xs(x0), xs(x0 + 0.62), 2.95, 3.42, 0.05), 'glass', 'crease', 0.5)
  }
  for (let i = 0; i < 11; i++) {
    const x0 = 5.0 + i * 0.82
    onFace(s, F, rectX(xs(x0), xs(x0 + 0.5), 2.42, 2.82, 0.04), 'side', 'crease', 0.4)
  }
  s.line([W([xs(1.13), F, 3.86]), W([xs(L - 1.13), F, 3.86])], 'crease', 0.5)
  for (const x of [4.6, mid, L - 4.6])
    s.line([W([xs(x), F, 1.65]), W([xs(x), F, 3.86])], 'crease', 0.4)

  // ------------------------------------------------------------ roof gear: breaker, insulators, two pantographs
  boxL(s, xs(mid - 1.8), xs(mid + 1.8), -0.8, 0.8, ROOF, ROOF + 0.28)
  boxL(s, xs(mid - 0.5), xs(mid + 0.5), -0.3, 0.3, ROOF + 0.28, ROOF + 0.48)
  const insulator = (x: number, y: number, h = 0.3) => {
    lathe(
      s,
      frameAlong(W([xs(x), y, ROOF]), Z),
      (t) => ({ r: 0.07 + 0.03 * Math.abs(Math.sin(t * 22)) }),
      0,
      h,
      { steps: 3, ring: 10 },
    )
  }
  const panto = (b: number, raised: boolean) => {
    const dir = b < mid ? 1 : -1
    for (const y of [-0.55, 0.55]) for (const dx of [-0.45, 0.45]) insulator(b + dx, y)
    // Base frame on the insulators.
    boxL(s, xs(b - 0.6), xs(b + 0.6), -0.62, 0.62, ROOF + 0.3, ROOF + 0.38)
    const hinge: P3 = [xs(b - dir * 0.4), 0, ROOF + 0.4]
    const knee: P3 = raised
      ? [xs(b + dir * 0.9), 0, ROOF + 1.25]
      : [xs(b + dir * 1.35), 0, ROOF + 0.55]
    const head: P3 = raised
      ? [xs(b - dir * 0.1), 0, ROOF + 2.0]
      : [xs(b - dir * 0.05), 0, ROOF + 0.66]
    for (const y of [-0.4, 0.4]) {
      tube(s, W(add(hinge, [0, y, 0])), W(add(knee, [0, y * 0.5, 0])), 0.045, { shade: true })
    }
    tube(s, W(knee), W(head), 0.035)
    // The pan: a bar across, its horns curled down at the ends.
    tube(s, W(add(head, [0, -0.95, 0])), W(add(head, [0, 0.95, 0])), 0.05, { shade: true })
    for (const y of [-1, 1])
      tube(s, W(add(head, [0, y * 0.95, 0])), W(add(head, [0, y * 1.08, -0.12])), 0.035)
  }
  panto(bogieX[0], true)
  panto(bogieX[1], false)
  // Roof hatches and the roof line seams.
  for (const x of [3.0, L - 3.0]) boxL(s, xs(x - 0.45), xs(x + 0.45), -0.5, 0.5, ROOF, ROOF + 0.06)

  return { tail: xs(0), groundY: RAIL + 0.08 }
}
