// Gate prototype for the leaderboard race lanes: one airliner (A21N), one locomotive and one car, drawn with the
// anatomy kit under ONE camera, ONE line weight and ONE tone system (the Concorde's --anatomy-* → --iso-* mapping).
// Build-time only: it writes static SVG strings and a preview page. Nothing here is wired into the app.
//
//   node scripts/leaderboard-lanes/build.mjs           writes .scratch/leaderboard-lanes/gate/* and gate.html
//   node scripts/leaderboard-lanes/build.mjs --audit   also runs the kit audit on every vehicle
//
// Kit: ANATOMY_KIT (default ~/.claude/skills/anatomy-asset/kit).
//
// Camera: a shallow three-quarter side view, azimuth AZ, elevation EL, shared by all three. Vehicles travel toward +x,
// which runs to screen right; the viewer stands on the +y side, a little ahead, so the near flank, the nose and a
// foreshortened near wing show. Normalisation: every vehicle is modelled in metres and scaled so its length is
// 100 world units, then drawn with the same projection, so the three share one drawn length and one stroke.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  A,
  loftSmoothOf,
  outlineOutside,
  ART_CSS,
  AZ,
  BOUNDS,
  D,
  DEG,
  EL,
  G,
  HOST_CSS,
  KS,
  L,
  LEN,
  P,
  S,
  SIDE,
  SLOPE,
  STEPS,
  THEMES,
  XF,
  YF,
  at,
  css,
  emit,
  f1,
  fine,
  k,
  loftOf,
  pathOf,
  rounded,
  sheared,
  silhouetteArea,
  wheel,
  workshop,
} from './common.mjs'

const OUT = '.scratch/leaderboard-lanes/gate'

// ======================================================================================================
// Airliner: Airbus A321neo (A21N), CFM LEAP-1A, Sharklets. Dimensions from packages/data/src/aircraft-geometry/a320.json
// (Airbus AC A321, Jun 2024). Estimated here (not in the data): belly height 2.2 m, wing thickness, door stations,
// gear stations (nose 5.1 m, main 22.0 m from the nose; main track 7.59 m), wheel sizes, trailing-edge kink x.
// ======================================================================================================
function airliner(len = LEN) {
  const W = workshop('air')
  const LEN_M = 44.51
  const m = len / LEN_M
  const X = (xs) => LEN - xs * m // station from the nose → world x (nose at +x)
  const R0 = (3.95 / 2) * m
  const BELLY = 2.2 * m
  const ZC = BELLY + R0
  const NOSE_L = 5.9
  const TAIL_L = 8.7
  const S_T1 = X(LEN_M - TAIL_L) // where the tail cone starts
  const S_N0 = X(NOSE_L)
  const S_TIP = LEN

  // Barrel and nose on one lathe; the nose a blunt ellipse-like ogive.
  const fr = (s) => {
    if (s <= S_N0) return R0
    const v = Math.min(1, (s - S_N0) / (S_TIP - S_N0))
    return R0 * Math.max(0, 1 - v ** 2.1) ** 0.5
  }
  const frSlope = (s) => {
    const h = 0.02
    const lo = Math.max(S_T1, s - h)
    const hi = Math.min(S_TIP - 0.01, s + h)
    return (fr(hi) - fr(lo)) / (hi - lo || 1)
  }
  const FUSE = XF([0, 0, ZC])
  const profile = [
    [S_T1, R0],
    [S_N0, R0, 1],
  ]
  for (let i = 1; i < 14; i++) {
    const v = 1 - (1 - i / 14) ** 1.5
    const s = S_N0 + (S_TIP - S_N0) * v
    profile.push([s, fr(s), 1])
  }
  profile.push([S_TIP, 0])
  const onFuse = (s, deg) => G.pointOf(FUSE, s, fr(s), deg * DEG)
  const fusePath = (pts, closed) =>
    pathOf(
      pts.map(([s, t]) => onFuse(s, t)),
      closed,
    )

  // Cabin windows: one row a little above the axis on the near side, every 0.533 m, skipping the doors.
  const DOORS = [4.7, 15.2, 26.0, 38.0] // estimated stations of the door forward edges
  const DOOR_W = 0.81
  const wins = []
  for (let xs = 6.4; xs <= 37.2; xs += 0.533) {
    if (DOORS.some((d) => xs > d - 0.35 && xs < d + DOOR_W + 0.35)) continue
    wins.push(at(onFuse(X(xs), 18)))
  }
  const door = (xs) => {
    const pts = []
    for (let t = -26; t <= 46; t += 6) pts.push([X(xs), t])
    for (let t = 46; t >= -26; t -= 6) pts.push([X(xs + DOOR_W), t])
    return fusePath(pts, true)
  }
  // Cockpit: the side windows and the swept windscreen on the near side, as glazing on the nose skin.
  const glass = (poly) => {
    const d = fusePath(poly, true)
    return `<path class="lv-glass" d="${d}"/>` + L(d, { tone: 'hi' })
  }
  const cockpit = [
    glass([
      [X(2.05), 34],
      [X(1.55), 40],
      [X(1.55), 62],
      [X(2.15), 58],
    ]),
    glass([
      [X(2.95), 30],
      [X(2.25), 33],
      [X(2.2), 56],
      [X(2.95), 52],
    ]),
  ].join('')
  const seams = [X(NOSE_L), X(20.5), X(31.5)]
    .map((s) => G.arcOf(FUSE, s, fr(s), P, { slope: frSlope(s) }))
    .join('')
  // Belly cheat line: a thin rule along the lower flank, from the nose seam to the tail-cone joint.
  W.turned('fuselage', FUSE, profile, {
    tone: 'hi',
    livery: true,
    own: 'air.fuselage', // the tail cone sleeves into the barrel's end: one skin

    smooth: { slope: frSlope, radius: fr, rows: 5 },
    radius: fr,
    inner: fine(L(seams, { tone: 'faint' })),
    extra:
      fine(L(DOORS.map(door).join(''), { tone: 'mid' }) + D(wins, { size: 0.2 * KS, tone: 'hi' })) +
      cockpit,
  })

  // Tail cone on its own tilted axis, so the tail end sits 1.5 m above the cabin axis (the upsweep).
  const UP = 1.5 * m
  const RT_END = 0.32 * m
  const c0 = [S_T1 + 0.6, 0, ZC]
  const c1 = [0, 0, ZC + UP]
  const ax = G.unit3(G.sub3(c1, c0))
  const TL = G.len3(G.sub3(c1, c0))
  const u = [0, 1, 0]
  const TF = G.frameOf(c0, ax, u, G.unit3(G.cross3(u, ax)))
  const rt = (s) => RT_END + (R0 - RT_END) * (1 - Math.min(1, Math.max(0, s / TL)) ** 1.35)
  const rtSlope = (s) => {
    const h = 0.02
    return (
      (rt(Math.min(TL, s + h)) - rt(Math.max(0, s - h))) /
      (Math.min(TL, s + h) - Math.max(0, s - h))
    )
  }
  const tprof = [[0, R0]]
  for (let i = 1; i < 10; i++) tprof.push([(TL * i) / 10, rt((TL * i) / 10), 1])
  tprof.push([TL, RT_END])
  W.turned('tailcone', TF, tprof, {
    tone: 'hi',
    livery: true,
    own: 'air.fuselage',
    smooth: { slope: rtSlope, radius: rt, rows: 5 },
    radius: rt,
    bias: -0.5,
    inner: fine(
      L(G.arcOf(TF, TL * 0.62, rt(TL * 0.62), P, { slope: rtSlope(TL * 0.62) }), { tone: 'faint' }),
    ),
  })
  // Crown (top line) and axis height of the tail cone at a world x.
  const tailAt = (x) => {
    let lo = 0
    let hi = TL
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      const p = G.add3(c0, G.mul3(ax, mid))
      if (p[0] > x) lo = mid
      else hi = mid
    }
    const s = (lo + hi) / 2
    const p = G.add3(c0, G.mul3(ax, s))
    return { axis: p[2], crown: p[2] + rt(s) * TF.v[2], r: rt(s) }
  }

  // Wings: a five-point planform (unswept inboard trailing edge to the kink, then swept), 5° dihedral.
  const T_W = 0.36 * m
  const WZ = BELLY + 0.38 * m // lower surface at the root
  const ROOT_Y = Math.sqrt(R0 * R0 - (ZC - (WZ + T_W / 2)) ** 2) + 0.12
  const tan27 = Math.tan(27 * DEG)
  const LEx = (y) => 17.2 + tan27 * (y - 1.975)
  const TIP = 16.29
  const planform = [
    [LEx(ROOT_Y / m), ROOT_Y / m],
    [LEx(TIP), TIP],
    [LEx(TIP) + 1.64, TIP],
    [23.4, 4.87],
    [23.27, ROOT_Y / m],
  ]
  const DIH = 5 * DEG
  const wingFrame = (side) => {
    const v = [0, side * Math.cos(DIH), Math.sin(DIH)]
    const uu = [1, 0, 0]
    const n = G.unit3(G.cross3(uu, v))
    // n must point up for both sides, so the thickness grows from the lower surface upward.
    const nn = n[2] < 0 ? G.mul3(n, -1) : n
    return G.frameOf([0, side * ROOT_Y, WZ], nn, uu, v)
  }
  const span = (y) => y * m - ROOT_Y // spanwise distance from the root, world units
  const lowerAt = (y) => WZ + span(y) * Math.tan(DIH)
  for (const side of [1, -1]) {
    const F = wingFrame(side)
    const poly = planform.map(([xs, y]) => [X(xs), span(y) / Math.cos(DIH)])
    const lines = []
    // Flap and aileron hinge line 22% ahead of the trailing edge, and the spoiler / flap cuts.
    const te = (y) =>
      y <= 4.87 ? 23.3 : 23.4 + ((LEx(TIP) + 1.64 - 23.4) * (y - 4.87)) / (TIP - 4.87)
    const hinge = (y) => te(y) - 0.24 * (te(y) - LEx(y))
    const onWing = (xs, y) =>
      G.add3(
        F.o,
        G.add3(G.mul3(F.u, X(xs)), G.add3(G.mul3(F.v, span(y) / Math.cos(DIH)), G.mul3(F.a, T_W))),
      )
    const hingePts = []
    for (let y = ROOT_Y / m + 0.05; y <= TIP - 0.05; y += 0.5) hingePts.push(onWing(hinge(y), y))
    lines.push(pathOf(hingePts))
    for (const y of [4.87, 10.6]) lines.push(pathOf([onWing(hinge(y), y), onWing(te(y), y)]))
    W.prism(side > 0 ? 'wing.near' : 'wing.far', F, poly, 0, T_W, {
      tone: 'hi',
      inner: side > 0 ? fine(L(lines.join(''), { tone: 'faint' })) : '',
    })
    // Sharklet: a near-vertical blade on the tip, swept, blending from the tip chord.
    const ty = side * (ROOT_Y + span(TIP) * Math.cos(DIH))
    const tz = lowerAt(TIP) + T_W * 0.5
    const BH = 2.43 * m
    const blade = [
      [X(LEx(TIP) + 0.1), tz],
      [X(LEx(TIP) + 1.6), tz],
      [X(LEx(TIP) + 2.25), tz + BH],
      [X(LEx(TIP) + 1.75), tz + BH],
    ]
    const BT = 0.1 * m
    W.prism(
      side > 0 ? 'sharklet.near' : 'sharklet.far',
      SIDE(ty - (side > 0 ? BT : 0) * 1),
      blade,
      0,
      BT,
      { tone: 'hi' },
    )
  }

  // Engines: LEAP-1A nacelles (2.6 m, 4.23 m lip to reverser end, then the nozzle and plug), 1.2 m under the wing.
  const NR = 1.3 * m
  const NL = 4.23 * m
  const nac = (s) => {
    const u2 = Math.max(0, Math.min(1, s / NL))
    // s from the intake lip (front) aft: lip 0.9R, max at 30%, closing to 0.78R at the reverser end.
    return u2 < 0.3
      ? NR * (0.9 + 0.1 * (1 - (1 - u2 / 0.3) ** 2))
      : NR * (1 - 0.22 * ((u2 - 0.3) / 0.7) ** 1.6)
  }
  const nacSlope = (s) => {
    const h = 0.02
    return (
      (nac(Math.min(NL, s + h)) - nac(Math.max(0, s - h))) /
      (Math.min(NL, s + h) - Math.max(0, s - h))
    )
  }
  for (const side of [1, -1]) {
    const ey = side * 5.75 * m
    const ez = lowerAt(5.75) - 1.2 * m - 0.1 * m
    const front = X(15.4)
    // Lathe along −x from the lip, so s grows aft.
    const NF = G.frameOf([front, ey, ez], [-1, 0, 0], [0, 1, 0], [0, 0, 1])
    const nprof = [[0, nac(0)]]
    for (let i = 1; i < 10; i++) nprof.push([(NL * i) / 10, nac((NL * i) / 10), 1])
    nprof.push([NL, nac(NL)])
    const lip = G.circleOf(NF, 0, nac(0), P)
    const fan = G.circleOf(NF, 0, nac(0) * 0.86, P)
    const intake =
      `<path class="lv-intake" d="${lip}"/>` +
      `<path class="lv-fan" d="${fan}"/>` +
      L(fan, { tone: 'mid' })
    const seam = G.arcOf(NF, NL * 0.36, nac(NL * 0.36), P, { slope: nacSlope(NL * 0.36) })
    W.turned(side > 0 ? 'nacelle.near' : 'nacelle.far', NF, nprof, {
      tone: 'hi',
      smooth: { slope: nacSlope, radius: nac, rows: 4 },
      radius: nac,
      inner: fine(L(seam, { tone: 'faint' })),
      // The spinner sits in the intake, so it is drawn with the nacelle (after the fan face) as one item.
      extra: intake + S(G.sphereOf(G.pointOf(NF, 0.55, 0, 0), nac(0) * 0.3, P), { tone: 'mid' }),
      rims: 'all',
    })
    // Core nozzle and plug behind the fan cowl.
    const CF = G.frameOf([front - NL, ey, ez], [-1, 0, 0], [0, 1, 0], [0, 0, 1])
    const core = [
      [0, nac(NL) * 0.78],
      [0.75 * m, nac(NL) * 0.6],
      [0.75 * m, nac(NL) * 0.42],
      [1.25 * m, 0],
    ]
    W.turned(side > 0 ? 'core.near' : 'core.far', CF, core, { tone: 'mid', crease: 'lo' })
    // Pylon: a swept plate from the nacelle's crown back up to the wing's lower surface.
    const top = lowerAt(5.75) + 0.05
    const nt = ez + nac(NL * 0.45) - 0.15
    const pyl = [
      [X(16.6), nt],
      [X(19.6), nt - 0.1],
      [X(22.4), top],
      [X(18.4), top],
    ]
    const PT = 0.34 * m
    W.prism(side > 0 ? 'pylon.near' : 'pylon.far', SIDE(ey - PT / 2), pyl, 0, PT, { tone: 'mid' })
  }

  // Fin and rudder on the tail cone's crown; livery.
  const FIN_T = 0.28 * m
  const fin = (xs0, xs1, h0, h1) => {
    // A quad between two chord stations, rooted on the crown below each point.
    return [xs0, xs1, h1, h0]
  }
  void fin
  const FIN_H = 5.87 * m
  const tan39 = Math.tan(39 * DEG)
  const finLE = (h) => 36.94 + tan39 * (h / m)
  const finTE = (h) => 42.44 + ((43.69 - 42.44) * h) / FIN_H
  const hingeAt = (h) => finTE(h) - 0.3 * (finTE(h) - finLE(h))
  const crown = (xs) => tailAt(X(xs)).crown - 0.25
  const finPoly = [
    [X(finLE(0)), crown(finLE(0))],
    [X(hingeAt(0)), crown(hingeAt(0))],
    [X(hingeAt(FIN_H)), crown(36.94) + FIN_H],
    [X(finLE(FIN_H)), crown(36.94) + FIN_H],
  ]
  W.prism('fin', SIDE(-FIN_T / 2), finPoly, 0, FIN_T, { tone: 'hi', livery: true })
  const rudPoly = [
    [X(hingeAt(0)), crown(hingeAt(0))],
    [X(finTE(0)), crown(finTE(0))],
    [X(finTE(FIN_H)), crown(36.94) + FIN_H],
    [X(hingeAt(FIN_H)), crown(36.94) + FIN_H],
  ]
  W.prism('rudder', SIDE(-FIN_T * 0.4), rudPoly, 0, FIN_T * 0.8, { tone: 'hi', livery: true })

  // Tailplanes: 6.5° dihedral, rooted on the tail cone at its axis height.
  const HDIH = 6.5 * DEG
  const tan35 = Math.tan(35.2 * DEG)
  const hRootXs = 39.04
  const hz = tailAt(X(hRootXs + 1.6)).axis
  const hr = tailAt(X(hRootXs + 1.6)).r
  const HROOT = hr + 0.3
  const HSEMI = 6.225 * m
  for (const side of [1, -1]) {
    const v = [0, side * Math.cos(HDIH), Math.sin(HDIH)]
    const n = G.unit3(G.cross3([1, 0, 0], v))
    const F = G.frameOf(
      [0, side * HROOT, hz - 0.15 * m],
      n[2] < 0 ? G.mul3(n, -1) : n,
      [1, 0, 0],
      v,
    )
    const d = (HSEMI - HROOT) / Math.cos(HDIH)
    const poly = [
      [X(hRootXs), 0],
      [X(hRootXs + tan35 * ((HSEMI - HROOT) / m)), d],
      [X(43.68), d],
      [X(hRootXs + 3.31), 0],
    ]
    W.prism(side > 0 ? 'tailplane.near' : 'tailplane.far', F, poly, 0, 0.26 * m, { tone: 'hi' })
  }

  // Landing gear: twin-wheel nose leg and two twin-wheel main legs, struts to the wing and the belly.
  const gear = (name, xs, y, r, w, gap, topZ) => {
    const x = X(xs)
    const axleZ = r
    for (const yy of [y + gap / 2 + w, y - gap / 2])
      wheel(W, `${name}.wheel`, x, yy, r, w, { rim: 0.6, lugs: 0 })
    W.disc(`${name}.axle`, YF([x, y - gap / 2, axleZ]), 0, gap, r * 0.22, { tone: 'lo' })
    const sr = 0.13 * m
    W.disc(
      `${name}.strut`,
      G.frameOf([x, y, axleZ + r * 0.2], [0, 0, 1], [1, 0, 0], [0, 1, 0]),
      0,
      topZ - axleZ - r * 0.2,
      sr,
      { tone: 'mid' },
    )
  }
  gear('nosegear', 5.1, 0, 0.38 * m, 0.22 * m, 0.16 * m, ZC - fr(X(5.1)) + 0.4)
  for (const side of [1, -1])
    gear(
      side > 0 ? 'main.near' : 'main.far',
      22.0,
      side * 3.795 * m,
      0.6 * m,
      0.4 * m,
      0.4 * m,
      lowerAt(3.795) + 0.2,
    )

  return {
    W,
    label:
      'An Airbus A321neo airliner in side three-quarter view, gear down, with its fuselage and fin in the livery colour.',
    foot: { x: X(40), y: -4.5 * m, w: X(3) - X(40), d: 9 * m, r: 8 },
  }
}

// A straight bar between two points with a square section of half-width r (struts, arms, rods).
function bar(W, name, p0, p1, r, o = {}) {
  const F = G.frameAlong(p0, G.sub3(p1, p0))
  const poly = [
    [-r, -r],
    [r, -r],
    [r, r],
    [-r, r],
  ]
  return W.prism(name, F, poly, 0, G.len3(G.sub3(p1, p0)), o)
}
// A closed outline on the vertical face y = c, from (x, z) points.
const faceY = (c, pts, closed = true) =>
  pathOf(
    pts.map(([x, z]) => [x, c, z]),
    closed,
  )
const roundRectY = (c, x0, x1, z0, z1, r = 0, steps = 3) =>
  k.pathOf(
    k
      .roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps)
      .map(([x, z]) => at([x, c, z])),
    true,
  )
const glassY = (c, pts) => {
  const d = faceY(c, pts)
  return `<path class="lv-glass" d="${d}"/>` + L(d, { tone: 'hi' })
}

// ======================================================================================================
// Locomotive: one generic modern four-axle electric (Bo'Bo'), proportions of a Siemens Vectron class: 18.98 m over
// buffers, 3.0 m wide, 4.25 m to the roof, 1.25 m wheels, 9.5 m bogie centres, 3.0 m bogie wheelbase. Cab ends, side
// doors and windows, grilles and roof gear are estimated for a generic type, not one railway's livery.
// ======================================================================================================
function locomotive(len = LEN) {
  const W = workshop('rail')
  const LEN_M = 18.98
  const m = len / LEN_M
  const x = (xs) => LEN - len + xs * m // xs from the rear buffer face
  const HW = 1.5 * m
  const WR = 0.625 * m
  const ZF = 1.62 * m // underframe top (floor)
  const ZU = 1.18 * m // underframe bottom
  const ROOF = 4.05 * m
  const B0 = 0.62 // buffer length, m: the body starts behind the buffers at both ends
  // Body: a side profile extruded across the width; cabs at both ends with a raked windscreen.
  const end = [
    [0.62, 1.62],
    [0.62, 2.62],
    [0.9, 3.6],
    [1.25, 4.05],
  ]
  const prof = [...end, ...end.map(([a, b]) => [LEN_M - a, b]).reverse()].map(([a, b]) => [
    x(a),
    b * m,
  ])
  prof.push(...[[LEN_M - 0.62, 1.62]].map(([a, b]) => [x(a), b * m]))
  const body = [
    [x(0.62), ZF],
    [x(0.62), 2.62 * m],
    [x(0.9), 3.6 * m],
    [x(1.25), ROOF],
    [x(LEN_M - 1.25), ROOF],
    [x(LEN_M - 0.9), 3.6 * m],
    [x(LEN_M - 0.62), 2.62 * m],
    [x(LEN_M - 0.62), ZF],
  ]
  // Side face details at y = HW: cab doors and cab side windows at both ends, four machine-room windows, a long
  // louvred grille panel (closed slots), and the livery band's edge lines from end to end.
  const c = HW
  const lines = []
  const glassBits = []
  const glassFine = [] // machine-room windows: drop out at phone size with the other fine detail
  for (const [d0, d1, w0, w1] of [
    [1.55, 2.35, 1.65, 2.2],
    [LEN_M - 2.35, LEN_M - 1.55, LEN_M - 2.2, LEN_M - 1.65],
  ]) {
    lines.push(roundRectY(c, x(d0), x(d1), 1.78 * m, 3.62 * m, 0.08 * m))
    glassBits.push(
      glassY(c, [
        [x(w0), 2.75 * m],
        [x(w1), 2.75 * m],
        [x(w1), 3.42 * m],
        [x(w0), 3.42 * m],
      ]),
    )
    // grab handles beside the door: short closed bars
    lines.push(roundRectY(c, x(d0 - 0.16), x(d0 - 0.1), 1.9 * m, 3.1 * m, 0.02 * m))
  }
  for (let i = 0; i < 4; i++) {
    const x0 = 4.1 + i * 2.95
    glassFine.push(
      glassY(c, [
        [x(x0), 2.95 * m],
        [x(x0 + 0.62), 2.95 * m],
        [x(x0 + 0.62), 3.42 * m],
        [x(x0), 3.42 * m],
      ]),
    )
  }
  for (let i = 0; i < 11; i++) {
    const x0 = 5.0 + i * 0.82
    lines.push(roundRectY(c, x(x0), x(x0 + 0.5), 2.2 * m, 2.62 * m, 0.05 * m))
  }
  // Two body-length rules that run edge to edge: the band under the windows and the waist line.
  lines.push(
    faceY(
      c,
      [
        [x(0.62), 1.92 * m],
        [x(LEN_M - 0.62), 1.92 * m],
      ],
      false,
    ),
  )
  // Front face (x = LEN − 0.62 … windscreen): the windscreen on the raked face, the headlights and marker lights.
  const front = (t, y, z0, z1) => {
    // a point on the raked windscreen face between (2.62 m, LEN−0.62) and (3.6 m, LEN−0.9), t in 0..1 up it
    const xa = LEN_M - 0.62 + -0.28 * t
    return [x(xa), y, (2.62 + 0.98 * t) * m]
  }
  const ws = pathOf(
    [front(0.1, -1.18 * m), front(0.1, 1.18 * m), front(0.92, 1.1 * m), front(0.92, -1.1 * m)],
    true,
  )
  const lamps = [-1, 1]
    .map((sd) =>
      k.pathOf(
        k
          .roundedPlan(
            { x: sd * 1.05 * m - 0.22 * m, y: 1.95 * m, w: 0.44 * m, d: 0.22 * m, r: 0.08 * m },
            3,
          )
          .map(([y, z]) => at([x(LEN_M - 0.62), y, z])),
        true,
      ),
    )
    .join('')
  const top = k.pathOf(
    k
      .roundedPlan({ x: -0.25 * m, y: 3.72 * m, w: 0.5 * m, d: 0.14 * m, r: 0.06 * m }, 3)
      .map(([y, z]) => at([x(LEN_M - 1.02), y, z])),
    true,
  )
  W.prism('carbody', SIDE(-HW), body, 0, 2 * HW, {
    tone: 'hi',
    livery: true,
    inner: fine(L(lines.join(''), { tone: 'mid' })),
    extra:
      glassBits.join('') +
      fine(glassFine.join('')) +
      `<path class="lv-glass" d="${ws}"/>` +
      L(ws, { tone: 'hi' }) +
      `<path class="lv-lamp" d="${lamps}${top}"/>` +
      L(lamps + top, { tone: 'mid' }),
  })
  // Roof: a raised roof hatch box, the main breaker on insulators, a raised single-arm pantograph at the rear and a
  // lowered one at the front, each on four post insulators.
  W.box(
    'roof.hatch',
    { x: x(6.2), y: -0.95 * m, w: 6.4 * m, d: 1.9 * m, r: 0.1 * m },
    ROOF,
    0.22 * m,
    { tone: 'mid', bevel: 0.3 },
  )
  W.box(
    'roof.breaker',
    { x: x(9.2), y: -0.35 * m, w: 1.1 * m, d: 0.7 * m, r: 0.06 * m },
    ROOF + 0.22 * m,
    0.35 * m,
    { tone: 'mid' },
  )
  const pantograph = (xs, raised, name) => {
    const z0 = ROOF
    const frame = { x: x(xs - 0.7), y: -0.55 * m, w: 1.4 * m, d: 1.1 * m, r: 0.05 * m }
    for (const [ix, iy] of [
      [xs - 0.55, -0.4],
      [xs + 0.55, -0.4],
      [xs - 0.55, 0.4],
      [xs + 0.55, 0.4],
    ])
      W.disc(
        `${name}.insulator`,
        G.frameOf([x(ix), iy * m, z0], [0, 0, 1], [1, 0, 0], [0, 1, 0]),
        0,
        0.3 * m,
        0.1 * m,
        {
          tone: 'mid',
          inner: fine(
            L(
              G.arcOf(
                G.frameOf([x(ix), iy * m, z0], [0, 0, 1], [1, 0, 0], [0, 1, 0]),
                0.15 * m,
                0.1 * m,
                P,
              ),
              { tone: 'faint' },
            ),
          ),
        },
      )
    const zf = z0 + 0.3 * m
    W.box(`${name}.base`, frame, zf, 0.12 * m, { tone: 'mid' })
    const hinge = [x(xs - 0.45), 0, zf + 0.19 * m]
    const knee = raised ? [x(xs + 1.45), 0, zf + 0.85 * m] : [x(xs + 1.6), 0, zf + 0.28 * m]
    const head = raised ? [x(xs - 0.05), 0, zf + 1.55 * m] : [x(xs - 0.25), 0, zf + 0.42 * m]
    bar(W, `${name}.lower`, hinge, knee, 0.06 * m, { tone: 'mid' })
    bar(W, `${name}.upper`, knee, head, 0.045 * m, { tone: 'mid' })
    // The pan head: a collector bar across the track on a short cross-tube.
    W.box(
      `${name}.head`,
      { x: head[0] - 0.12 * m, y: -0.95 * m, w: 0.24 * m, d: 1.9 * m, r: 0.05 * m },
      head[2],
      0.1 * m,
      { tone: 'hi' },
    )
  }
  pantograph(3.6, true, 'panto.rear')
  pantograph(LEN_M - 4.2, false, 'panto.front')

  // Underframe, headstocks, buffers and the coupler at both ends.
  W.box(
    'underframe',
    { x: x(0.62), y: -HW + 0.05 * m, w: (LEN_M - 1.24) * m, d: 2 * HW - 0.1 * m, r: 0.04 * m },
    ZU,
    ZF - ZU,
    {
      tone: 'mid',
      inner: fine(
        L(
          k.sideSeam(
            {
              x: x(0.62),
              y: -HW + 0.05 * m,
              w: (LEN_M - 1.24) * m,
              d: 2 * HW - 0.1 * m,
              r: 0.04 * m,
            },
            ZU + 0.22 * m,
            P,
            3,
          ),
          { tone: 'faint' },
        ),
      ),
    },
  )
  W.box(
    'tank',
    { x: x(7.2), y: -1.1 * m, w: 4.6 * m, d: 2.2 * m, r: 0.06 * m },
    0.62 * m,
    ZU - 0.62 * m,
    { tone: 'lo' },
  )
  for (const [xa, dir] of [
    [LEN_M - 0.62, 1],
    [0.62, -1],
  ]) {
    for (const sd of [-1, 1]) {
      const F = G.frameOf([x(xa), sd * 0.875 * m, 1.06 * m], [dir, 0, 0], [0, 1, 0], [0, 0, 1])
      W.disc('buffer.stock', F, 0.18 * m, 0.48 * m, 0.13 * m, { tone: 'mid' })
      W.disc('buffer.head', F, 0.48 * m, 0.58 * m, 0.24 * m, { tone: 'hi' })
    }
    const FC = G.frameOf([x(xa), 0, 1.0 * m], [dir, 0, 0], [0, 1, 0], [0, 0, 1])
    W.disc('coupler', FC, 0.18 * m, 0.46 * m, 0.09 * m, { tone: 'mid' })
    W.box(
      'headstock',
      {
        x: dir > 0 ? x(xa) - 0.02 * m : x(xa) - 0.2 * m + 0.02 * m,
        y: -1.35 * m,
        w: 0.2 * m,
        d: 2.7 * m,
        r: 0.03 * m,
      },
      0.72 * m,
      ZU - 0.72 * m + 0.02 * m,
      { tone: 'mid' },
    )
  }

  // Bogies: two Bo bogies, each a side frame outside the wheels with axleboxes, a coil spring stack and a damper.
  const GAUGE = 0.7175 * m
  for (const bc of [4.74, LEN_M - 4.74]) {
    for (const ax of [bc - 1.5, bc + 1.5]) {
      for (const sd of [1, -1]) {
        const yOut = sd > 0 ? GAUGE + 0.14 * m : -GAUGE
        wheel(W, 'wheel', x(ax), yOut, WR, 0.14 * m, { rim: 0.78, lugs: 0, steel: true })
      }
      W.disc('axle', YF([x(ax), -GAUGE, WR]), 0, 2 * GAUGE, 0.09 * m, { tone: 'lo' })
    }
    for (const sd of [1, -1]) {
      const y0 = sd > 0 ? 1.0 * m : -1.14 * m
      const sideFrame = [
        [x(bc - 2.25), 0.62 * m],
        [x(bc + 2.25), 0.62 * m],
        [x(bc + 2.4), 0.8 * m],
        [x(bc + 2.25), 1.0 * m],
        [x(bc - 2.25), 1.0 * m],
        [x(bc - 2.4), 0.8 * m],
      ]
      W.prism('bogie.frame', SIDE(y0), sideFrame, 0, 0.14 * m, { tone: 'mid' })
      for (const ax of [bc - 1.5, bc + 1.5]) {
        const yb = sd > 0 ? 1.14 * m : -1.3 * m
        const box = [
          [x(ax - 0.24), 0.42 * m],
          [x(ax + 0.24), 0.42 * m],
          [x(ax + 0.24), 0.78 * m],
          [x(ax - 0.24), 0.78 * m],
        ]
        W.prism('bogie.axlebox', SIDE(yb), box, 0, 0.16 * m, {
          tone: 'hi',
          extra:
            sd > 0 ? D([at([x(ax), yb + 0.16 * m, WR])], { size: 0.07 * m * KS, tone: 'hi' }) : '',
        })
      }
      // secondary spring between frame and underframe, over the bogie centre
      const ys = sd > 0 ? 1.0 * m : -1.14 * m
      W.disc(
        'bogie.spring',
        G.frameOf([x(bc), ys + 0.07 * m, 1.0 * m], [0, 0, 1], [1, 0, 0], [0, 1, 0]),
        0,
        ZU - 1.0 * m,
        0.12 * m,
        {
          tone: 'mid',
          inner: fine(
            L(
              [0.25, 0.5, 0.75]
                .map((t) =>
                  G.arcOf(
                    G.frameOf([x(bc), ys + 0.07 * m, 1.0 * m], [0, 0, 1], [1, 0, 0], [0, 1, 0]),
                    t * (ZU - 1.0 * m),
                    0.12 * m,
                    P,
                  ),
                )
                .join(''),
              { tone: 'lo' },
            ),
          ),
        },
      )
    }
  }
  return {
    W,
    label:
      'A four-axle electric locomotive in side three-quarter view, pantograph raised, with its body in the livery colour.',
    foot: { x: x(0.4), y: -1.5 * m, w: (LEN_M - 0.8) * m, d: 3 * m, r: 4 },
  }
}

// ======================================================================================================
// Car: a Porsche 993-type 911 Carrera coupé (1994–98), no badges or text. Factory figures: 4.245 m long, 1.735 m
// wide, 1.30 m tall, 2.272 m wheelbase. Proportions and line positions are taken (not traced) from a 993 side
// elevation (the-blueprints.com, "Porsche 911 (993) 1995"), whose stations are mapped piecewise onto the factory
// length and wheelbase (tail → rear axle → front axle → nose), heights scaled to the 1.30 m roof. Stations in metres
// from the tail (xs), heights above the ground (z):
//   rear axle 1.073 (rear overhang 1.073, tail to rear tyre 0.69), front axle 3.345 (front overhang 0.90)
//   wheel centres = tyre radii: rear 0.330, front 0.320; arch radii 0.38 / 0.365
//   sill 0.19 · beltline (DLO bottom, door top) 0.915 from 1.14 to 2.54
//   roof peak 1.30 at 1.9–2.2 (over the driver), one slope to the tail: 1.15 at 1.29, 0.99 at 0.84, 0.81 at 0.35,
//   0.69 at the tail-light top (0.08), tail face 0.38–0.60; A-pillar base (windscreen foot) 2.54 at 0.915, cowl 2.84 at 0.92
//   front-wing line: 0.91 at 2.94, 0.85 at the front axle, 0.79 at 3.85, 0.62 at 4.09; nose top 0.53 at 4.21;
//   bonnet centre 0.11 below the wing tops; front bumper face 0.26–0.54 at the nose
//   DLO: quarter window 1.09–1.58 (rear edge parallel to the roof), B-pillar 1.58–1.67, door glass 1.67–2.54
//   door 1.67–2.84, bottom 0.36 · mirror 2.55–2.69 at 0.84–1.02 · light bar 0.60–0.70, wrapping to 0.34
//   rear bumper below 0.585, back to 0.62 · sill line 0.30 between the arches · arch lips 22 mm outside the arches
//   headlamps on the wing tops: 3.90–4.16, centred 0.55 off the centreline
// Plan (estimated from the factory width): 0.825 half-width along the doors, swelling from the door's rear third
// (2.05) to 0.8675 over the rear wheel, the widest point; the front wings run flush into the bumper. One lofted tub
// (bumpers, wings, haunches, bonnet valley between the wing tops) and one lofted greenhouse (windscreen, roof, the
// fastback down onto the plain Carrera engine lid with its grille), shaded with continuous tone contours.
// ======================================================================================================
function car(len = LEN) {
  const W = workshop('road')
  const LEN_M = 4.245
  const m = len / LEN_M
  const x = (xs) => LEN - len + xs * m // xs: metres from the tail
  const RW = 1.073
  const FW = RW + 2.272
  const WR = { rear: 0.33, front: 0.32 }
  const TW = { rear: 0.255, front: 0.205 }
  const AR = { rear: 0.38, front: 0.365 }
  const W3 = ([a, y, z]) => [x(a), y * m, z * m]
  const smooth = (t) => t * t * (3 - 2 * t)
  const clamp01 = (t) => Math.min(1, Math.max(0, t))
  // Monotone cubic (Fritsch–Carlson) through the stations: no flat spots at the knots, so the shading stays smooth.
  const lerpTable = (table) => {
    const n = table.length
    const d = table
      .slice(1)
      .map(([x0, y0], i) => (table[i + 1][1] - table[i][1]) / (table[i + 1][0] - table[i][0]))
    const t = table.map((_, i) =>
      i === 0
        ? d[0]
        : i === n - 1
          ? d[n - 2]
          : d[i - 1] * d[i] <= 0
            ? 0
            : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]),
    )
    return (xs) => {
      if (xs <= table[0][0]) return table[0][1]
      if (xs >= table[n - 1][0]) return table[n - 1][1]
      let i = 0
      while (xs > table[i + 1][0]) i++
      const [x0, y0] = table[i]
      const [x1, y1] = table[i + 1]
      const h = x1 - x0
      const u = (xs - x0) / h
      const h00 = 2 * u ** 3 - 3 * u ** 2 + 1
      const h10 = u ** 3 - 2 * u ** 2 + u
      const h01 = -2 * u ** 3 + 3 * u ** 2
      const h11 = u ** 3 - u ** 2
      return h00 * y0 + h10 * h * t[i] + h01 * y1 + h11 * h * t[i + 1]
    }
  }
  const se = (c, nE) => Math.sign(c) * Math.abs(c) ** (2 / nE)

  // ---------- the tub ----------
  const zBot = lerpTable([
    [0, 0.38],
    [0.08, 0.35],
    [0.5, 0.24],
    [1.7, 0.19],
    [2.9, 0.19],
    [3.85, 0.22],
    [4.15, 0.26],
    [4.245, 0.34],
  ])
  const zTop = lerpTable([
    [0, 0.6],
    [0.08, 0.69],
    [0.35, 0.785],
    [0.6, 0.855],
    [1.0, 0.9],
    [1.4, 0.915],
    [2.84, 0.925],
    [3.0, 0.925],
    [3.345, 0.885],
    [3.85, 0.815],
    [3.97, 0.78],
    [4.09, 0.65],
    [4.2, 0.56],
    [4.245, 0.49],
  ])
  // Half-width: haunch swell from the door's rear third into the rear arch; rounded plan ends.
  const halfCore = (xs) => {
    const haunch =
      smooth(clamp01((2.05 - xs) / 0.7)) * (1 - smooth(clamp01((0.75 - xs) / 0.75)) * 0.35)
    return 0.825 + 0.0425 * haunch
  }
  const endRound = (xs, r0, r1, end) => {
    const d0 = Math.max(0, r0 - xs)
    const d1 = Math.max(0, xs - (end - r1))
    const r = d0 > 0 ? r0 : r1
    const d = Math.max(d0, d1)
    return d > 0 ? r - Math.sqrt(Math.max(0, r * r - d * d)) : 0
  }
  const halfW = (xs) => Math.max(0.001, halfCore(xs) - endRound(xs, 0.42, 0.55, LEN_M))
  // Bonnet valley between the front-wing tops.
  const dip = (xs) =>
    0.11 * smooth(clamp01((xs - 2.92) / 0.35)) * (1 - smooth(clamp01((xs - 3.95) / 0.27)))
  // Taut section: a near-flat flank with a tight shoulder (high superellipse exponent above the waist).
  const N_TOP = Number(process.env.CAR_NTOP ?? 7.5)
  const N_BOT = 10
  // Rear bumper: the tail below the light bar stands 18 mm proud of the body, ending ahead of the rear arch.
  const BUMPER_TOP = 0.585
  const bumper = (xs, z) =>
    0.018 *
    (1 - smooth(clamp01((z - (BUMPER_TOP - 0.03)) / 0.03))) *
    (1 - smooth(clamp01((xs - 0.55) / 0.12)))
  const tubAt = (xs, th) => {
    const zb = zBot(xs)
    const zt = zTop(xs)
    const zc = (zb + zt) / 2
    const h = (zt - zb) / 2
    const s = Math.sin(th)
    const nE = s >= 0 ? N_TOP : N_BOT
    const y = halfW(xs) * se(Math.cos(th), nE)
    const u = y / halfW(xs)
    const valley = s > 0 ? dip(xs) * (1 - smooth(clamp01((Math.abs(u) - 0.4) / 0.42))) * s ** 2 : 0
    const z = zc + h * se(s, nE) - valley
    return [xs, y + Math.sign(y) * bumper(xs, z) * Math.abs(u) ** 6, z]
  }
  // ---------- the greenhouse ----------
  const ghTop = lerpTable([
    [0.12, 0.715],
    [0.228, 0.765],
    [0.351, 0.809],
    [0.474, 0.862],
    [0.597, 0.91],
    [0.72, 0.953],
    [0.844, 0.992],
    [0.967, 1.032],
    [1.087, 1.072],
    [1.191, 1.112],
    [1.294, 1.149],
    [1.397, 1.19],
    [1.5, 1.235],
    [1.603, 1.262],
    [1.706, 1.281],
    [1.809, 1.292],
    [1.95, 1.3],
    [2.2, 1.3],
    [2.324, 1.276],
    [2.427, 1.199],
    [2.53, 1.125],
    [2.633, 1.048],
    [2.736, 0.968],
    [2.84, 0.925],
  ])
  const GH0 = 0.12
  const GH1 = 2.84
  const ghBot = (xs) => zTop(xs) - 0.04
  const ghHalf = (xs) =>
    Math.max(
      0.001,
      0.64 - endRound(xs - GH0, 0.2, 0.18, GH1 - GH0) - 0.05 * smooth(clamp01((xs - 2.3) / 0.54)),
    )
  const GH_TAPER = 0.26
  const ghAt = (xs, th) => {
    const zb = ghBot(xs)
    const zt = Math.max(zb + 0.001, ghTop(xs))
    const zc = (zb + zt) / 2
    const h = (zt - zb) / 2
    const s = Math.sin(th)
    const nE = s >= 0 ? 4.5 : 12
    const z = zc + h * se(s, nE)
    const w = ghHalf(xs) * (1 - GH_TAPER * clamp01((z - zb) / (zt - zb)))
    return [xs, w * se(Math.cos(th), nE), z]
  }

  // Rings and surface lookups.
  const RING = Number(process.env.CAR_RING ?? 36)
  const stationsOf = (x0, x1, count) =>
    Array.from(
      { length: count },
      (_, i) =>
        x0 + 0.0008 + (x1 - x0 - 0.0016) * (0.5 - 0.5 * Math.cos(Math.PI * (i / (count - 1)))),
    )
  const ringsOf = (f, x0, x1, count) =>
    stationsOf(x0, x1, count).map((xs) =>
      Array.from({ length: RING }, (_, j) => W3(f(xs, (j / RING) * 2 * Math.PI))),
    )
  // The section at xs as a (y, z) polygon, and the near-side surface y at height z (outermost crossing), or null.
  const sectionOf = (f, xs, count = 160) =>
    Array.from({ length: count }, (_, j) => f(xs, (j / count) * 2 * Math.PI)).map(([, y, z]) => [
      y,
      z,
    ])
  const nearOf = (f) => (xs, z) => {
    const sec = sectionOf(f, xs)
    let best = null
    for (let i = 0; i < sec.length; i++) {
      const [y0, z0] = sec[i]
      const [y1, z1] = sec[(i + 1) % sec.length]
      if ((z0 - z) * (z1 - z) <= 0 && z0 !== z1) {
        const y = y0 + ((y1 - y0) * (z - z0)) / (z1 - z0)
        if (best === null || y > best) best = y
      }
    }
    return best !== null && best > 0 ? best : null
  }
  const inside = (sec, y, z) => {
    let c = false
    for (let i = 0, j = sec.length - 1; i < sec.length; j = i++) {
      const [yi, zi] = sec[i]
      const [yj, zj] = sec[j]
      if (zi > z !== zj > z && y < ((yj - yi) * (z - zi)) / (zj - zi) + yi) c = !c
    }
    return c
  }
  const tubNear = nearOf(tubAt)
  const ghNear = nearOf(ghAt)
  const on = (near, xs, z, out = 0.004) => {
    const y = near(xs, z)
    return y === null ? null : W3([xs, y + out, z])
  }
  const outlineOn = (near, corners, steps = 6) => {
    const pts = []
    for (let i = 0; i < corners.length; i++) {
      const [ax, az] = corners[i]
      const [bx, bz] = corners[(i + 1) % corners.length]
      for (let t = 0; t < steps; t++)
        pts.push(on(near, ax + ((bx - ax) * t) / steps, az + ((bz - az) * t) / steps))
    }
    return pathOf(pts.filter(Boolean), true)
  }

  // ---------- tub item: door, handle, side lamp wrap, headlamps in the wing fronts ----------
  const door = outlineOn(
    tubNear,
    [
      [1.91, 0.36],
      [2.84, 0.36],
      [2.84, 0.9],
      [1.667, 0.9],
      [1.7, 0.6],
      [1.757, 0.44],
    ],
    8,
  )
  const handle = outlineOn(
    tubNear,
    [
      [1.72, 0.765],
      [1.9, 0.765],
      [1.9, 0.8],
      [1.72, 0.8],
    ],
    2,
  )
  // The full-width light bar across the tail, seen as its wrap round the near rear corner, down to the tail face.
  const sideLamp = outlineOn(
    tubNear,
    [
      [0.004, BUMPER_TOP + 0.01],
      [0.34, BUMPER_TOP + 0.02],
      [0.32, 0.7],
      [0.004, 0.672],
    ],
    8,
  )
  const lineOn = (near, from, to, steps = 16) =>
    pathOf(
      Array.from({ length: steps + 1 }, (_, i) =>
        on(
          near,
          from[0] + ((to[0] - from[0]) * i) / steps,
          from[1] + ((to[1] - from[1]) * i) / steps,
        ),
      ).filter(Boolean),
    )
  const bumperLine = lineOn(tubNear, [0.004, BUMPER_TOP - 0.012], [0.62, BUMPER_TOP - 0.012], 12)
  const sill = lineOn(tubNear, [RW + AR.rear + 0.03, 0.3], [RW + 2.272 - AR.front - 0.03, 0.3], 12)
  // Headlamps: flattened ellipsoids set into the wing tops, following their slope down to the bumper. Each is an
  // ellipse in plan (along the car, across it) dropped onto the tub's upper surface and lifted a hair.
  const topAt = (xs, y) => {
    const sec = sectionOf(tubAt, xs, 200)
    let best = null
    for (let i = 0; i < sec.length; i++) {
      const [y0, z0] = sec[i]
      const [y1, z1] = sec[(i + 1) % sec.length]
      if ((y0 - y) * (y1 - y) <= 0 && y0 !== y1) {
        const z = z0 + ((z1 - z0) * (y - y0)) / (y1 - y0)
        if (best === null || z > best) best = z
      }
    }
    return best
  }
  const lampOf = (yc) => {
    const pts = []
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * 2 * Math.PI
      let xs = 4.03 + 0.13 * Math.cos(a)
      const y = yc + 0.085 * Math.sin(a)
      let z = topAt(xs, y)
      while (z === null && xs > 3.6) z = topAt((xs -= 0.01), y)
      pts.push(W3([xs, y, z + 0.006]))
    }
    return pathOf(pts, true)
  }
  const lamps = [0.55, -0.55].map(lampOf).join('')
  const tubProfile = stationsOf(0, LEN_M, 40).flatMap((xs) => [
    [x(xs), zTop(xs) * m],
    [x(xs), zBot(xs) * m],
  ])
  const tubRings = ringsOf(tubAt, 0, LEN_M, Number(process.env.CAR_ST ?? 64))
  const HIN = 0.6 // stand-in half-width, inside the wheels' inner faces
  const mirrorY = tubNear(2.62, 0.86) - 0.01
  W.put(
    'body',
    [x(2.1), 0, 0.5 * m],
    S(loftSmoothOf(tubRings), { tone: 'hi' }) +
      L(sill + bumperLine, { tone: 'mid' }) +
      fine(L(door + handle, { tone: 'mid' })) +
      `<path class="lv-lamp" d="${sideLamp + lamps}"/>` +
      L(sideLamp + lamps, { tone: 'hi' }),
    [
      A.prism(SIDE(-HIN * m), G.hullOf(tubProfile), 0, 2 * HIN * m, {}),
      A.prism(
        SIDE(HIN * m),
        [
          [x(2.55), 0.8 * m],
          [x(2.7), 0.8 * m],
          [x(2.7), 0.88 * m],
          [x(2.55), 0.88 * m],
        ],
        0,
        (mirrorY - HIN) * m,
        {},
      ),
    ],
    { livery: true, own: 'road.body' },
  )

  // ---------- greenhouse item: one long DLO, windscreen, engine-lid grille ----------
  const glass = (corners) => {
    const d = outlineOn(ghNear, corners, 6)
    return `<path class="lv-glass" d="${d}"/>` + L(d, { tone: 'hi' })
  }
  // Quarter window (rear edge parallel to the roof slope), slim B-pillar, door glass up to the A-pillar.
  const dlo =
    glass([
      [1.087, 0.95],
      [1.653, 0.925],
      [1.577, 1.167],
      [1.42, 1.11],
      [1.25, 1.035],
    ]) +
    glass([
      [1.69, 0.925],
      [2.53, 0.925],
      [2.18, 1.207],
      [1.63, 1.207],
    ])
  const gr = (xs, th) => W3(ghAt(xs, th))
  const wsPts = []
  const wsX = [2.34, 2.825]
  const WS = [20, 160]
  for (let i = 0; i <= 8; i++) wsPts.push(gr(wsX[0] + ((wsX[1] - wsX[0]) * i) / 8, WS[0] * DEG))
  for (let i = 0; i <= 12; i++) wsPts.push(gr(wsX[1], (WS[0] + ((WS[1] - WS[0]) * i) / 12) * DEG))
  for (let i = 8; i >= 0; i--) wsPts.push(gr(wsX[0] + ((wsX[1] - wsX[0]) * i) / 8, WS[1] * DEG))
  for (let i = 12; i >= 0; i--) wsPts.push(gr(wsX[0], (WS[0] + ((WS[1] - WS[0]) * i) / 12) * DEG))
  const ws = pathOf(
    wsPts.map((p) => G.add3(p, [0.02, 0, 0.02])),
    true,
  )
  const lift = (p) => G.add3(p, [0, 0, 0.012 * m])
  const gx = [0.3, 0.62]
  const gth = [64, 116]
  const gp = []
  for (let i = 0; i <= 6; i++) gp.push(lift(gr(gx[0] + ((gx[1] - gx[0]) * i) / 6, gth[0] * DEG)))
  for (let i = 0; i <= 6; i++)
    gp.push(lift(gr(gx[1], (gth[0] + ((gth[1] - gth[0]) * i) / 6) * DEG)))
  for (let i = 6; i >= 0; i--) gp.push(lift(gr(gx[0] + ((gx[1] - gx[0]) * i) / 6, gth[1] * DEG)))
  for (let i = 6; i >= 0; i--)
    gp.push(lift(gr(gx[0], (gth[0] + ((gth[1] - gth[0]) * i) / 6) * DEG)))
  const grille = pathOf(gp, true)
  const slats = [0.36, 0.42, 0.48, 0.54, 0.6]
    .map((xs) =>
      pathOf(
        Array.from({ length: 7 }, (_, i) =>
          lift(gr(xs, (gth[0] + ((gth[1] - gth[0]) * i) / 6) * DEG)),
        ),
      ),
    )
    .join('')
  const ghRings = ringsOf(ghAt, GH0, GH1, Number(process.env.GH_ST ?? 44))
  const ghProfile = stationsOf(GH0, GH1, 30).flatMap((xs) => [
    [x(xs), ghTop(xs) * m],
    [x(xs), ghBot(xs) * m],
  ])
  W.put(
    'greenhouse',
    [x(1.6), 0, 1.05 * m],
    S({ ...loftSmoothOf(ghRings), outline: outlineOutside(ghRings, tubRings) }, { tone: 'hi' }) +
      dlo +
      `<path class="lv-glass" d="${ws}"/>` +
      L(ws, { tone: 'hi' }) +
      `<path class="lv-void" d="${grille}"/>` +
      L(grille, { tone: 'mid' }) +
      fine(L(slats, { tone: 'lo' })),
    [A.prism(SIDE(-0.45 * m), G.hullOf(ghProfile), 0, 0.9 * m, {})],
    { livery: true, own: 'road.body', bias: 1 },
  )
  // Door mirror at the front of the door glass.
  const mirrorShape = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * 2 * Math.PI
    return [x(2.62 + 0.075 * se(Math.cos(a), 2.6)), (0.95 + 0.06 * se(Math.sin(a), 2.6)) * m]
  })
  W.put(
    'mirror.near',
    [x(2.62), mirrorY * m, 0.95 * m],
    S(G.prismOf(SIDE(mirrorY * m), mirrorShape, 0, 0.13 * m, P), { tone: 'hi', crease: 'faint' }),
    [
      A.prism(SIDE(mirrorY * m), mirrorShape, 0, 0.13 * m, {}),
      A.prism(
        SIDE((mirrorY - 0.06) * m),
        [
          [x(2.6), 0.86 * m],
          [x(2.66), 0.86 * m],
          [x(2.66), 0.9 * m],
          [x(2.6), 0.9 * m],
        ],
        0,
        0.07 * m,
        {},
      ),
    ],
    { livery: true, own: 'road.body' },
  )

  // ---------- wheels in arches ----------
  const arch = (cx, r, zc) => {
    const pts = []
    for (let i = 0; i <= 22; i++) {
      const t = Math.PI - (i / 22) * Math.PI
      const p = on(tubNear, cx + r * Math.cos(t), Math.max(0.2, zc + r * Math.sin(t) - 0.005))
      if (p) pts.push(p)
    }
    return pathOf(pts, true)
  }
  // Raised arch lip: a half-round bead (28 mm round the arch, 18 mm proud) following the arch on the flank, tapering
  // out at its feet. Shaded as a smooth loft without a hull fill, so it never covers the opening.
  const lip = (ax, key) => {
    const R0 = AR[key] + 0.022
    const zc = WR[key]
    const t0 = -Math.asin(Math.min(0.9, (zc - 0.25) / R0))
    const N = 26
    const LR = 10
    const rings = Array.from({ length: N }, (_, i) => {
      const t = t0 + ((Math.PI - 2 * t0) * i) / (N - 1)
      const taper = smooth(clamp01(Math.min(i, N - 1 - i) / 4))
      const cx = ax - R0 * Math.cos(t)
      const cz = zc + R0 * Math.sin(t)
      const yS = tubNear(cx, cz) ?? 0.8
      return Array.from({ length: LR }, (_, j) => {
        const f = (j / LR) * 2 * Math.PI
        const rad = 0.028 * taper * Math.cos(f)
        return W3([
          cx - rad * Math.cos(t),
          yS + 0.018 * taper * Math.sin(f),
          cz + rad * Math.sin(t),
        ])
      })
    })
    const sm = loftSmoothOf(rings)
    const edge = (j) => pathOf(rings.map((r) => r[j]))
    const band = Array.from({ length: 24 }, (_, i) => {
      const t = t0 + ((Math.PI - 2 * t0) * i) / 23
      return [x(ax - R0 * Math.cos(t)), (zc + R0 * Math.sin(t)) * m]
    })
    const inner = band.map(([px, pz]) => [
      x(ax) + (px - x(ax)) * 0.93,
      zc * m + (pz - zc * m) * 0.93,
    ])
    const yL = (tubNear(ax, zc + R0) ?? 0.8) - 0.01
    W.put(
      `lip.${key}.near`,
      [x(ax), yL * m, (zc + R0) * m],
      S({ ...sm, fill: '', outline: '' }, { tone: 'hi' }) +
        L(edge(LR / 2) + edge(Math.round(LR / 4)), { tone: 'mid' }),
      // Recorded from inside the body stand-in out to the bead, so it rests on the body.
      [
        A.prism(
          SIDE((HIN - 0.01) * m),
          [...band, ...inner.reverse()],
          0,
          (yL + 0.03 - HIN + 0.01) * m,
          {},
        ),
      ],
      { livery: true, own: 'road.body' },
    )
  }
  for (const [ax, key] of [
    [RW, 'rear'],
    [FW, 'front'],
  ]) {
    for (const sd of [1, -1]) {
      const r = WR[key] * m
      const face = TW[key] * m
      const yo = tubNear(ax, 0.42) - 0.025
      const yOut = sd > 0 ? yo * m : -yo * m + face
      const F = YF([x(ax), yOut - face, r])
      const spokes = G.spokesOf(F, face, r * 0.2, r * 0.66, 5, P, { phase: 0.3 })
      const rr = (q) => G.circleOf(F, face, q, P)
      const opening = sd > 0 ? arch(ax, AR[key], WR[key]) : ''
      const extra =
        `<g class="lv-steel"><path class="iso-fill" d="${rr(r * 0.68)}"/></g>` +
        L(rr(r * 0.68) + rr(r * 0.2), { tone: 'mid' }) +
        fine(L(spokes, { tone: 'mid' }))
      W.put(
        `wheel.${key}.${sd > 0 ? 'near' : 'far'}`,
        G.add3(F.o, G.mul3(F.a, face / 2)),
        (opening ? `<path class="lv-void" d="${opening}"/>` + L(opening, { tone: 'mid' }) : '') +
          `<g class="lv-rubber">${S(G.disc(0, face, r, F, P, { steps: STEPS.disc }), { tone: 'hi', crease: 'lo' })}</g>` +
          extra,
        [A.disc(F, 0, face, r, {})],
        { own: 'road.body' },
      )
      if (sd > 0) lip(ax, key)
    }
  }
  return {
    W,
    label:
      'A rear-engined sports coupé in side three-quarter view, with its body in the livery colour.',
    // Near wheels sit in arch openings painted on the flank: painted last, excused against the body they overlap.
    last: /^road\.(wheel\..*\.near|lip\..*)$/,
    // The greenhouse sits on the tub with its foot just inside the belt: drawn after the tub, like a roof on a box.
    allow: [
      ['road.greenhouse', 'road.body'],
      ['road.body', 'road.wheel*'],
      ['road.lip*', 'road.body'],
      ['road.lip*', 'road.wheel*'],
      ['road.greenhouse', 'road.wheel*'],
      ['road.mirror*', 'road.wheel*'],
    ],
    foot: { x: x(0.05), y: -0.8 * m, w: 4.15 * m, d: 1.6 * m, r: 6 },
  }
}

// ======================================================================================================
// Build, scope the kit CSS, write the SVGs and the gate page.
// ======================================================================================================
const BUILDERS = { air: airliner, rail: locomotive, road: car }
const AREA = Object.fromEntries(
  Object.entries(BUILDERS).map(([key, build]) => [key, silhouetteArea(build().W.R.items)]),
)
const LENGTHS = Object.fromEntries(
  Object.keys(BUILDERS).map((key) => [
    key,
    process.env.BY_LENGTH ? LEN : LEN * Math.sqrt(AREA.air / AREA[key]),
  ]),
)
console.log(
  `silhouette area at length 100: ${Object.entries(AREA)
    .map(([key, a]) => `${key} ${a.toFixed(0)}`)
    .join(' · ')} → lengths ${Object.entries(LENGTHS)
    .map(([key, l]) => `${key} ${l.toFixed(1)}`)
    .join(' · ')}`,
)
const vehicles = Object.fromEntries(
  Object.entries(BUILDERS).map(([key, build]) => [key, emit(build(LENGTHS[key]), key)]),
)

// ViewBox: the union of every vehicle's drawing plus a margin, the same for all three.
const VB = [BOUNDS[0] - 1.5, BOUNDS[1] - 1.5, BOUNDS[2] - BOUNDS[0] + 3, BOUNDS[3] - BOUNDS[1] + 3]
const groundAt = (x) => sheared(at([x, 0, 0]))

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'vehicles.css'), css)

const svgOf = (key, { standalone = false } = {}) => {
  const v = vehicles[key]
  const ns = standalone ? ' xmlns="http://www.w3.org/2000/svg"' : ''
  // A standalone file carries the dark theme's tokens as a fallback so it renders on its own; inline copies inherit the page's.
  const style = standalone
    ? `<style><![CDATA[svg.lane-vehicle{${THEMES.dark.replace(/\s+/g, '')};--lane-livery:var(--stamp-ink-indigo)}\n${css}]]></style>`
    : ''
  return `<svg${ns} class="iso-svg lane-vehicle" data-vehicle="${key}" viewBox="${VB.map(f1).join(' ')}" role="img" aria-label="${v.label}">${style}<g class="lane-art">${v.body}</g></svg>`
}
// One sprite of <symbol>s, one per vehicle type; each lane draws a <use>. Colour roles, the livery and the detail
// switch are inherited custom properties, so they pass from the <use>'s ancestors into the clone.
const symbols = Object.keys(vehicles)
  .map(
    (key) =>
      `<symbol id="lane-${key}" viewBox="${VB.map(f1).join(' ')}"><style>${ART_CSS.replace(/\s*\n\s*/g, '')}</style><g class="lane-art">${vehicles[key].body}</g></symbol>`,
  )
  .join('')
const sprite = (standalone) =>
  standalone
    ? `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg lane-vehicle"><style><![CDATA[${HOST_CSS}]]></style>${symbols}</svg>`
    : `<svg class="iso-svg lane-vehicle lane-sprite" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${symbols}</svg>`
writeFileSync(join(OUT, 'sprite.svg'), sprite(true))
console.log(
  `sprite.svg: ${(sprite(true).length / 1024).toFixed(1)} KB (${(symbols.length / 1024).toFixed(1)} KB of symbols)`,
)
const useOf = (key) =>
  `<svg class="iso-svg lane-vehicle" data-vehicle="${key}" viewBox="${VB.map(f1).join(' ')}" role="img" aria-label="${vehicles[key].label}"><use href="#lane-${key}" x="${f1(VB[0])}" y="${f1(VB[1])}" width="${f1(VB[2])}" height="${f1(VB[3])}"/></svg>`
for (const key of Object.keys(vehicles)) {
  const inline = svgOf(key)
  writeFileSync(join(OUT, `${key}.svg`), svgOf(key, { standalone: true }))
  writeFileSync(join(OUT, `${key}.inline.svg`), inline)
  console.log(
    `${key}: ${vehicles[key].items} items · inline ${(inline.length / 1024).toFixed(1)} KB`,
  )
}

// ---------- the gate page ----------
const meta = { viewBox: VB, nose: groundAt(LEN), tail: groundAt(0) }
writeFileSync(
  join(OUT, 'meta.json'),
  JSON.stringify({ ...meta, azimuth: AZ, elevation: EL, slope: SLOPE }, null, 2),
)
const DRAWN = meta.nose[0] - meta.tail[0] // screen length of the 100-unit vehicle, viewBox units
const svgWidth = (px) => (px * VB[2]) / DRAWN
const noseFrac = (meta.nose[0] - VB[0]) / VB[2]
const groundFrac = (meta.nose[1] - VB[1]) / VB[3]
const LANES = [
  { key: 'air', who: 'Mika', value: '312 flights', frac: 1, ink: 'indigo' },
  { key: 'rail', who: 'Juno', value: '200 trips', frac: 0.64, ink: 'oxblood' },
  { key: 'road', who: 'Ola', value: '125 trips', frac: 0.4, ink: 'moss' },
]
const vehicleHtml = (key, px, ink, extra = '') =>
  vehicles[key]
    ? `<div class="veh lane-veh" style="width:${f1(svgWidth(px))}px;--lane-livery:var(--stamp-ink-${ink})${extra}">${useOf(key)}</div>`
    : `<div class="veh missing" style="width:${f1(svgWidth(px))}px">${key}?</div>`
const lanes = (px) =>
  LANES.map(
    ({ key, who, value, frac, ink }) => `<div class="lane">
  <div class="who"><b>${who}</b><span>${value}</span></div>
  <div class="track" style="--px:${px};--h:${f1((svgWidth(px) * VB[3]) / VB[2])}px">
    <div class="road" style="top:calc(var(--h) * ${f1(groundFrac)})"></div>
    <div class="slot" style="left:calc(${frac * 100}% - ${f1(svgWidth(px) * noseFrac)}px)">${vehicleHtml(key, px, ink)}</div>
  </div>
</div>`,
  ).join('')
const block = (theme) => `<section class="theme" data-theme="${theme}" style="${THEMES[theme]}">
<h2>${theme}</h2>
<div class="cols">
  <div class="col" style="width:390px"><h3>390 px column · airliner 64 px (equal silhouette area)</h3><div class="card" data-size="s">${lanes(64)}</div></div>
  <div class="col" style="width:720px"><h3>720 px column · airliner 140 px</h3><div class="card" data-size="l">${lanes(140)}</div></div>
</div>
<h3>Two liveries, 140 px</h3>
<div class="row">${['air', 'rail', 'road'].map((key) => vehicleHtml(key, 140, 'indigo') + vehicleHtml(key, 140, 'oxblood')).join('')}</div>
<h3>Two liveries, 64 px</h3>
<div class="row" data-size="s">${['air', 'rail', 'road'].map((key) => vehicleHtml(key, 64, 'indigo') + vehicleHtml(key, 64, 'oxblood')).join('')}</div>
<h3>4× (560 px)</h3>
<div class="zoom">${['air', 'rail', 'road'].map((key) => `<div class="z" data-key="${key}">${vehicleHtml(key, 560, 'teal')}</div>`).join('')}</div>
</section>`
const page = `<!doctype html><html><head><meta charset="utf-8"><title>Lanes gate</title>
<style>
${css}
*{box-sizing:border-box}
body{margin:0;font:13px/1.4 Commissioner,system-ui,sans-serif}
.theme{background:var(--background);color:var(--text);padding:24px 28px 40px}
h2{margin:0 0 12px;font-size:15px;text-transform:uppercase;letter-spacing:.08em}
h3{margin:18px 0 8px;font-size:12px;font-weight:500;color:var(--text-muted)}
.cols{display:flex;gap:40px;align-items:flex-start}
.card{background:var(--surface);border-radius:14px;padding:14px 16px;display:grid;gap:10px}
.lane{display:grid;gap:2px}
.who{display:flex;gap:8px;align-items:baseline}.who span{color:var(--text-muted);font-size:12px}
.track{position:relative;height:var(--h)}
.road{position:absolute;left:0;right:0;height:max(4px, calc(var(--h) * .16));translate:0 -50%;background:var(--surface-inset);border-radius:999px}
.slot{position:absolute;top:0}
.veh{flex:none}
.veh.missing{height:20px;outline:1px dashed var(--text-muted)}
.lane-vehicle{--lane-halo-blur:2px}
[data-size=s] .lane-vehicle{--lane-halo-blur:1px}
.row{display:flex;gap:28px;align-items:end;flex-wrap:wrap}
.zoom{display:grid;gap:12px}
.z{background:var(--surface);border-radius:14px;padding:12px;width:fit-content}
.z .lane-vehicle{--lane-halo-blur:8px}
</style></head><body>
${sprite(false)}
${block('dark')}
${block('light')}
</body></html>`
writeFileSync('.scratch/leaderboard-lanes/gate.html', page)
console.log(`gate.html · viewBox ${VB.map(f1).join(' ')} · drawn length ${f1(DRAWN)}`)

// The line-end check cannot see into <use> clones, so it runs on this page: the same drawings inlined at 560 px.
writeFileSync(
  '.scratch/leaderboard-lanes/lines.html',
  `<!doctype html><html><head><meta charset="utf-8"><title>Lanes lines</title><style>${css}
body{margin:0}.theme{background:var(--background);padding:20px}.z{width:${f1(svgWidth(560))}px;padding:12px}</style></head><body>
${['dark', 'light']
  .map(
    (theme) =>
      `<section class="theme" data-theme="${theme}" style="${THEMES[theme]}">${Object.keys(vehicles)
        .map(
          (key) =>
            `<div class="z" data-key="${key}" style="--lane-livery:var(--stamp-ink-teal)">${svgOf(key)}</div>`,
        )
        .join('')}</section>`,
  )
  .join('')}
</body></html>`,
)
