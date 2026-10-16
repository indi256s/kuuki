import { Scene, type P3 } from '../../../overview/iso/scene'
import {
  ACCENT,
  add,
  circleOn,
  comb,
  disc,
  foil,
  frameAlong,
  lathe,
  screw,
  spline,
  tube,
  wheel,
  type Body,
  type FoilStation,
  type Section,
  D2R,
  mix,
} from './parts'
import { slabRot } from '../../../overview/iso/solids'
import type { LadderFigureDef } from './types'

// Flights: the aircraft that grows. Paper plane on a model stand, light single, turboprop, narrowbody, widebody.
// Frame: the nose points +x (right-down on screen), the viewer sees the +y flank and the top; the apron's top is z = GROUND.
// Every aircraft is built the same way: a lathe fuselage with smooth tone, lifting surfaces with a rounded leading edge,
// turned nacelles, spinners and tyres, and gear legs that land on axles. Painter's order runs far side, fuselage, near side.

const X: P3 = [1, 0, 0],
  Y: P3 = [0, 1, 0],
  Z: P3 = [0, 0, 1]
const GROUND = 3
const AXIS = frameAlong([0, 0, 0], X)

// ---------------------------------------------------------------- ground

/** Apron slab with expansion joints edge to edge and a dashed taxi centreline. */
function apron(s: Scene, x0: number, x1: number, y0: number, y1: number, hero: boolean) {
  s.rbox(x0, y0, 0, x1 - x0, y1 - y0, GROUND, 3)
  if (!hero) return
  const n = Math.max(2, Math.round((x1 - x0) / 40))
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    s.line(
      [
        [x, y0, GROUND],
        [x, y1, GROUND],
      ],
      'crease',
      0.6,
    )
  }
  const yj = y0 + (y1 - y0) * 0.22
  s.line(
    [
      [x0 + 3, yj, GROUND],
      [x1 - 3, yj, GROUND],
    ],
    'crease',
    0.6,
  )
  for (let x = x0 + 7; x < x1 - 10; x += 12)
    s.poly(
      [
        [x, -0.45, GROUND],
        [x + 7, -0.45, GROUND],
        [x + 7, 0.45, GROUND],
        [x, 0.45, GROUND],
      ],
      'detail',
      'none',
    )
}

/** The aircraft's own shadow: its near-side plan outline mirrored, laid on the apron and slid away from the light. */
function planShadow(s: Scene, near: readonly (readonly [number, number])[], h: number) {
  const dx = -0.09 * h,
    dy = -0.26 * h
  const pts: P3[] = [
    ...near.map(([x, y]): P3 => [x + dx, y + dy, GROUND + 0.02]),
    ...[...near].reverse().map(([x, y]): P3 => [x + dx, -y + dy, GROUND + 0.02]),
  ]
  s.poly(pts, 'shadow', 'none')
}

/** A wheel chock: a wedge across the tyre's path, in front of it. */
function chock(s: Scene, x: number, y: number, w: number, r: number) {
  const h = r * 0.55,
    l = r * 0.9
  s.prism(
    [
      [x + l, GROUND],
      [x + l * 0.35, GROUND + h],
      [x, GROUND + h],
      [x, GROUND],
    ],
    y - w / 2,
    w,
  )
}

// ---------------------------------------------------------------- fuselage

type HullSpec = {
  tail: number
  tailStart: number
  noseStart: number
  nose: number
  R: number
  aspect: number
  Zc: number
  tailR: number
  /** How far the nose centre sinks as it narrows (0–1 of the lost radius), so the belly runs flat to the nose. */
  droop: number
  /** How far the tail centre rises as it narrows, so the crown runs flat to the tail. */
  upsweep: number
  /** Nose exponent: 2 is an ellipse, higher is blunter. */
  bluntness?: number
}

/** An airliner hull: an elliptic nose, a constant barrel and a tapering, upswept tail cone. */
function hullSection(h: HullSpec): (x: number) => Section {
  const p = h.bluntness ?? 2
  return (x) => {
    let r = h.R,
      lift = h.Zc
    if (x > h.noseStart) {
      const u = Math.min(1, (x - h.noseStart) / (h.nose - h.noseStart))
      r = h.R * Math.pow(Math.max(0, 1 - Math.pow(u, p)), 1 / p)
      lift = h.Zc - h.droop * (h.R - r) * h.aspect
    } else if (x < h.tailStart) {
      const u = Math.min(1, (h.tailStart - x) / (h.tailStart - h.tail))
      r = h.R - (h.R - h.tailR) * Math.pow(u, 1.7)
      lift = h.Zc + h.upsweep * (h.R - r) * h.aspect
    }
    return { r, rz: r * h.aspect, lift }
  }
}

/** Half-width of a section at height z (0 above or below it). */
function skinY(sec: (x: number) => Section, x: number, z: number) {
  const { r, rz = r, lift = 0 } = sec(x)
  const q = (z - lift) / rz
  return Math.abs(q) >= 1 ? 0 : r * Math.sqrt(1 - q * q)
}
/** Crown height at x, at half-width y. */
function crownZ(sec: (x: number) => Section, x: number, y = 0) {
  const { r, rz = r, lift = 0 } = sec(x)
  const q = Math.min(1, Math.abs(y) / r)
  return lift + rz * Math.sqrt(1 - q * q)
}
/** Belly height at x. */
function bellyZ(sec: (x: number) => Section, x: number) {
  const { r, rz = r, lift = 0 } = sec(x)
  return lift - rz
}

/** A row of cabin windows on the near flank at angle `deg`. */
function windows(
  b: Body,
  sec: (x: number) => Section,
  xs: readonly number[],
  deg: number,
  w: number,
  h: number,
) {
  for (const x of xs) {
    const dd = h / 2 / sec(x).r / D2R
    b.patch(
      [
        [x - w / 2, deg - dd],
        [x + w / 2, deg - dd],
        [x + w / 2, deg + dd],
        [x - w / 2, deg + dd],
      ],
      'glass',
      'crease',
    )
  }
}
/** A door outline on the near flank. */
function door(b: Body, x0: number, x1: number, d0: number, d1: number) {
  b.patch(
    [
      [x0, d0],
      [x1, d0],
      [x1, d1],
      [x0, d1],
    ],
    'none',
    'crease',
  )
}

// ---------------------------------------------------------------- propellers

/** Blades of a propeller in the plane facing +x: tapered paddles with rounded tips, `n` of them. */
function blades(s: Scene, c: P3, R: number, n: number, phase: number, chord: number) {
  const at = s.on(c, Y, [0, 0, -1])
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * 2 * Math.PI
    const p = (along: number, across: number): P3 =>
      at(along * Math.sin(a) + across * Math.cos(a), along * Math.cos(a) - across * Math.sin(a))
    const w = chord / 2
    s.poly(
      [
        p(R * 0.18, -w * 0.7),
        p(R * 0.45, -w * 1.15),
        p(R * 0.8, -w * 0.9),
        p(R * 0.96, -w * 0.5),
        p(R, 0),
        p(R * 0.96, w * 0.35),
        p(R * 0.8, w * 0.55),
        p(R * 0.45, w * 0.7),
        p(R * 0.18, w * 0.6),
      ],
      'accent',
      'accent',
      undefined,
      0.6,
    )
  }
}
/** A propeller turning: a faint disc with a fine rim, and the blades. Lives in the lit group. */
function propeller(s: Scene, c: P3, R: number, n: number, hero: boolean, chord: number) {
  const rim = s.circle(c, Y, [0, 0, -1], 0, 0, R, 40)
  s.poly(rim, 'accent', 'none', undefined, undefined, 0.14)
  s.poly(rim, 'none', 'accent', 0.9, hero ? 0.9 : 1.2)
  s.glow(3, () => blades(s, c, R, n, 0.42, chord))
  blades(s, c, R, n, 0.42, chord)
}
/** A spinner dome in front of the propeller plane. */
function spinner(s: Scene, x: number, y: number, z: number, r: number, l: number, hero: boolean) {
  const prof = spline([
    [0, r],
    [l * 0.3, r * 0.96],
    [l * 0.75, r * 0.6],
    [l, 0],
  ])
  lathe(s, frameAlong([x, y, z], X), (t) => ({ r: Math.max(0, prof(t)[0]) }), 0, l, {
    steps: hero ? 8 : 3,
    ring: hero ? 24 : 14,
    shade: hero,
  })
}

// ---------------------------------------------------------------- landing gear

/** A gear leg: oleo cylinder from the airframe, a chrome piston to the axle, twin (or single) wheels on a cross axle. */
function gearLeg(
  s: Scene,
  top: P3,
  axle: P3,
  o: { r: number; w: number; twin: boolean; leg: number; hero: boolean },
) {
  const { r, w, twin, leg, hero } = o
  const gap = twin ? w / 2 + leg * 1.6 : 0
  const wheelAt = (dy: number) => wheel(s, add(axle, [0, dy, 0]), Y, r, w, hero)
  // A single wheel whose leg comes from nearer the viewer sits behind it.
  const first = twin || top[1] > axle[1]
  if (first) wheelAt(twin ? -gap : 0)
  if (twin) tube(s, add(axle, [0, -gap, 0]), add(axle, [0, gap, 0]), leg * 0.55, { shade: hero })
  const mid = comb(axle, [0.45, add(top, [-axle[0], -axle[1], -axle[2]])])
  tube(s, mid, top, leg, { shade: hero })
  tube(s, axle, mid, leg * 0.62, { shade: hero })
  if (hero) {
    // torque link on the front of the leg
    const a = add(mid, [leg * 1.3, 0, -leg * 0.4]),
      b = add(axle, [leg * 1.3, 0, leg * 1.8])
    s.line([add(mid, [leg * 0.6, 0, 0]), a, b, add(axle, [leg * 0.5, 0, leg * 1.2])], 'line', 0.9)
    screw(s, a, X, 0.22)
  }
  if (twin) wheelAt(gap)
  else if (!first) wheelAt(0)
}

/** A four-wheel bogie under a leg: beam along x, two axles, wheels fore and aft. */
function bogie(
  s: Scene,
  top: P3,
  c: P3,
  o: { r: number; w: number; leg: number; pitch: number; hero: boolean },
) {
  const { r, w, leg, pitch, hero } = o
  const gap = w / 2 + leg * 1.5
  const fore = add(c, [pitch / 2, 0, 0]),
    aft = add(c, [-pitch / 2, 0, 0])
  for (const a of [aft, fore]) wheel(s, add(a, [0, -gap, 0]), Y, r, w, hero)
  for (const a of [aft, fore])
    tube(s, add(a, [0, -gap, 0]), add(a, [0, gap, 0]), leg * 0.5, { shade: hero })
  tube(s, add(aft, [-r * 0.2, 0, 0]), add(fore, [r * 0.2, 0, 0]), leg * 0.7, { shade: hero })
  const mid = comb(c, [0.5, add(top, [-c[0], -c[1], -c[2]])])
  tube(s, mid, top, leg, { shade: hero })
  tube(s, c, mid, leg * 0.62, { shade: hero })
  for (const a of [aft, fore]) wheel(s, add(a, [0, gap, 0]), Y, r, w, hero)
}

// ---------------------------------------------------------------- rung 1: paper plane on a model stand

function paper(s: Scene, hero: boolean) {
  apron(s, -26, 26, -24, 22, hero)
  // A classic dart in its own frame (nose +u), yawed on its stand so the near wing opens towards the viewer.
  const SX = -1,
    yaw = -42 * D2R
  const zk = 16.5,
    bank = 14 * D2R
  // Banked about the spine so the near wing turns its top to the viewer.
  const P = (u: number, v: number, z: number): P3 => {
    const h = z - zk,
      vb = v * Math.cos(bank) + h * Math.sin(bank),
      zb = zk - v * Math.sin(bank) + h * Math.cos(bank)
    return [SX + u * Math.cos(yaw) - vb * Math.sin(yaw), u * Math.sin(yaw) + vb * Math.cos(yaw), zb]
  }
  const tail = -19,
    dz = 2.6
  const N = P(20, 0, zk),
    T = P(tail, 0, zk)
  const tip = (sg: number) => P(tail, sg * 15.5, zk + dz)
  /** A point on a wing at fraction a from nose to tail along the spine and b out towards the tip. */
  const onWing = (sg: number, a: number, b: number): P3 => {
    const sp = mix(N, T, a),
      tp = mix(N, tip(sg), a)
    return mix(sp, tp, b)
  }
  const keelZ = (u: number) => zk - 5.6 + (u - tail) * 0.13
  s.poly(
    [N, tip(1), T, tip(-1)].map(([x, y]): P3 => [x - 2.6, y - 6, GROUND + 0.02]),
    'shadow',
    'none',
  )
  // Stand under the keel: weighted puck with a felt ring and a screw, a post, a clamp block, and a jaw over the keel.
  const kb = P(0, 0, keelZ(0))
  const [cx, cy] = kb
  lathe(
    s,
    frameAlong([cx, cy, GROUND], Z),
    (t) => ({ r: t > 1.5 ? 6.4 - (t - 1.5) * 1.6 : 6.4 }),
    0,
    2.3,
    { steps: hero ? 4 : 2, ring: hero ? 40 : 20, shade: hero },
  )
  if (hero) {
    s.poly(circleOn([cx, cy, GROUND + 2.3], Z, 4, 32), 'none', 'crease', undefined, 0.6)
    screw(s, [cx + 2.2, cy + 2.2, GROUND + 2.3], Z, 0.28, { ring: 0.65 })
  }
  tube(s, [cx, cy, GROUND + 2.3], [cx, cy, kb[2] - 1.4], 0.5, { shade: hero })
  slabRot(s, cx, cy, kb[2] - 1.6, 4.4, 2.6, 1.3, yaw)
  // Far wing, keel, near wing (lit). The far wing shows its top; the keel's near face hangs under the spine.
  const far = tip(-1)
  const edge = (a: P3) => add(a, [0, 0, -0.4])
  s.poly([N, far, T], 'top', 'line')
  s.poly([far, T, edge(T), edge(far)], 'side', 'line', undefined, 0.6)
  if (hero)
    s.segs(
      [
        [onWing(-1, 0.32, 1), onWing(-1, 0.52, 0)],
        [onWing(-1, 0.62, 1), onWing(-1, 0.86, 0)],
      ],
      'crease',
      0.6,
    )
  const kv = 0.3
  s.poly(
    [P(20, kv, zk), P(tail, kv, zk), P(tail, kv, keelZ(tail)), P(9, kv, keelZ(9) + 3.2)],
    'front',
    'line',
  )
  if (hero) s.line([P(tail, kv, keelZ(tail) + 1.3), P(7, kv, keelZ(7) + 3.6)], 'crease', 0.6)
  // The near jaw closes over the keel's foot.
  const jaw = P(0, kv + 0.4, keelZ(0) + 0.5)
  slabRot(s, jaw[0], jaw[1], kb[2] - 0.3, 2.6, 0.7, 1.6, yaw)
  if (hero)
    screw(
      s,
      add(P(0, kv + 0.76, keelZ(0) + 0.6), [0, 0, 0]),
      [-Math.sin(yaw), Math.cos(yaw), 0],
      0.2,
    )
  const near = tip(1)
  s.group('lit', () => {
    // An opaque sheet under a light accent wash, outlined in accent; the folds carry the accent too.
    s.glow(3, () => s.poly([N, near, T], 'none', 'accent', 1, 1.6))
    s.poly([N, near, T], 'top', 'none')
    s.poly([N, near, T], 'accent', 'none', undefined, undefined, 0.2)
    s.poly([near, T, edge(T), edge(near)], 'accent', 'none', undefined, undefined, 0.3)
    s.poly([near, T, edge(T), edge(near)], 'none', 'accent', 1, 0.6)
    s.poly([N, near, T], 'none', 'accent', 1, hero ? 1.1 : 1.4)
    if (hero)
      s.segs(
        [
          [onWing(1, 0.32, 1), onWing(1, 0.52, 0)],
          [onWing(1, 0.62, 1), onWing(1, 0.86, 0)],
        ],
        'accent',
        0.8,
      )
  })
}

// ---------------------------------------------------------------- rung 2: light single

const CESSNA = spline([
  [-30, 0.7, 1.2, 17.9],
  [-22, 1.8, 2.6, 17.1],
  [-12, 3.3, 4.3, 15.6],
  [-4, 4.5, 5.8, 14.4],
  [4, 4.7, 6.2, 14.2],
  [12, 4.6, 6.0, 14.0],
  [20, 4.3, 5.1, 13.4],
  [26, 3.9, 4.3, 13.0],
  [28.5, 3.5, 3.7, 12.8],
])
const cessnaSec = (x: number): Section => {
  const [r, rz, lift] = CESSNA(x)
  return { r, rz, lift }
}

function cessna(s: Scene, hero: boolean) {
  const sec = cessnaSec
  apron(s, -34, 36, -30, 32, hero)
  const wz = crownZ(sec, 6) - 0.2 + 0.9
  const wingSt = (y: number): FoilStation => {
    const a = Math.abs(y)
    const out = Math.max(0, (a - 17) / 19)
    return {
      le: [10 - 0.7 * out, y, wz + a * 0.026],
      te: [0.5 + 2.5 * out, y, wz + a * 0.026],
      t: 1.8 - 0.6 * out,
    }
  }
  planShadow(
    s,
    [
      [31, 0],
      [28, 3.6],
      [10, 4.6],
      [10, 36],
      [3, 36],
      [0.5, 17],
      [0.5, 4.6],
      [-22, 1.8],
      [-24, 11],
      [-29.5, 11],
      [-30, 0.6],
    ],
    12,
  )
  const strut = (sg: number) => {
    const a: P3 = [6, sg * (skinY(sec, 6, 10) - 0.1), 10],
      b: P3 = [5.2, sg * 17, wz - 0.8]
    tube(s, a, b, 0.55, { shade: hero })
    if (hero) screw(s, add(a, [0, sg * 0.1, 0]), [0, sg, 0], 0.25, { ring: 0.7 })
  }
  const mainGear = (sg: number) => {
    const axle: P3 = [-1, sg * 10.4, GROUND + 3]
    if (sg < 0) wheel(s, add(axle, [0, -0.9, 0]), Y, 3, 1.8, hero)
    tube(s, [-1, sg * 2.6, bellyZ(sec, -1) + 0.6], axle, 0.5, { shade: hero })
    if (sg > 0) wheel(s, add(axle, [0, 0.9, 0]), Y, 3, 1.8, hero)
    // wheel pant: a teardrop fairing round the top of the tyre
    const pant = spline([
      [-6, 0.3],
      [-3, 1.6],
      [0.5, 1.75],
      [3, 1.5],
      [4.6, 0.4],
    ])
    lathe(
      s,
      frameAlong([0, sg * 11.3, 0], X),
      (t) => {
        const r = Math.max(0.05, pant(t)[0])
        return { r, rz: r * 1.55, lift: 7.4 }
      },
      -6,
      4.6,
      { steps: hero ? 10 : 4, ring: hero ? 24 : 14, shade: hero },
    )
  }
  const stab = (sg: number) => {
    const z = 17.1
    const rootY = sg > 0 ? skinY(sec, -26, z) : 0
    foil(
      s,
      [
        { le: [-21.5, sg * rootY, z], te: [-30, sg * rootY, z], t: 1.1 },
        { le: [-24.5, sg * 11, z], te: [-29.6, sg * 11, z], t: 0.6 },
      ],
      { nose: hero ? 3 : 1 },
    )
  }

  // far side
  stab(-1)
  strut(-1)
  mainGear(-1)
  // nose gear (under the cowl)
  wheel(s, [25.6, 0, GROUND + 2.4], Y, 2.4, 1.5, hero)
  tube(s, [24.4, 0, bellyZ(sec, 24.4) + 0.5], [25.6, 0, GROUND + 2.4], 0.5, { shade: hero })
  // fuselage
  const b = lathe(s, AXIS, sec, -30, 28.5, {
    steps: hero ? 30 : 12,
    ring: hero ? 36 : 18,
    shade: hero,
  })
  if (hero) {
    for (const x of [-20, -9, 17.5, 26.8]) b.seam(x)
    b.along(-8, 13, 26)
  }
  // windshield, side windows, door, cowl inlets
  b.patch(
    [
      [17, 30],
      [10.6, 44],
      [10.6, 126],
      [17, 126],
    ],
    'glass',
    'line',
  )
  b.patch(
    [
      [3.6, 14],
      [9.8, 14],
      [9.8, 52],
      [3.6, 52],
    ],
    'glass',
    'crease',
  )
  b.patch(
    [
      [-4, 16],
      [2.4, 16],
      [2.4, 50],
      [-3.4, 50],
    ],
    'glass',
    'crease',
  )
  if (hero) {
    b.patch(
      [
        [-9.5, 20],
        [-5.6, 18],
        [-5.6, 46],
        [-8.6, 44],
      ],
      'glass',
      'crease',
    )
    door(b, 3, 10.4, -38, 58)
    screw(s, b.at(4.2, -6, 0.05), b.normal(4.2, -6), 0.28)
    for (const sg of [-1, 1]) {
      const c: P3 = [28.55, sg * 1.9, 13.9]
      s.poly(circleOn(c, X, 0.9, 12), 'shade', 'none')
    }
  }
  // nose pant over the nose wheel
  const np = spline([
    [-3.2, 0.3],
    [-1, 1.25],
    [1.5, 1.2],
    [3.2, 0.3],
  ])
  lathe(
    s,
    frameAlong([25.6, 0, 0], X),
    (t) => {
      const r = Math.max(0.05, np(t)[0])
      return { r, rz: r * 1.5, lift: 6.4 }
    },
    -3.2,
    3.2,
    { steps: hero ? 8 : 3, ring: hero ? 20 : 12, shade: hero },
  )
  // fin with a dorsal fillet
  const ft = 1.2
  const fin = foil(
    s,
    [
      {
        le: [-12, 0, crownZ(sec, -12, ft / 2) - 0.1],
        te: [-29.6, 0, crownZ(sec, -29.6, ft / 2) - 0.1],
        t: ft,
      },
      { le: [-19.5, 0, 23.6], te: [-30.2, 0, 23.6], t: ft * 0.9 },
      { le: [-25.6, 0, 33], te: [-30.8, 0, 33.2], t: ft * 0.6 },
    ],
    { up: Y, nose: hero ? 3 : 1 },
  )
  if (hero) {
    fin.line(0, 0.78, 2, 0.72)
    screw(s, add(fin.top(2, 0.5), [0, 0, 0.4]), Z, 0.3)
  }
  stab(1)
  mainGear(1)
  strut(1)
  // wing: one piece across the cabin roof
  const w = foil(s, [wingSt(-36), wingSt(-17), wingSt(0), wingSt(17), wingSt(36)], {
    nose: hero ? 4 : 2,
  })
  if (hero) {
    w.line(0, 0.74, 1, 0.74)
    w.line(3, 0.74, 4, 0.74)
    w.line(1, 0.74, 1, 1)
    w.line(3, 0.74, 3, 1)
    w.line(1.4, 0.74, 2.6, 0.74)
    w.line(1.4, 0.74, 1.4, 1)
    w.line(2.6, 0.74, 2.6, 1)
    for (const i of [1.5, 2.5]) screw(s, add(w.top(i, 0.32), [0, 0, 0.05]), Z, 0.35, { ring: 0.8 })
  }
  // nose: cowl face, prop (lit), spinner
  s.group('lit', () => propeller(s, [29.6, 0, 12.8], 8.6, 2, hero, 2.4))
  spinner(s, 28.5, 0, 12.8, 2.1, 3.6, hero)
}

// ---------------------------------------------------------------- rung 3: turboprop

function turboprop(s: Scene, hero: boolean) {
  const H: HullSpec = {
    tail: -42,
    tailStart: -12,
    noseStart: 30,
    nose: 42,
    R: 5.6,
    aspect: 1.07,
    Zc: 11,
    tailR: 0.8,
    droop: 0.55,
    upsweep: 0.9,
    bluntness: 2.3,
  }
  const sec = hullSection(H)
  apron(s, -46, 48, -30, 34, hero)
  const crown = crownZ(sec, 0)
  const wz = crown + 1.0
  const wingSt = (y: number): FoilStation => {
    const a = Math.abs(y)
    const out = Math.max(0, (a - 16) / 30)
    return {
      le: [6.5 - 1.6 * out, y, wz + a * 0.02],
      te: [-6 + 4.2 * out, y, wz + a * 0.02],
      t: 2.2 - 1.1 * out,
    }
  }
  const YN = 16
  const nacZ = wz - 1.1 - 3.2 + 0.6
  planShadow(
    s,
    [
      [42, 0],
      [34, 5],
      [6.5, 5.6],
      [6.5, 46],
      [-1.8, 46],
      [-6, 16],
      [-6, 5.6],
      [-12, 5.6],
      [-38, 1.5],
      [-40, 14],
      [-44, 14],
      [-42, 0.8],
    ],
    14,
  )
  const nacelle = (sg: number) => {
    const y = sg * YN
    const prof = spline([
      [-15, 0.6],
      [-9, 2.2],
      [0, 3.2],
      [12, 3.2],
      [19, 2.9],
      [22.5, 2.3],
    ])
    const b = lathe(
      s,
      frameAlong([0, y, 0], X),
      (t) => {
        const r = prof(t)[0]
        return { r, rz: r * 1.15, lift: nacZ }
      },
      -15,
      22.5,
      { steps: hero ? 16 : 6, ring: hero ? 28 : 16, shade: hero },
    )
    if (hero) {
      for (const x of [3, 16]) b.seam(x)
      // the intake scoop under the spinner
      s.poly(circleOn([22.55, y, nacZ - 1.4], X, 0.7, 12), 'shade', 'none')
    }
  }
  const sponson = (sg: number) => {
    const prof = spline([
      [-11, 0.4],
      [-6, 2.2],
      [5, 2.3],
      [9, 0.4],
    ])
    lathe(
      s,
      frameAlong([0, sg * (H.R - 1.2), 0], X),
      (t) => {
        const r = Math.max(0.05, prof(t)[0])
        return { r, rz: r * 0.95, lift: bellyZ(sec, 0) + 2.2 }
      },
      -11,
      9,
      { steps: hero ? 10 : 4, ring: hero ? 24 : 14, shade: hero },
    )
  }
  const mainGear = (sg: number) =>
    gearLeg(s, [-2, sg * 5.6, bellyZ(sec, 0) + 2.6], [-2, sg * 7.9, GROUND + 2.9], {
      r: 2.9,
      w: 2.2,
      twin: false,
      leg: 0.7,
      hero,
    })

  // far side
  mainGear(-1)
  sponson(-1)
  nacelle(-1)
  // nose gear
  gearLeg(s, [33, 0, bellyZ(sec, 33) + 0.6], [33.4, 0, GROUND + 2.2], {
    r: 2.2,
    w: 1.4,
    twin: true,
    leg: 0.5,
    hero,
  })
  // fuselage
  const b = lathe(s, AXIS, sec, -42, 42, {
    steps: hero ? 34 : 12,
    ring: hero ? 36 : 18,
    shade: hero,
  })
  if (hero) {
    for (const x of [-26, -12, 10, 26, 39.4]) b.seam(x)
    windows(
      b,
      sec,
      Array.from({ length: 11 }, (_, i) => -16 + i * 3.4),
      24,
      1.5,
      1.9,
    )
    door(b, 26.6, 30, -34, 36)
    door(b, -27.5, -24, -30, 34)
  } else b.along(24, -16, 18, 'line', 1)
  b.patch(
    [
      [37.6, 34],
      [40, 52],
      [40, 98],
      [37.6, 98],
    ],
    'glass',
    'line',
  )
  b.patch(
    [
      [34.4, 22],
      [37.2, 26],
      [37.2, 50],
      [34.4, 52],
    ],
    'glass',
    'crease',
  )
  // wing-root fairing on the crown
  const fprof = spline([
    [-12, 0.5],
    [-9.5, 2.6],
    [-5, 3.4],
    [6, 3.5],
    [9, 2.4],
    [10.5, 0.5],
  ])
  lathe(
    s,
    frameAlong([0, 0, 0], X),
    (t) => {
      const r = Math.max(0.05, fprof(t)[0])
      return { r, rz: r * 0.5, lift: crown - 0.6 }
    },
    -12,
    10,
    { steps: hero ? 10 : 4, ring: hero ? 24 : 14, shade: hero },
  )
  // T-tail: fin, then the tailplane across its tip
  const ft = 1.3
  const finTop = crown + 21
  const fin = foil(
    s,
    [
      {
        le: [-17, 0, crownZ(sec, -17, ft / 2) - 0.1],
        te: [-40.6, 0, crownZ(sec, -40.6, ft / 2) - 0.1],
        t: ft,
      },
      { le: [-25, 0, crown + 5], te: [-40.8, 0, crown + 5], t: ft },
      { le: [-33, 0, finTop], te: [-42.2, 0, finTop], t: ft * 0.8 },
    ],
    { up: Y, nose: hero ? 3 : 1 },
  )
  if (hero) fin.line(0, 0.74, 2, 0.7)
  const stz = finTop + 0.1
  const tp = foil(
    s,
    [
      { le: [-35.5, -14, stz + 0.5], te: [-41.5, -14, stz + 0.5], t: 0.6 },
      { le: [-32.6, 0, stz], te: [-42.6, 0, stz], t: 1.2 },
      { le: [-35.5, 14, stz + 0.5], te: [-41.5, 14, stz + 0.5], t: 0.6 },
    ],
    { nose: hero ? 3 : 1 },
  )
  if (hero) tp.line(0, 0.72, 2, 0.72)
  // near side
  sponson(1)
  mainGear(1)
  nacelle(1)
  const w = foil(s, [wingSt(-46), wingSt(-YN), wingSt(0), wingSt(YN), wingSt(46)], {
    nose: hero ? 4 : 2,
  })
  if (hero) {
    w.line(0.3, 0.72, 3.7, 0.72)
    for (const i of [0.3, 1, 3, 3.7]) w.line(i, 0.72, i, 1)
    for (const i of [1.4, 2.6]) screw(s, add(w.top(i, 0.3), [0, 0, 0.05]), Z, 0.35, { ring: 0.8 })
  }
  s.group('lit', () => {
    for (const sg of [-1, 1]) propeller(s, [23.2, sg * YN, nacZ], 7.4, 6, hero, 1.5)
  })
  for (const sg of [-1, 1]) spinner(s, 22.5, sg * YN, nacZ, 2.2, 3.8, hero)
}

// ---------------------------------------------------------------- rungs 4 and 5: jets

type JetSpec = {
  hull: Omit<HullSpec, 'Zc'>
  /** Wing planform, +y half: rows [y, LE x, TE x, thickness], the first at the centreline. */
  wing: readonly (readonly [number, number, number, number])[]
  dihedral: number
  winglet: boolean
  /** Engine: span station, lip x, length, radius, ground clearance. */
  eng: { y: number; x: number; len: number; r: number; clear: number; fan: number }
  stab: { le: number; chord: number; span: number; sweep: number; tip: number; t: number }
  fin: { le: number; chord: number; h: number; sweep: number; tip: number; t: number }
  gear: { x: number; y: number; nose: number; r: number; w: number; leg: number; bogie: boolean }
  windows: { x0: number; x1: number; pitch: number; w: number; h: number }
  doors: readonly number[]
  apron: readonly [number, number, number, number]
}

function jet(s: Scene, J: JetSpec, hero: boolean, initials = '') {
  const E = J.eng
  const tanD = Math.tan(J.dihedral * D2R)
  const row = (y: number) => {
    const w = J.wing
    let i = 0
    while (i < w.length - 2 && y > w[i + 1][0]) i++
    const [y0, l0, t0, h0] = w[i],
      [y1, l1, t1, h1] = w[i + 1]
    const u = (y - y0) / (y1 - y0)
    return { le: l0 + (l1 - l0) * u, te: t0 + (t1 - t0) * u, t: h0 + (h1 - h0) * u }
  }
  // Heights follow from the engine: it hangs `clear` above the apron, its pylon reaches the wing, the wing sits low on the barrel.
  const nacZ = GROUND + E.clear + E.r
  const wingBottomAtEng = nacZ + E.r + E.r * 0.42
  const W0 = wingBottomAtEng + row(E.y).t - tanD * E.y
  const Zc = W0 + 0.42 * J.hull.R * J.hull.aspect
  const H: HullSpec = { ...J.hull, Zc }
  const sec = hullSection(H)
  const zTop = (y: number) => W0 + tanD * Math.abs(y)
  const zBot = (y: number) => zTop(y) - row(Math.abs(y)).t
  const ySkin = skinY(sec, 0, W0)
  const span = J.wing[J.wing.length - 1][0]
  const station = (y: number): FoilStation => {
    const r = row(Math.abs(y))
    const z = zTop(y) - r.t / 2
    return { le: [r.le, y, z], te: [r.te, y, z], t: r.t }
  }
  const [ax0, ax1, ay0, ay1] = J.apron
  apron(s, ax0, ax1, ay0, ay1, hero)
  const tipRow = row(span)
  const st = J.stab
  planShadow(
    s,
    [
      [H.nose, 0],
      [H.noseStart, H.R],
      [row(ySkin).le, H.R],
      [tipRow.le, span],
      [tipRow.te, span],
      ...J.wing
        .slice(1, -1)
        .reverse()
        .map(([y, , te]) => [te, y] as [number, number]),
      [row(ySkin).te, H.R],
      [H.tailStart, H.R],
      [st.le, H.R * 0.6],
      [st.le - Math.tan(st.sweep * D2R) * st.span, st.span],
      [st.le - Math.tan(st.sweep * D2R) * st.span - st.tip, st.span],
      [st.le - st.chord, H.R * 0.4],
      [H.tail, H.tailR],
    ],
    Zc - GROUND,
  )

  // --- parts, each for one side
  const wingStations = (sg: number) => {
    const ys = [sg > 0 ? ySkin : -ySkin * 0.6, ...J.wing.slice(1).map(([y]) => y)]
    return ys.map((y) => station(sg * Math.abs(y)))
  }
  const winglet = (sg: number) => {
    const t = tipRow
    const zt = zTop(span)
    foil(
      s,
      [
        { le: [t.le - 0.3, sg * span, zt - 0.3], te: [t.te + 0.2, sg * span, zt - 0.3], t: 0.7 },
        {
          le: [t.le - 3.4, sg * (span + 0.8), zt + 3],
          te: [t.te - 0.6, sg * (span + 0.8), zt + 3],
          t: 0.6,
        },
        {
          le: [t.le - 7, sg * (span + 1.4), zt + 8.6],
          te: [t.le - 9.6, sg * (span + 1.4), zt + 8.6],
          t: 0.4,
        },
      ],
      { up: Y, nose: hero ? 2 : 1 },
    )
  }
  const wingPanel = (sg: number) => {
    const sts = wingStations(sg)
    const w = foil(s, sg > 0 ? sts : [...sts].reverse(), { nose: hero ? 4 : 2 })
    if (!hero) return
    const n = sts.length - 1
    const i = (k: number) => (sg > 0 ? k : n - k)
    // flap and aileron hinges, cut lines to the trailing edge, spoiler row
    w.line(i(0), 0.76, i(n * 0.62), 0.76)
    w.line(i(n * 0.64), 0.78, i(n * 0.94), 0.78)
    for (const k of [0.3, 0.62, 0.64, 0.94])
      w.line(i(n * k), k === 0.62 || k === 0.3 ? 0.76 : 0.78, i(n * k), 1)
    w.line(i(0.15), 0.6, i(n * 0.5), 0.6)
    w.line(i(0.15), 0.6, i(0.15), 0.76)
    w.line(i(n * 0.5), 0.6, i(n * 0.5), 0.76)
    w.line(i(0), 0.14, i(n), 0.14)
    screw(s, add(w.top(i(n * 0.97), 0.45), [0, 0, 0.05]), Z, 0.32)
  }
  /** Flap-track fairings: pods under the trailing edge, poking out behind it. */
  const fairings = (sg: number) => {
    if (!hero) return
    for (const f of [0.28, 0.5, 0.72]) {
      const y = sg * (ySkin + (span - ySkin) * f * 0.85)
      const r = row(Math.abs(y))
      const L = (r.le - r.te) * 0.62
      const prof = spline([
        [0, 0.2],
        [L * 0.25, 0.75],
        [L * 0.7, 0.7],
        [L, 0.15],
      ])
      lathe(
        s,
        frameAlong([r.te - L * 0.4, y, 0], X),
        (t) => {
          const q = Math.max(0.05, prof(t)[0]) * (J.eng.r / 4.2)
          return { r: q * 0.7, rz: q * 1.2, lift: zBot(y) - q * 0.4 }
        },
        0,
        L,
        { steps: 6, ring: 16, shade: hero },
      )
    }
  }
  const engine = (sg: number) => {
    const y = sg * E.y,
      xr = E.x - E.len
    const r = E.r
    const plug = spline([
      [0, 0.5 * r],
      [0.4 * r, 0.42 * r],
      [1.1 * r, 0.06 * r],
    ])
    lathe(
      s,
      frameAlong([xr - 0.25 * E.len - 1.1 * r, y, nacZ], X),
      (t) => ({ r: plug(1.1 * r - t)[0] }),
      0,
      1.1 * r,
      {
        steps: hero ? 6 : 2,
        ring: hero ? 20 : 12,
        shade: hero,
        caps: false,
      },
    )
    lathe(
      s,
      frameAlong([xr - 0.25 * E.len, y, nacZ], X),
      (t) => ({ r: r * (0.5 + 0.14 * (t / (0.25 * E.len))) }),
      0,
      0.25 * E.len + 1,
      { steps: hero ? 4 : 1, ring: hero ? 24 : 14, shade: hero, caps: false },
    )
    const prof = spline([
      [0, 0.74],
      [0.12, 0.86],
      [0.45, 0.99],
      [0.75, 1],
      [1, 0.96],
    ])
    const nb = lathe(
      s,
      frameAlong([xr, y, 0], X),
      (t) => ({ r: r * prof(t / E.len)[0], lift: nacZ }),
      0,
      E.len,
      { steps: hero ? 14 : 5, ring: hero ? 32 : 16, shade: hero, caps: false },
    )
    if (hero) {
      nb.seam(E.len * 0.42)
      nb.seam(E.len * 0.8)
      nb.along(-30, E.len * 0.42, E.len * 0.8)
    }
    // pylon: from the nacelle's crown up into the wing, its leading edge slanting back to the wing's
    const rw = row(E.y)
    foil(
      s,
      [
        {
          le: [E.x - E.len * 0.28, y, nacZ + r * 0.96],
          te: [xr + E.len * 0.04, y, nacZ + r * 0.9],
          t: r * 0.28,
        },
        {
          le: [rw.le + 1, y, zBot(E.y) + 0.8],
          te: [rw.te + r * 0.7, y, zBot(E.y) + 0.8],
          t: r * 0.24,
        },
      ],
      { up: Y, nose: hero ? 2 : 1 },
    )
  }
  /** Inlet lip, fan face and spinner: the lit part. */
  const intake = (sg: number) => {
    const y = sg * E.y,
      r = E.r
    const lip = 0.32 * r
    s.glow(3, () => s.poly(circleOn([E.x + lip, y, nacZ], X, r * 0.97, 24), 'accent', 'none'))
    lathe(
      s,
      frameAlong([E.x, y, nacZ], X),
      (t) => ({
        r:
          r * (0.96 + 0.012 * Math.sqrt(Math.max(0, 1 - (t / lip) ** 2))) -
          (t / lip) ** 3 * 0.05 * r,
      }),
      0,
      lip,
      {
        steps: hero ? 3 : 1,
        ring: hero ? 32 : 16,
        shade: hero,
        ramp: ACCENT,
        crease: 'accent-side',
      },
    )
    const face = E.x + lip + 0.02
    if (!hero) s.poly(circleOn([face, y, nacZ], X, r * 1.02, 16), 'none', 'accent', undefined, 1.4)
    s.poly(
      circleOn([face, y, nacZ], X, r * 0.8, hero ? 28 : 16),
      'shade',
      'accent-side',
      undefined,
      0.6,
    )
    if (hero) {
      const at = s.on([face, y, nacZ], Y, [0, 0, -1])
      const segs: P3[][] = []
      for (let i = 0; i < E.fan; i++) {
        const a = (i / E.fan) * 2 * Math.PI
        segs.push([
          at(0.3 * r * Math.cos(a), 0.3 * r * Math.sin(a)),
          at(0.78 * r * Math.cos(a + 0.32), 0.78 * r * Math.sin(a + 0.32)),
        ])
      }
      s.segs(segs, 'detail', 0.7)
    }
    spinner(s, face - 0.6, y, nacZ, 0.3 * r, 0.6 * r, hero)
  }
  const mainGear = (sg: number) => {
    const G = J.gear
    const y = sg * G.y
    const top: P3 = [G.x, y, zBot(G.y) + 0.4]
    if (G.bogie)
      bogie(s, top, [G.x, y, GROUND + G.r], { r: G.r, w: G.w, leg: G.leg, pitch: G.r * 2.3, hero })
    else gearLeg(s, top, [G.x, y, GROUND + G.r], { r: G.r, w: G.w, twin: true, leg: G.leg, hero })
    if (hero) {
      chock(s, G.x + G.r * (G.bogie ? 2.3 : 1.05), y + (G.w / 2 + G.leg * 1.6), G.w, G.r)
    }
  }
  const stab = (sg: number) => {
    const z = sec(st.le - st.chord * 0.5).lift ?? Zc
    const rootIn = sg > 0
    const yl = rootIn ? skinY(sec, st.le, z) : 0,
      yt = rootIn ? skinY(sec, st.le - st.chord, z) : 0
    const tl = st.le - Math.tan(st.sweep * D2R) * st.span
    const sts: FoilStation[] = [
      { le: [st.le, sg * yl, z], te: [st.le - st.chord, sg * yt, z], t: st.t },
      {
        le: [tl, sg * st.span, z + st.span * 0.06],
        te: [tl - st.tip, sg * st.span, z + st.span * 0.06],
        t: st.t * 0.45,
      },
    ]
    const f = foil(s, sg > 0 ? sts : [...sts].reverse(), { nose: hero ? 3 : 1 })
    if (hero) f.line(0, 0.7, 1, 0.7)
  }

  // --- far side
  stab(-1)
  engine(-1)
  fairings(-1)
  mainGear(-1)
  wingPanel(-1)
  if (J.winglet) winglet(-1)
  // nose gear under the barrel
  const G = J.gear
  gearLeg(s, [G.nose, 0, bellyZ(sec, G.nose) + 0.6], [G.nose + 0.6, 0, GROUND + G.r * 0.8], {
    r: G.r * 0.8,
    w: G.w * 0.85,
    twin: true,
    leg: G.leg * 0.8,
    hero,
  })
  // --- near gear, near engine and both intakes: the far intake sits behind the nose, so the lit group goes before the
  // fuselage, and the near engine and gear (clear of the fuselage on screen) go with it.
  mainGear(1)
  engine(1)
  s.group('lit', () => {
    intake(-1)
    intake(1)
  })
  // --- fuselage
  const b = lathe(s, AXIS, sec, H.tail, H.nose, {
    steps: hero ? 40 : 14,
    ring: hero ? 40 : 18,
    shade: hero,
  })
  const R = H.R
  const winDeg = 20
  if (hero) {
    const L = H.nose - H.tail
    for (const f of [0.14, 0.27, 0.42, 0.58, 0.72, 0.86]) b.seam(H.tail + L * f)
    b.seam(H.nose - (H.nose - H.noseStart) * 0.18)
    const ws = J.windows
    const xs: number[] = []
    for (let x = ws.x0; x <= ws.x1; x += ws.pitch)
      if (!J.doors.some((d) => Math.abs(x - d) < ws.pitch * 1.1)) xs.push(x)
    windows(b, sec, xs, winDeg, ws.w, ws.h)
    for (const d of J.doors) door(b, d - R * 0.17, d + R * 0.17, -40, 52)
    // cargo door low on the flank
    door(b, J.wing[0][1] + R * 1.4, J.wing[0][1] + R * 2.1, -48, -18)
    // anti-collision beacon on the crown and a blade antenna behind it
    disc(s, [-R * 0.4, 0, crownZ(sec, -R * 0.4) + 0.2], Z, R * 0.09, 0.5, { shade: true })
    foil(
      s,
      [
        {
          le: [R * 0.9, 0, crownZ(sec, R * 0.9, 0.2) - 0.1],
          te: [R * 0.3, 0, crownZ(sec, R * 0.3, 0.2) - 0.1],
          t: 0.4,
        },
        {
          le: [R * 0.45, 0, crownZ(sec, R * 0.6) + R * 0.22],
          te: [R * 0.25, 0, crownZ(sec, R * 0.4) + R * 0.22],
          t: 0.3,
        },
      ],
      { up: Y, nose: 1 },
    )
  } else b.along(winDeg, J.windows.x0, J.windows.x1, 'line', 1)
  // cockpit glazing: windscreen and side panes
  const ns = H.noseStart,
    nl = H.nose - H.noseStart
  b.patch(
    [
      [ns + nl * 0.36, 34],
      [ns + nl * 0.56, 40],
      [ns + nl * 0.56, 72],
      [ns + nl * 0.36, 76],
    ],
    'glass',
    'line',
  )
  b.patch(
    [
      [ns + nl * 0.12, 30],
      [ns + nl * 0.33, 32],
      [ns + nl * 0.33, 74],
      [ns + nl * 0.12, 70],
    ],
    'glass',
    'crease',
  )
  // fin, with the initials on it
  const F = J.fin
  const ft = F.t
  const finRoot = (x: number) => crownZ(sec, x, ft / 2) - 0.1
  const tipLE = F.le - Math.tan(F.sweep * D2R) * F.h
  const top = crownZ(sec, F.le) + F.h
  const fin = foil(
    s,
    [
      { le: [F.le, 0, finRoot(F.le)], te: [F.le - F.chord, 0, finRoot(F.le - F.chord)], t: ft },
      { le: [tipLE, 0, top], te: [tipLE - F.tip, 0, top], t: ft * 0.5 },
    ],
    { up: Y, nose: hero ? 3 : 1 },
  )
  if (hero) {
    fin.line(0, 0.7, 1, 0.68)
    fin.line(0.55, 0.7, 0.55, 1)
  }
  if (initials && hero) {
    // Centred on the fin's fixed part at 45% height, sized to fit its chord there.
    const hz = 0.45
    const le = F.le + (tipLE - F.le) * hz,
      ch = F.chord + (F.tip - F.chord) * hz
    const zc = finRoot(F.le) + (top - finRoot(F.le)) * hz
    const size = Math.min(ch * 0.5, F.h * 0.34) / Math.max(1, initials.length * 0.62)
    s.text(initials, [le - ch * 0.36, ft / 2 + 0.05, zc - size * 0.36], X, [0, 0, -1], {
      size,
      fill: 'ink',
      weight: 800,
      anchor: 'middle',
    })
  }
  // --- near side
  stab(1)
  fairings(1)
  wingPanel(1)
  if (J.winglet) winglet(1)
}

const NARROW: JetSpec = {
  hull: {
    tail: -55,
    tailStart: -20,
    noseStart: 37,
    nose: 55,
    R: 6.6,
    aspect: 1.06,
    tailR: 0.7,
    droop: 0.55,
    upsweep: 0.85,
  },
  wing: [
    [0, 12, -12, 2.6],
    [17, 4.2, -12.6, 2],
    [50, -15.2, -20.4, 0.8],
  ],
  dihedral: 5,
  winglet: true,
  eng: { y: 17, x: 17.5, len: 17, r: 4.1, clear: 1.6, fan: 14 },
  stab: { le: -38, chord: 12, span: 19, sweep: 32, tip: 4.4, t: 1.1 },
  fin: { le: -29, chord: 21, h: 24, sweep: 36, tip: 8, t: 1.4 },
  gear: { x: -10, y: 11.5, nose: 40, r: 2.8, w: 1.8, leg: 0.75, bogie: false },
  windows: { x0: -34, x1: 31, pitch: 3.3, w: 1.5, h: 2 },
  doors: [-46, 34],
  apron: [-60, 60, -34, 46],
}

const WIDE: JetSpec = {
  hull: {
    tail: -82,
    tailStart: -32,
    noseStart: 56,
    nose: 82,
    R: 9.8,
    aspect: 1.05,
    tailR: 1,
    droop: 0.55,
    upsweep: 0.85,
  },
  wing: [
    [0, 26, -10, 3.4],
    [27, 10, -14.5, 2.6],
    [66, -24.5, -33, 1.3],
    [78, -37, -39.5, 0.8],
  ],
  dihedral: 6,
  winglet: false,
  eng: { y: 27, x: 32, len: 27, r: 6.4, clear: 2, fan: 18 },
  stab: { le: -58, chord: 18, span: 28, sweep: 34, tip: 6.5, t: 1.5 },
  fin: { le: -44, chord: 32, h: 38, sweep: 38, tip: 11, t: 1.9 },
  gear: { x: -9, y: 17, nose: 62, r: 3.3, w: 2.2, leg: 1, bogie: true },
  windows: { x0: -52, x1: 50, pitch: 3.9, w: 1.7, h: 2.6 },
  doors: [-62, -24, 14, 52],
  apron: [-86, 88, -50, 66],
}

export const flights: LadderFigureDef = {
  id: 'flights',
  rungs: 5,
  build(k, { rung, lod, initials }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    if (rung === 1) paper(s, hero)
    else if (rung === 2) cessna(s, hero)
    else if (rung === 3) turboprop(s, hero)
    else if (rung === 4) jet(s, NARROW, hero)
    else jet(s, WIDE, hero, (initials ?? '').trim().toUpperCase())
    return s.done()
  },
}
