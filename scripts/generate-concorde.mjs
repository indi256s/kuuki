// Generates the sign-in brand panel's Concorde: a 1:200 display model turning on its stand, drawn with the anatomy
// skill's iso kit in its 3D ("turning groups") mode.
//
//   pnpm generate:concorde              writes the files below
//   pnpm generate:concorde --preview    also writes .scratch/concorde/concorde.html (a standalone page for captures)
//   pnpm generate:concorde --audit      runs the kit audit and the orbit audit (slow; add --quick to iterate)
//
// Outputs, all in apps/next/src/client/auth-card/concorde/:
//   concorde.generated.ts    the static and live SVG markup and the turn data the runtime replays
//   concorde.generated.css   the kit's figure CSS, scoped under .auth-concorde (colours come from concorde.css)
//   turn.generated.js        the kit's turn runtime (MIT; the licence is in its header), with turn.generated.d.ts
//   gl.generated.js          the kit's WebGL layer for the reheat flame (reheat.ts), with gl.generated.d.ts
//
// Setup and pinned anatomy kit provenance: scripts/concorde/README.md. World units are model millimetres. The airframe
// comes from Concorde's published dimensions: 61.66 m long, 25.6 m span, 2.87 m fuselage, 358.25 m² ogee wing, two
// twin Olympus 593 nacelles.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { verifiedAnatomyKit } from './concorde/verify-kit.mjs'

const KIT = verifiedAnatomyKit()
const k = await import(pathToFileURL(join(KIT, 'iso-kit.mjs')))
const G = await import(pathToFileURL(join(KIT, 'lathe.mjs')))
const A = await import(pathToFileURL(join(KIT, 'audit.mjs')))
const GL = await import(pathToFileURL(join(KIT, 'gl.mjs')))
const { turning } = await import(pathToFileURL(join(KIT, 'turn-build.mjs')))
const argv = process.argv.slice(2)
const OUT = 'apps/next/src/client/auth-card/concorde'

const WIDTH = 420
const HEIGHT = 400
const AZIMUTH = 38
const ELEVATION = 30
/** The model's heading at turn 0, so the server-drawn first frame is a three-quarter view from ahead. */
const REST = 250

// ---------- Truth: Concorde, metres (x aft from the nose, y out from the centreline) ----------
const M = 5 // 1:200, in mm per metre
const LENGTH = 61.66
const SPAN = 25.6
const PIVOT = 33 // the stand sits under the centre of gravity, about 53% of the length
const R0 = (2.87 / 2) * M // fuselage radius
const NOSE_END = 9 // the cockpit shoulder reaches the cabin diameter
const BODY_END = 57 // the straight barrel ends under the rudder
const TAIL_R = 0.42 * M
// Ogee leading edge and a near-straight trailing edge, half span; the strips below give 354 m² against 358.25 m².
const LE = [
  [1.3, 22.2],
  [3.0, 31.6],
  [5.6, 38.6],
  [8.8, 44.6],
  [11.6, 48.9],
  [SPAN / 2, 51.0],
]
const TE = (y) => 52.6 - 0.08 * y
const NACELLE = { y0: 3.05, y1: 5.95, x0: 38.6, x1: 52.2, h: 1.9 }
const NOZZLE = { r0: 0.6, r1: 0.54, len: 1.3, dy: 0.72 }
const ELEVON = [
  [1.45, 3.0],
  [6.0, 9.2],
  [9.2, 12.5],
] // inner, middle and outer elevons; hinge line 1.7 m ahead of the trailing edge
const FIN = { root: [45.5, 57.0], tip: [55.0, 58.6], h: 6.0, hinge: [54.2, 57.4], split: 3.0 }
// Reheat: the Olympus 593's afterburner, lit for takeoff and the transonic push. Its visible flame runs about 9 m; the
// figure draws it wider and brighter than that so it reads at the panel's 420 px, and 10.5 m long, the most the frame
// holds side-on (the fit is set by the nose's sweep). `proxy` is the half-height of the clear prism that stands in for
// each nacelle's pair of flames in the painter's order.
const REHEAT = { len: 10.5, proxy: 0.68, proxyLen: 12 }
const WINDOWS = { from: 13.4, to: 41.6, count: 26 }
const ANTENNAS = [17.5, 31.0] // dorsal VHF blades

// ---------- Stand, model millimetres ----------
const PLINTH = { x: -62, y: -62, w: 124, d: 124, r: 12 }
const PLINTH_H = 15
const FOOT_H = 3
const PLATTER_R = 47
const PLATTER_H = 3.2
const STEM_R = 1.5
const BELLY = 66 // fuselage bottom above the plinth top
const CRADLE_H = 3
const ZC = BELLY + R0 // fuselage axis
const WING_TOP = ZC - 3.0
const WING_BOT = WING_TOP - 1.6
// The root face stands 0.12 mm off the barrel (inside the audit's 0.15 mm touch), so the pair has a clean separating plane at every angle.
const ROOT_Y = Math.sqrt(R0 * R0 - (ZC - WING_TOP) ** 2) + 0.12

const sweep = []
for (let i = 0; i < 48; i++) {
  const a = (i / 48) * Math.PI * 2
  for (const z of [WING_BOT - NACELLE.h * M, ZC + R0 + FIN.h * M])
    sweep.push([PIVOT * M * Math.cos(a), PIVOT * M * Math.sin(a), z])
}
const P = k.fitProjection(
  [...k.boxCorners(PLINTH, -PLINTH_H - FOOT_H, 0), ...sweep],
  WIDTH,
  HEIGHT,
  {
    pad: 12,
    azimuth: AZIMUTH,
    elevation: ELEVATION,
  },
)
const at = (p) => k.iso(p, P)
const S = (paths, style) => k.solidSvg(paths, style)
const L = (d, style) => k.lineSvg(d, style)
const D = (points, style) => k.dotsSvg(points, style)
const f = (n) => n.toFixed(3)

// Body axes: x forward along the nose, y to starboard... turned by REST about the stand.
const cb = Math.cos((REST * Math.PI) / 180)
const sb = Math.sin((REST * Math.PI) / 180)
const rz = ([x, y, z]) => [x * cb - y * sb, x * sb + y * cb, z]
const X = (station) => (PIVOT - station) * M
const VERT = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0])
const frameOf = (o, a, u) => {
  const axis = G.unit3(rz(a))
  const uw = rz(u)
  const uu = G.unit3(G.sub3(uw, G.mul3(axis, G.dot3(uw, axis))))
  return { o: rz(o), a: axis, u: uu, v: G.cross3(axis, uu) }
}
const UP = { o: [0, 0, 0], a: [0, 0, 1], u: rz([1, 0, 0]), v: rz([0, 1, 0]) }
// Along the fuselage: s is the station in mm from the nose, x points to −y, y up.
const AFT = (z = ZC, y = 0) => frameOf([X(0), y, z], [-1, 0, 0], [0, -1, 0])

const R = A.recorder(P)
const put = (item) =>
  R.put({
    ...item,
    shapes: item.shapes.map((shape, index) =>
      R.solid(
        Object.assign(shape, {
          name: shape.name ?? (index ? `${item.name}#${index + 1}` : item.name),
        }),
      ),
    ),
  })

// ---------- Static stand: plinth on four feet, a degree ring round the platter, an engraved plate ----------
function stand() {
  for (const [x, y] of k.corners(PLINTH, 14)) {
    const svg = S(k.cylinder(x, y, 6, -PLINTH_H - FOOT_H, FOOT_H, P, 28), { tone: 'lo' })
    put({
      name: `stand.foot.${x}.${y}`,
      layer: 'back',
      at: [x, y, -PLINTH_H - FOOT_H],
      svg,
      shapes: [A.cylinder(x, y, 6, -PLINTH_H - FOOT_H, FOOT_H, { ground: true })],
    })
  }
  const screws = k.corners(PLINTH, 7)
  const ticks = k.radialTicks(0, 0, PLATTER_R + 7.2, 72, 6, 0, [1.6, 3.2], P)
  const inner = L(k.sideSeam(PLINTH, -PLINTH_H + 4, P, 8), { tone: 'faint' })
  const top = [
    L(k.planOutline(k.insetPlan(PLINTH, 4), 0, P), { tone: 'faint' }),
    L(ticks.minor, { tone: 'lo' }),
    L(ticks.major, { tone: 'mid' }),
    L(k.ring(0, 0, PLATTER_R + 7.4, 0, P, 96), { tone: 'faint' }),
    L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(''), { tone: 'lo' }),
    D(
      screws.map(([x, y]) => at([x, y, 0])),
      { size: 0.5 },
    ),
  ].join('')
  const svg = S(k.slabOf(PLINTH, -PLINTH_H, PLINTH_H, P, 8, 1.4), { tone: 'mid', inner }) + top
  put({
    name: 'stand.plinth',
    layer: 'back',
    at: [0, 0, -PLINTH_H],
    bias: 4,
    svg,
    shapes: [A.slab(PLINTH, -PLINTH_H, PLINTH_H, { ground: true })],
  })
  plate()
}

/** The plate on the plinth's front face (+x), the one label in the drawing. */
function plate() {
  const x = PLINTH.x + PLINTH.w
  const W = 46
  const H = 7.4
  const z0 = -PLINTH_H / 2 - H / 2 - 0.6
  const T = 0.6
  const ring = [
    [x, -W / 2],
    [x + T, -W / 2],
    [x + T, W / 2],
    [x, W / 2],
  ]
  const body = S(k.extrude(ring, z0, H, P, { bevel: 0.25 }), { tone: 'hi' })
  const face = (yy, zz) => at([x + T, yy, zz])
  const screws = D([face(-W / 2 + 2.2, z0 + H / 2), face(W / 2 - 2.2, z0 + H / 2)], { size: 0.45 })
  // Text space mapped onto the face: x runs along the plate (−y reads left to right from the viewer), y runs down.
  const base = z0 + H / 2 - 1.05
  const o = face(W / 2 - 4.6, base)
  const ux = face(W / 2 - 5.6, base)
  const vy = face(W / 2 - 4.6, base - 1)
  const matrix = [ux[0] - o[0], ux[1] - o[1], vy[0] - o[0], vy[1] - o[1], o[0], o[1]]
    .map(f)
    .join(' ')
  const text = `<text class="iso-face-text" data-tone="mid" font-size="2.9" textLength="${W - 9.2}" lengthAdjust="spacingAndGlyphs" transform="matrix(${matrix})">CONCORDE · 1:200</text>`
  put({
    name: 'stand.plate',
    layer: 'back',
    at: [x, 0, z0],
    svg: `${body}${text}${screws}`,
    shapes: [A.extruded(ring, z0, H)],
  })
}

// ---------- The turning model ----------
const T = turning(P, { recorder: R })
const model = T.group('model', { turn: { pivot: [0, 0] } })
const live = T.layer('model')
T.stack(['back', 'model', 'front'])
const poses = () => Array.from({ length: 720 }, (_, i) => ({ model: i * 0.5 }))
const H = { group: model, layer: live }

// Platter, stem and cradle
const platter = T.round({
  name: 'stand.platter',
  ...H,
  F: VERT(0, 0),
  s0: 0,
  s1: PLATTER_H,
  r: PLATTER_R,
  tone: 'mid',
  crease: 'lo',
  details: { seams: [1.1], bolts: [{ s: PLATTER_H, r: 9.5, count: 6, size: 0.45, phase: 0.2 }] },
})
const index = rz([1, 0, 0])
T.plane({
  part: platter,
  o: [0, 0, PLATTER_H],
  u: index,
  v: rz([0, 1, 0]),
  svg: `<path class="iso-line" data-tone="mid" d="M${PLATTER_R - 1.4} 0L${PLATTER_R - 7} 0"/><circle class="iso-line" data-tone="lo" r="${PLATTER_R - 3}" fill="none"/>`,
})
T.round({
  name: 'stand.collar',
  ...H,
  F: VERT(0, 0),
  s0: PLATTER_H,
  s1: PLATTER_H + 4,
  r: 4.2,
  tone: 'mid',
  details: { seams: [PLATTER_H + 1.2] },
})
const STEM_TOP = BELLY - CRADLE_H
T.round({
  name: 'stand.stem',
  ...H,
  F: VERT(0, 0),
  s0: PLATTER_H + 4,
  s1: STEM_TOP,
  r: STEM_R,
  tone: 'hi',
})
T.prism({
  name: 'stand.cradle',
  ...H,
  F: UP,
  polygon: [
    [-9, -2.6],
    [9, -2.6],
    [9, 2.6],
    [-9, 2.6],
  ],
  round: 1,
  s0: STEM_TOP,
  s1: BELLY,
  tone: 'mid',
  bevel: 0.3,
  details: {
    dots: [-1, 1].map((side) => ({
      at: [STEM_TOP + 1.5, 0, side * 2.6],
      normal: rz([0, side, 0]),
      size: 0.4,
    })),
  },
})

// Raised display-model nose: a fine radome, a fuller cockpit shoulder and six angular panes.
// Stations and glazing proportions are estimated from the supplied Air France reference.
const NOSE_L = NOSE_END * M
const RHO = (R0 * R0 + NOSE_L * NOSE_L) / (2 * R0)
const ogive = (s) => Math.sqrt(Math.max(0, RHO * RHO - (NOSE_L - s) ** 2)) + R0 - RHO
const ogiveSlope = (s) => (NOSE_L - s) / Math.sqrt(Math.max(1e-9, RHO * RHO - (NOSE_L - s) ** 2))
const NOSE_S0 = 0.8
const noseF = AFT()
const nose = T.lathe({
  name: 'air.nose',
  ...H,
  F: noseF,
  profile: [
    [NOSE_S0, ogive(NOSE_S0)],
    [NOSE_L, R0],
  ],
  radius: ogive,
  slope: ogiveSlope,
  tone: 'hi',
  crease: 'faint',
  details: { seams: [3.8 * M, 7.7 * M] },
})
// Surface details share the nose's turning part, so the far-side glazing fades with its facing.
function nosePanel(s, phi, polygon, glazed = true) {
  const radial = G.add3(G.mul3(noseF.u, Math.cos(phi)), G.mul3(noseF.v, Math.sin(phi)))
  const tangent = G.add3(G.mul3(noseF.u, -Math.sin(phi)), G.mul3(noseF.v, Math.cos(phi)))
  const d = polygon.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('') + 'Z'
  T.plane({
    part: nose,
    o: G.pointOf(noseF, s, ogive(s), phi),
    u: G.unit3(G.add3(noseF.a, G.mul3(radial, ogiveSlope(s)))),
    v: tangent,
    normal: G.unit3(G.sub3(radial, G.mul3(noseF.a, ogiveSlope(s)))),
    svg: `<path class="iso-line${glazed ? ' cn-cockpit' : ''}" data-tone="${glazed ? 'mid' : 'lo'}" d="${d}"/>`,
  })
}
for (const side of [-1, 1]) {
  const angle = (phi) => (side > 0 ? phi : Math.PI - phi)
  // Swept windscreen, quarter light and longer side pane, separated by narrow mullions.
  nosePanel(5.1 * M, angle(1.22), [
    [-2.5, -1.0],
    [1.7, -1.2],
    [2.4, 0.9],
    [-1.5, 1.2],
  ])
  nosePanel(5.8 * M, angle(0.82), [
    [-1.5, -1.0],
    [1.2, -1.0],
    [1.7, 1.1],
    [-1.2, 1.1],
  ])
  nosePanel(6.5 * M, angle(0.57), [
    [-1.6, -1.0],
    [2.0, -0.7],
    [1.7, 1.0],
    [-1.6, 1.2],
  ])
  // The raised visor runs forward from the windscreen to the radome seam.
  nosePanel(
    4.35 * M,
    angle(1.02),
    [
      [-2.5, -0.4],
      [1.0, -1.4],
      [1.3, 1.5],
      [-2.2, 0.7],
    ],
    false,
  )
}
T.round({ name: 'air.pitot', ...H, F: noseF, s0: -2.5, s1: NOSE_S0, r: 0.12, tone: 'mid' })

// Barrel: cabin windows (the lit part, a row each side just above the axis) and frame seams at the door stations.
const windows = []
const phi = Math.asin(1.4 / R0)
for (let i = 0; i < WINDOWS.count; i++) {
  const s = (WINDOWS.from + ((WINDOWS.to - WINDOWS.from) * i) / (WINDOWS.count - 1)) * M
  for (const side of [-1, 1])
    windows.push({
      at: [s, side * R0 * Math.cos(phi), R0 * Math.sin(phi)],
      normal: rz([0, -side * Math.cos(phi), Math.sin(phi)]),
      size: 0.72,
      tone: 'lit',
    })
}
T.round({
  name: 'air.barrel',
  ...H,
  F: AFT(),
  s0: NOSE_L,
  s1: BODY_END * M,
  r: R0,
  tone: 'hi',
  crease: 'faint',
  details: { seams: [12.6 * M, 27.4 * M, 42.6 * M, 52 * M], dots: windows },
})
T.round({
  name: 'air.tail',
  ...H,
  F: AFT(),
  s0: BODY_END * M,
  s1: LENGTH * M,
  r: [R0, TAIL_R],
  tone: 'hi',
  crease: 'faint',
  details: { seams: [59.4 * M] },
})

// Wing: the ogee planform cut into chordwise strips (each convex), with the elevon hinge lines on top.
const strips = []
for (const side of [-1, 1]) {
  for (let i = 0; i < LE.length - 1; i++) {
    const [ya, xa] = LE[i]
    const [yb, xb] = LE[i + 1]
    const Ya = i === 0 ? ROOT_Y / M : ya
    const polygon = [
      [X(xa), side * Ya * M],
      [X(xb), side * yb * M],
      [X(TE(yb)), side * yb * M],
      [X(TE(Ya)), side * Ya * M],
    ]
    const part = T.prism({
      name: `air.wing.${side > 0 ? 's' : 'p'}${i}`,
      ...H,
      F: UP,
      polygon,
      s0: WING_BOT,
      s1: WING_TOP,
      tone: 'hi',
      crease: 'faint',
    })
    strips.push({ part, side, ya: Ya, yb })
  }
}
for (const { part, side, ya, yb } of strips) {
  const segments = []
  const hinge = (y) => [X(TE(y) - 1.7), side * y * M]
  for (const [e0, e1] of ELEVON) {
    const a = Math.max(ya, e0)
    const b = Math.min(yb, e1)
    if (b - a < 1e-6) continue
    const p = hinge(a)
    const q = hinge(b)
    segments.push(`M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`)
    for (const e of [e0, e1])
      if (e >= ya - 1e-6 && e <= yb + 1e-6) {
        const h = hinge(e)
        segments.push(`M${f(h[0])} ${f(h[1])}L${f(X(TE(e)))} ${f(side * e * M)}`)
      }
  }
  if (segments.length)
    T.plane({
      part,
      o: [0, 0, WING_TOP],
      u: UP.u,
      v: UP.v,
      svg: `<path class="iso-line" data-tone="faint" d="${segments.join('')}"/>`,
    })
}

// Nacelles: one twin-engine box under each wing, a pair of intakes in front, four nozzles behind.
const EXIT = (NACELLE.x1 + NOZZLE.len) * M
const reheat = { exits: [], plume: [], proxies: [] }
for (const side of [-1, 1]) {
  const tag = side > 0 ? 's' : 'p'
  const y0 = NACELLE.y0 * M
  const y1 = NACELLE.y1 * M
  const zb = WING_BOT - NACELLE.h * M
  const c = 1.4
  // Section in the AFT frame: x = −y, y = z.
  const xs = side > 0 ? [-y1, -y0] : [y0, y1]
  const polygon = [
    [xs[0], WING_BOT],
    [xs[1], WING_BOT],
    [xs[1], zb + c],
    [xs[1] - c, zb],
    [xs[0] + c, zb],
    [xs[0], zb + c],
  ]
  const nacelle = T.prism({
    name: `air.nacelle.${tag}`,
    ...H,
    F: frameOf([X(0), 0, 0], [-1, 0, 0], [0, -1, 0]),
    polygon,
    s0: NACELLE.x0 * M,
    s1: NACELLE.x1 * M,
    tone: 'mid',
    crease: 'faint',
    bevel: 0.3,
    details: { seams: [(NACELLE.x0 + 2.4) * M, (NACELLE.x0 + 7.8) * M] },
  })
  const yc = side * ((NACELLE.y0 + NACELLE.y1) / 2) * M
  const zc = (WING_BOT + zb) / 2
  const wHalf = ((NACELLE.y1 - NACELLE.y0) / 2) * M
  const hHalf = (NACELLE.h * M) / 2
  // The intake mouths on the front face, either side of the centre wall.
  const mouth = (u0, u1) =>
    `M${f(u0)} ${f(-hHalf + 1.6)}L${f(u1)} ${f(-hHalf + 1.6)}L${f(u1)} ${f(hHalf - 1.2)}L${f(u0)} ${f(hHalf - 1.2)}Z`
  const mouths = mouth(-wHalf + 1.1, -0.5) + mouth(0.5, wHalf - 1.1)
  const intakeLights = [-1, 1]
    .map(
      (e) =>
        `<rect class="cn-engine-light" x="${f((e * wHalf) / 2 - 1.5)}" y="-1.2" width="3" height="2.4" rx="0.35"/>`,
    )
    .join('')
  T.plane({
    part: nacelle,
    o: rz([X(NACELLE.x0), yc, zc]),
    u: rz([0, 1, 0]),
    v: [0, 0, -1],
    normal: rz([1, 0, 0]),
    svg: `<path class="iso-fill cn-intake" d="${mouths}"/><path class="iso-line" data-tone="lo" d="${mouths}"/>${intakeLights}`,
  })
  for (const e of [-1, 1]) {
    const y = yc + e * NOZZLE.dy * M
    const nozzle = T.round({
      name: `air.nozzle.${tag}${e > 0 ? 'o' : 'i'}`,
      ...H,
      F: frameOf([X(0), y, zc], [-1, 0, 0], [0, -1, 0]),
      s0: NACELLE.x1 * M,
      s1: (NACELLE.x1 + NOZZLE.len) * M,
      r: [NOZZLE.r0 * M, NOZZLE.r1 * M],
      tone: 'mid',
      crease: 'lo',
      details: {
        seams: [(NACELLE.x1 + 0.45) * M],
        rings: [
          {
            at: [(NACELLE.x1 + NOZZLE.len) * M, 0, 0],
            normal: rz([-1, 0, 0]),
            r: NOZZLE.r1 * M - 0.6,
            tone: 'lo',
          },
        ],
      },
    })
    const throat = NOZZLE.r1 * M - 0.9
    T.plane({
      part: nozzle,
      o: rz([X(NACELLE.x1 + NOZZLE.len), y, zc]),
      u: rz([0, -1, 0]),
      v: [0, 0, 1],
      normal: rz([-1, 0, 0]),
      svg: `<circle class="cn-intake" r="${f(throat + 0.3)}"/><circle class="cn-engine-glow" r="${f(throat)}"/><circle class="cn-engine-light" r="${f(throat)}"/>`,
    })
    reheat.exits.push(rz([X(NACELLE.x1 + NOZZLE.len), y, zc]))
    reheat.plume.push(reheat.proxies.length)
  }
  // The pair's reheat proxy: a stadium prism round both flames, 0.12 mm behind the nozzle exits (inside the audit's
  // touch, with a clean separating plane). concorde.css hides it; reheat.ts masks the flames with the parts drawn after it.
  const half = NOZZLE.dy * M
  const rp = REHEAT.proxy * M
  const name = `air.plume.${tag}`
  T.prism({
    name,
    ...H,
    F: frameOf([X(0), 0, 0], [-1, 0, 0], [0, -1, 0]),
    polygon: [
      [-yc - half - rp, zc - rp],
      [-yc + half + rp, zc - rp],
      [-yc + half + rp, zc + rp],
      [-yc - half - rp, zc + rp],
    ],
    round: rp * 0.98,
    s0: EXIT + 0.12,
    s1: EXIT + REHEAT.proxyLen * M,
    tone: 'faint',
    crease: 'faint',
  })
  reheat.proxies.push(name)
}

// Fin and the two-piece rudder: thin plates standing on the barrel's top line (tangent contact).
const FIN_T = 0.9
const finF = frameOf([0, 0, ZC + R0], [0, 1, 0], [-1, 0, 0])
const fx = (station) => (station - PIVOT) * M // finF.u is −x
const fz = (h) => h * M
const hingeAt = (h) => FIN.hinge[0] + ((FIN.hinge[1] - FIN.hinge[0]) * h) / FIN.h
const teAt = (h) => FIN.root[1] + ((FIN.tip[1] - FIN.root[1]) * h) / FIN.h
const plateAt = (name, polygon, t, bevel) =>
  T.prism({ name, ...H, F: finF, polygon, s0: -t, s1: t, tone: 'hi', crease: 'faint', bevel })
plateAt(
  'air.fin',
  [
    [fx(FIN.root[0]), 0],
    [fx(FIN.hinge[0]), 0],
    [fx(FIN.hinge[1]), fz(FIN.h)],
    [fx(FIN.tip[0]), fz(FIN.h)],
  ],
  FIN_T,
  0.2,
)
plateAt(
  'air.rudder.lo',
  [
    [fx(FIN.hinge[0]), 0],
    [fx(FIN.root[1]), 0],
    [fx(teAt(FIN.split)), fz(FIN.split)],
    [fx(hingeAt(FIN.split)), fz(FIN.split)],
  ],
  FIN_T * 0.8,
  0.15,
)
plateAt(
  'air.rudder.hi',
  [
    [fx(hingeAt(FIN.split)), fz(FIN.split)],
    [fx(teAt(FIN.split)), fz(FIN.split)],
    [fx(FIN.tip[1]), fz(FIN.h)],
    [fx(FIN.hinge[1]), fz(FIN.h)],
  ],
  FIN_T * 0.8,
  0.15,
)
// Dorsal antenna blades, standing on the barrel's top line like the fin.
for (const [i, station] of ANTENNAS.entries())
  plateAt(
    `air.antenna.${i}`,
    [
      [fx(station - 0.5), 0],
      [fx(station + 0.5), 0],
      [fx(station + 0.6), fz(0.55)],
      [fx(station + 0.25), fz(0.55)],
    ],
    0.25,
    0,
  )

// ---------- Build ----------
stand()
const out = T.build({ statics: R.items, poses, verify: false })
A.settle(R, P)
const layerOf = (name) =>
  R.items
    .filter((item) => item.layer === name)
    .sort((a, b) => a.key - b.key)
    .map((item) => item.svg)
const BACK = [
  `<path class="iso-halo" d="${k.haloOf(PLINTH, -PLINTH_H - FOOT_H, PLINTH_H, P)}"/>`,
  ...layerOf('back'),
]
if (argv.includes('--audit')) {
  const TA = await import(pathToFileURL(join(KIT, 'turn-audit.mjs')))
  A.auditOrExit(R, P, { argv: ['--audit'] })
  TA.orbitOrExit(T, R, P, {
    sweep: { at: (x) => ({ model: x }), from: 0, to: 360, frame: 0.3 },
    quick: argv.includes('--quick'),
    only:
      argv
        .find((a) => a.startsWith('--only='))
        ?.slice(7)
        .split(',') ?? null,
  })
}

const LABEL = 'A 1:200 Concorde display model turning slowly on its stand.'
const back = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: BACK })
const front = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-layer" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${layerOf('front').join('')}</svg>`
// The reheat canvas sits over the live model, under the front layer.
const liveSvg = `${out.layerSvg('model', { width: WIDTH, height: HEIGHT })}<canvas class="iso-layer cn-reheat" aria-hidden="true"></canvas>`
const r3 = (v) => Math.round(v * 1e4) / 1e4
const REHEAT_DATA = {
  view: [WIDTH, HEIGHT],
  camera: GL.glCamera(P),
  // Rest-world points and direction in the `model` group: the nozzle exit centres and the aft axis.
  exits: reheat.exits.map((p) => p.map(r3)),
  axis: rz([-1, 0, 0]).map(r3),
  plume: reheat.plume,
  proxies: reheat.proxies,
  // Model millimetres: the nozzle opening's radius and the drawn flame's length.
  r: NOZZLE.r1 * M - 0.6,
  len: REHEAT.len * M,
}

// ---------- CSS: the kit's rules scoped under .auth-concorde, keeping only those the figure can match ----------
const SCOPE = '.auth-concorde'
function rulesOf(css) {
  const rules = []
  let depth = 0
  let start = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) {
      rules.push(css.slice(start, i + 1).trim())
      start = i + 1
    }
  }
  return rules.filter(Boolean)
}
function scoped(selector) {
  return selector
    .split(',')
    .map((part) => {
      const s = part.trim()
      if (s === '.iso') return SCOPE
      if (s.startsWith('.iso ')) return `${SCOPE}${s.slice(4)}`
      return `${SCOPE} ${s}`
    })
    .join(',')
}
// Rules for parts the figure never has: metal materials, plates, legends and keys, wires, tubes, lit solids, flowing
// and pulsing lines (with their keyframes), dashes, the plate figure's margin and the red, green and blue tones.
const UNUSED =
  /data-mat|iso-(plate|legend|key|swatch|wire|figure|flow|pulse)|\.tb\b|tb-|data-(lit|flow|pulse|dotted|dashed)|"(red|green|blue)"/
function scope(css) {
  return rulesOf(css)
    .flatMap((rule) => {
      const open = rule.indexOf('{')
      const head = rule.slice(0, open).trim()
      const body = rule.slice(open + 1, -1)
      if (UNUSED.test(head)) return []
      if (head.startsWith('@keyframes')) return [rule]
      if (head.startsWith('@media')) {
        const inner = scope(body)
        return inner ? [`${head}{${inner}}`] : []
      }
      // The kit's palettes: concorde.css maps every --anatomy-* role onto Kuuki's iso tokens.
      if (/^\.iso(\[data-theme="(dark|light)"\])?$/.test(head)) return []
      return [`${scoped(head)}{${body}}`]
    })
    .join('\n')
}
const kitCss = readFileSync(join(KIT, 'iso.css'), 'utf8')
// The stage keeps the viewBox's aspect, so concorde.css can size-contain it.
const css = `/* Generated by scripts/generate-concorde.mjs from the anatomy kit's iso.css and TURN_CSS (MIT). Do not edit by hand. */\n${SCOPE}{aspect-ratio:${WIDTH}/${HEIGHT}}\n${scope(kitCss)}\n${scope(out.css)}\n`

// ---------- Write ----------
mkdirSync(OUT, { recursive: true })
const header = `// Generated by scripts/generate-concorde.mjs (pnpm generate:concorde). Do not edit by hand.\n`
writeFileSync(
  join(OUT, 'concorde.generated.ts'),
  `${header}import type { Reheat } from './reheat'\n\n` +
    `// The stage's markup (the static stand, the live model layer as drawn at turn 0 with the reheat canvas, the front\n` +
    `// layer), the turn data the runtime replays and the reheat geometry.\n` +
    `export const CONCORDE: { html: string; data: unknown; reheat: Reheat } = ${JSON.stringify({ html: back + liveSvg + front, data: out.data, reheat: REHEAT_DATA })}\n`,
)
writeFileSync(join(OUT, 'concorde.generated.css'), css)
const runtime = readFileSync(join(KIT, 'turn.mjs'), 'utf8')
const glRuntime = readFileSync(join(KIT, 'gl.mjs'), 'utf8')
const license = readFileSync(join(KIT, '..', 'LICENSE'), 'utf8')
writeFileSync(
  join(OUT, 'turn.generated.js'),
  `// The anatomy kit's 3D turn runtime, copied by scripts/generate-concorde.mjs. Do not edit by hand.\n/*\n${license.trim()}\n*/\n${runtime}`,
)
writeFileSync(
  join(OUT, 'gl.generated.js'),
  `// The anatomy kit's WebGL layer, copied by scripts/generate-concorde.mjs. Do not edit by hand.\n/*\n${license.trim()}\n*/\n${glRuntime}`,
)

writeFileSync(
  join(OUT, 'turn.generated.d.ts'),
  `${header}// The part of the turn runtime's API the sign-in figure uses.\n` +
    `export type Vec3 = [number, number, number]\n` +
    `export type Cover = { uCoverEdge: Float32Array; uCoverCount: Float32Array; dropped: number; parts: string[] }\n` +
    `export type TurnController = {\n` +
    `  set(values: Record<string, number>): unknown\n` +
    `  events(): unknown[]\n` +
    `  anchor(group: string, point: number[], direction?: number[]): { world: Vec3; screen: [number, number]; direction?: Vec3 }\n` +
    `  cover(names: string | string[], options?: { polygons?: number; edges?: number; pad?: number }): Cover\n` +
    `  cams(): { world: { V: Vec3 } }\n` +
    `  destroy(): void\n` +
    `}\n` +
    `export const TURN: {\n  mount(stage: HTMLElement, data: unknown): TurnController\n}\n`,
)
writeFileSync(
  join(OUT, 'gl.generated.d.ts'),
  `${header}// The part of the WebGL layer's API the reheat flame uses.\n` +
    `export type GlValue = number | number[] | Float32Array\n` +
    `export type GlLayer = {\n` +
    `  gl: WebGLRenderingContext\n` +
    `  set(values: Record<string, GlValue>): void\n` +
    `  draw(values: Record<string, GlValue>, time: number): void\n` +
    `  clear(): void\n` +
    `}\n` +
    `export function glLayer(options: {\n` +
    `  canvas: HTMLCanvasElement\n` +
    `  fragment: string\n` +
    `  view: number[]\n` +
    `  camera: { origin: number[]; k: number; cam: number[] }\n` +
    `  uniforms?: string[]\n` +
    `  fixed?: Record<string, GlValue>\n` +
    `  maxRatio?: number\n` +
    `  onError?: (message: string) => void\n` +
    `}): GlLayer | null\n` +
    `export function burst(age: number, rise: number, fall: number): number\n` +
    `export function settle(state: { x: number; v: number }, target: number, dt: number, seconds: number, calm?: boolean): boolean\n`,
)

let area = 0
for (let i = 0; i < LE.length - 1; i++)
  area +=
    ((TE(LE[i][0]) - LE[i][1] + TE(LE[i + 1][0]) - LE[i + 1][1]) / 2) * (LE[i + 1][0] - LE[i][0])
area = 2 * (area + (TE(0) - LE[0][1]) * LE[0][0])
console.log(
  `concorde: ${out.report.parts} live parts · ${R.items.length} static items · data ${(JSON.stringify(out.data).length / 1024).toFixed(0)} KB · css ${(css.length / 1024).toFixed(0)} KB · wing ${area.toFixed(1)} m² as drawn (358.25 published) · build ${out.report.seconds.toFixed(1)} s`,
)

if (argv.includes('--preview')) {
  const theme = argv.includes('--light') ? 'light' : 'dark'
  // The app's reheat module, types stripped, with the kit's GL layer inlined in place of its imports.
  const ts = (await import('typescript')).default
  const reheatTs = readFileSync(
    new URL('../apps/next/src/client/auth-card/concorde/reheat.ts', import.meta.url),
    'utf8',
  )
  const reheatJs = ts
    .transpileModule(reheatTs, { compilerOptions: { target: ts.ScriptTarget.ES2020 } })
    .outputText.replace(/^import .*$/gm, '')
    .replace(/^export /gm, '')
  const live = `${glRuntime.replace(/^export /gm, '')}\n${reheatJs}\nconst DATA = ${JSON.stringify(out.data)};\nconst REHEAT = ${JSON.stringify(REHEAT_DATA)};\n${readFileSync(new URL('./concorde/preview.js', import.meta.url), 'utf8')}`
  const stage = `<div class="iso-stage iso-turn cn-stage">${back}${liveSvg}${front}</div>`
  const body = k.plateHtml({
    fig: 'Fig 1',
    title: 'Concorde, 1:200',
    hint: 'Turns on its own',
    readout: 'hdg 000°',
    keys: [{ mark: 'lit', label: 'Cabin windows and engines' }],
    caption: `61.66 m long, 25.6 m span; ogee wing ${area.toFixed(0)} m² as drawn (358.25 m² published).`,
    body: `<style>${out.css}\n.cn-intake{fill:var(--anatomy-halo);opacity:.6}.iso-live [data-tone=lit] circle{fill:#ea846f}.cn-cockpit{fill:var(--anatomy-mid);stroke-width:.45}.cn-engine-light,.cn-engine-glow{fill:color-mix(in oklab,#ea846f,#ffb24a calc(var(--cn-reheat,0)*100%));stroke:none}.cn-engine-light{opacity:.85}.cn-engine-glow{filter:blur(2px);opacity:.65}[data-name^="air.plume"]{display:none}.iso:not([data-theme=light]) .cn-reheat{mix-blend-mode:screen}</style>${stage}`,
  })
  const page = k.pageHtml({
    title: 'Concorde',
    theme,
    body,
    script: runtime.replace(/^export /gm, '') + live,
    width: WIDTH + 40,
  })
  mkdirSync('.scratch/concorde', { recursive: true })
  writeFileSync(`.scratch/concorde/concorde${theme === 'light' ? '-light' : ''}.html`, page)
}
