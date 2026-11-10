// Build-time coupe artwork. Shares the airliner's pinned anatomy kit, material ramps and SVG serializer.
import { ringsOfPath, type Draw } from '../airliner/draw'
import { loadKit } from '../airliner/kit'
import { laneCamera } from '../lane-camera'
import type { Ink, Item, Mat } from '../airliner/model'
import { serialize } from '../airliner/svg'
import { add, dot, normalAt, type Pt, type Surface, type V3 } from '../airliner/surface'
import {
  ARCH_R,
  AXLES,
  LENGTH,
  TRACK,
  TYRE_R,
  TYRE_W,
  at,
  belt,
  cabin,
  cabinAt,
  cabinU,
  halfWidth,
  side,
  sideAt,
  top,
  topAt,
} from './model'

const sample = <T>(n: number, f: (t: number) => T) =>
  Array.from({ length: n + 1 }, (_, i) => f(i / n))
const loop = (p: Pt[]) => [...p, p[0]]
const ellipse = (a: number, b: number, ra: number, rb: number, n = 40): Pt[] =>
  Array.from({ length: n }, (_, i) => [
    a + ra * Math.cos((i * 2 * Math.PI) / n),
    b + rb * Math.sin((i * 2 * Math.PI) / n),
  ])

function wheel(d: Draw, axle: number, sg: number): Item[] {
  const { G, P, cam, kitSolid } = d
  const a = AXLES[axle],
    w = TYRE_W[axle],
    y = (sg * TRACK[axle]) / 2
  const F = G.frameAlong(at(a, y, TYRE_R), [0, sg, 0])
  const R = TYRE_R,
    outer = w / 2
  const out: Item[] = [
    kitSolid(
      G.solidOf(
        [
          [-w / 2, R * 0.67],
          [-w / 2, R * 0.83, 1],
          [-w * 0.38, R * 0.97, 1],
          [-w * 0.24, R, 1],
          [w * 0.24, R, 1],
          [w * 0.38, R * 0.97, 1],
          [w / 2, R * 0.83, 1],
          [w / 2, R * 0.67],
        ],
        F,
        P,
        { steps: 48 },
      ),
      'rubber',
      [],
      0.45,
    ),
  ]
  out.push(
    kitSolid(
      G.ringBand(outer + 0.014, outer + 0.021, R * 0.625, R * 0.695, F, P, { steps: 48 }),
      'metal',
      [],
      0.2,
    ),
  )
  // Face positions are measured along the outward axle: brake behind spokes, rim lip in front.
  out.push(
    kitSolid(G.disc(outer - 0.02, outer + 0.002, R * 0.685, F, P, { steps: 48 }), 'void', [], 0.2),
  )
  out.push(
    kitSolid(G.disc(outer + 0.003, outer + 0.006, R * 0.5, F, P, { steps: 40 }), 'metal', [], 0.1),
  )
  const point = (x: number, z: number, depth = outer + 0.012): V3 =>
    at(a + x, y + sg * depth, TYRE_R + z)
  const fill = (pts: V3[], mat: Mat, edge?: Ink, width = 0.2): Item => ({
    kind: 'fill',
    rings: [pts.map(cam.project)],
    mat,
    edge,
    width,
  })
  // Drilled rotor holes, visible only between spokes.
  for (let i = 0; i < 16; i++) {
    const t = (2 * Math.PI * i) / 16
    out.push(
      fill(
        ellipse(R * 0.39 * Math.cos(t), R * 0.39 * Math.sin(t), 0.007, 0.007, 8).map(([x, z]) =>
          point(x, z, outer + 0.007),
        ),
        'void',
      ),
    )
  }
  // Rotor friction track and hat, then a two-piece caliper bolted over the leading edge.
  for (const r of [0.455, 0.31])
    out.push({
      kind: 'lines',
      lines: {
        runs: ringsOfPath(G.circleOf(F, outer + 0.0065, R * r, P)),
        ink: 'faint',
        width: 0.1,
      },
    })
  out.push(
    fill(
      [
        [-R * 0.5, -R * 0.2],
        [-R * 0.43, -R * 0.26],
        [-R * 0.27, -R * 0.26],
        [-R * 0.27, R * 0.26],
        [-R * 0.43, R * 0.26],
        [-R * 0.5, R * 0.2],
      ].map(([x, z]) => point(x, z, outer + 0.009)),
      'metal',
      'seam',
      0.14,
    ),
  )
  for (const z of [-0.2, 0.2])
    out.push(
      fill(
        ellipse(-R * 0.37, R * z, 0.006, 0.006, 8).map(([x, y2]) => point(x, y2, outer + 0.0098)),
        'metal',
        'seam',
        0.08,
      ),
    )
  for (let i = 0; i < 5; i++) {
    const t = (2 * Math.PI * i) / 5 - 0.15
    const spoke = (r: number, w: number) =>
      point(r * Math.cos(t) - w * Math.sin(t), r * Math.sin(t) + w * Math.cos(t))
    out.push(
      fill(
        [
          spoke(R * 0.13, -0.022),
          spoke(R * 0.61, -0.038),
          spoke(R * 0.65, 0.005),
          spoke(R * 0.58, 0.036),
          spoke(R * 0.13, 0.022),
        ],
        'body',
        'seam',
        0.18,
      ),
    )
    // Lit top face of the spoke, narrower than its flank, and a faint root fillet at the hub.
    out.push(
      fill(
        [
          spoke(R * 0.19, -0.009),
          spoke(R * 0.58, -0.016),
          spoke(R * 0.6, 0.002),
          spoke(R * 0.55, 0.014),
          spoke(R * 0.19, 0.008),
        ].map((p): V3 => add(p, [0, sg * 0.0025, 0])),
        'metal',
        'faint',
        0.06,
      ),
    )
  }

  out.push(
    kitSolid(G.disc(outer + 0.021, outer + 0.028, R * 0.18, F, P, { steps: 24 }), 'metal', [], 0.2),
  )
  for (let i = 0; i < 5; i++) {
    const t = (2 * Math.PI * i) / 5 + 0.45
    const nut = (rad: number) =>
      ellipse(R * 0.235 * Math.cos(t), R * 0.235 * Math.sin(t), rad, rad, 10).map(([x, z]) =>
        point(x, z, outer + 0.0265),
      )
    out.push(fill(nut(0.0135), 'metal', 'seam', 0.1), fill(nut(0.0055), 'void'))
  }
  // Centre cap: badge ring and dome highlight.
  out.push({
    kind: 'lines',
    lines: {
      runs: ringsOfPath(G.circleOf(F, outer + 0.0285, R * 0.12, P)),
      ink: 'faint',
      width: 0.1,
    },
  })
  out.push(
    fill(
      ellipse(0, 0, R * 0.055, R * 0.055, 12).map(([x, z]) => point(x, z, outer + 0.0295)),
      'body',
      'seam',
      0.08,
    ),
  )
  // Valve stem between two spokes with its cap.
  {
    const t = 4.25,
      c = Math.cos(t),
      s = Math.sin(t)
    const q = (r: number) => point(R * r * c, R * r * s, outer + 0.0225)
    out.push({
      kind: 'lines',
      lines: { runs: [[cam.project(q(0.64)), cam.project(q(0.585))]], ink: 'line', width: 0.34 },
    })
    out.push(
      fill(
        ellipse(R * 0.575 * c, R * 0.575 * s, 0.006, 0.006, 8).map(([x, z]) =>
          point(x, z, outer + 0.0225),
        ),
        'metal',
        'seam',
        0.08,
      ),
    )
  }
  // Sidewall: shoulder step, rim guard rib and the faint tread-edge ring.
  for (const [r, depth] of [
    [0.9, 0.001],
    [0.77, 0.001],
    [0.84, 0.002],
  ] as const)
    out.push({
      kind: 'lines',
      lines: {
        runs: ringsOfPath(G.circleOf(F, outer + depth, R * r, P)),
        ink: 'faint',
        width: r === 0.84 ? 0.14 : 0.1,
      },
    })
  return out
}

export function coupe(d: Draw): Item[] {
  const { cam, solid, kitSolid, G, P } = d
  const out: Item[] = []
  const fill = (points: V3[], mat: Mat | 'shadow', edge?: Ink, width = 0.25) =>
    out.push({ kind: 'fill', rings: [points.map(cam.project)], mat, edge, width })
  const line = (points: V3[], ink: Ink = 'seam', width = 0.24, closed = false) => {
    const p = points.map(cam.project)
    out.push({ kind: 'lines', lines: { runs: [closed ? loop(p) : p], ink, width } })
  }
  const surfacePatch = (s: Surface, uv: Pt[], mat: Mat, edge: Ink = 'seam', width = 0.22) => {
    const cu = uv.reduce((n, p) => n + p[0] / uv.length, 0)
    const cv = uv.reduce((n, p) => n + p[1] / uv.length, 0)
    if (dot(normalAt(s, cu, cv), cam.V) < 0.08) return
    // Sample edges on the host surface: trim follows curvature rather than spanning a chord through the shell.
    const pts: V3[] = []
    for (let i = 0; i < uv.length; i++) {
      const a = uv[i],
        b = uv[(i + 1) % uv.length]
      for (let j = 0; j < 10; j++)
        pts.push(s.at(a[0] + ((b[0] - a[0]) * j) / 10, a[1] + ((b[1] - a[1]) * j) / 10))
    }
    fill(pts, mat, edge, width)
  }
  const flankLoop = (pts: Pt[], mat?: Mat, width = 0.25, ink: Ink = 'seam') => {
    const p = pts.map(([a, z]) => sideAt(a, z))
    if (mat) fill(p, mat, ink, width)
    else line(p, ink, width, true)
  }
  // A shut line is a dark gap with a lit lip on its trailing edge.
  const gapLoop = (pts: Pt[], width = 0.24) => {
    flankLoop(pts, undefined, width)
    flankLoop(
      pts.map(([a, z]): Pt => [a + 0.012, z - 0.011]),
      undefined,
      0.08,
      'faint',
    )
  }
  const canopyPatch = (uv: Pt[], mat: Mat, edge: Ink = 'seam', width = 0.22) =>
    surfacePatch(
      cabin,
      uv.map(([a, v]) => [cabinU(a), v]),
      mat,
      edge,
      width,
    )

  fill(
    [
      ...sample(40, (t) => at(t * LENGTH, -halfWidth(t * LENGTH) * 0.94, 0.012)),
      ...sample(40, (t) => at((1 - t) * LENGTH, halfWidth((1 - t) * LENGTH) * 0.94, 0.012)),
    ],
    'shadow',
  )
  out.push(...wheel(d, 0, -1), ...wheel(d, 1, -1))
  // A dark undertray is confined between axles; it never closes the side panels' wheel openings.
  fill(
    [at(1.47, -0.68, 0.23), at(2.96, -0.68, 0.23), at(2.96, 0.68, 0.23), at(1.47, 0.68, 0.23)],
    'rubber',
  )
  // Rear cap follows the skin's swept corner and sits behind the visible flank.
  const tail: Surface = {
    at: (u, v) => {
      const p = topAt(0, 1 - u)
      return [p[0], p[1], 0.24 + v * (p[2] - 0.24)]
    },
    u: 24,
    v: 8,
    closed: false,
    flip: true,
  }
  out.push(solid(tail, 'body', [], 0.3))
  out.push(
    solid(side(-1), 'body', [], 0.4),
    solid(top, 'body', [], 0.55),
    solid(side(1), 'body', [], 0.55),
  )
  // Rounded nose cap: joins the two upper and lower skin boundaries across the bumper.
  const nose: Surface = {
    at: (u, v) => {
      const p = topAt(LENGTH, 1 - u)
      return [p[0], p[1], 0.24 + v * (p[2] - 0.24)]
    },
    u: 24,
    v: 8,
    closed: false,
  }
  out.push(solid(nose, 'body', [], 0.4))
  // Paint line under the door terminates at the wheel openings.
  flankLoop(
    [
      [1.445, 0.265],
      [2.98, 0.265],
      [2.98, 0.3],
      [1.445, 0.3],
    ],
    'rubber',
    0.12,
  )
  // Member identity is confined to the rocker stripe and mirror caps.
  flankLoop(
    [
      [1.46, 0.315],
      [2.97, 0.315],
      [2.97, 0.375],
      [1.46, 0.375],
    ],
    'livery',
    0.12,
  )
  // Bonnet shut line: long tapered lid between the two raised front wings.
  const bonnet: Pt[] = [
    [2.96, 0.24],
    [3.18, 0.235],
    [3.94, 0.31],
    [4.06, 0.4],
    [4.06, 0.6],
    [3.94, 0.69],
    [3.18, 0.765],
    [2.96, 0.76],
  ]
  const bonnetPts: V3[] = []
  for (let i = 0; i < bonnet.length; i++) {
    const a = bonnet[i],
      b = bonnet[(i + 1) % bonnet.length]
    bonnetPts.push(...sample(10, (t) => topAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)))
  }
  line(bonnetPts, 'seam', 0.22, true)
  line(
    bonnetPts.map(([x, y, z]): V3 => [x - 0.012, y * 0.985, z + 0.004]),
    'faint',
    0.08,
    true,
  )
  // Centre crease down the lid, washer jets at the screen and a small crest on the nose.
  line(
    sample(24, (t) => topAt(3.12 + 0.82 * t, 0.5)),
    'faint',
    0.1,
  )
  for (const v of [0.4, 0.6]) {
    const p = topAt(3.0, v)
    fill(
      ellipse(0, 0, 0.011, 0.011, 8).map(([x, z]) => add(p, [x, z, 0.003])),
      'metal',
      'seam',
      0.08,
    )
  }
  // Fuel flap, handle pocket and door seal belong to the near side skin.
  flankLoop(ellipse(3.02, 0.745, 0.075, 0.06, 24), undefined, 0.17)
  flankLoop(ellipse(3.02, 0.745, 0.045, 0.036, 16), 'void', 0.1)
  flankLoop(ellipse(3.02, 0.745, 0.026, 0.021, 12), 'metal', 0.1)
  flankLoop(
    [
      [2.955, 0.76],
      [2.955, 0.73],
    ],
    undefined,
    0.2,
    'line',
  )
  gapLoop([
    [1.66, 0.77],
    [1.64, 0.43],
    [1.73, 0.325],
    [2.78, 0.325],
    [2.86, 0.4],
    [2.88, 0.76],
  ])
  // Belt trim: a thin bright strip along the window line, from the A-pillar foot to the quarter.
  flankLoop(
    [
      ...sample(14, (t) => [1.1 + 1.76 * t, belt(1.1 + 1.76 * t) - 0.005] as Pt),
      ...sample(14, (t) => [2.86 - 1.76 * t, belt(2.86 - 1.76 * t) - 0.026] as Pt),
    ],
    'metal',
    0.1,
  )
  // Door handle: dark pocket, flush bar with a lit top edge, and the lock barrel behind it.
  flankLoop(
    [
      [1.77, 0.664],
      [2.03, 0.664],
      [2.045, 0.716],
      [1.78, 0.716],
    ],
    'void',
    0.12,
  )
  flankLoop(
    [
      [1.79, 0.676],
      [2.0, 0.676],
      [2.01, 0.703],
      [1.8, 0.703],
    ],
    'body',
    0.12,
  )
  flankLoop(ellipse(2.075, 0.7, 0.014, 0.014, 10), 'metal', 0.1)
  // Front-wing repeater lamp and the sill's lower trim gap.
  flankLoop(
    [
      [3.76, 0.47],
      [3.83, 0.47],
      [3.83, 0.5],
      [3.76, 0.5],
    ],
    'glass',
    0.12,
  )
  flankLoop(
    [
      [1.64, 0.345],
      [2.8, 0.345],
    ],
    undefined,
    0.1,
    'faint',
  )
  // Bumper seams wrap the nose and tail on the actual curved skins.
  for (const [a0, a1, z] of [
    [3.78, LENGTH, 0.42],
    [0, 0.52, 0.43],
  ] as const) {
    line(
      sample(30, (t) => sideAt(a0 + (a1 - a0) * t, z)),
      'seam',
      0.22,
    )
  }
  line(
    sample(40, (t) => at(LENGTH - 0.14 * (2 * t - 1) ** 2, (2 * t - 1) * 0.5, 0.42)),
    'seam',
    0.22,
  )
  // Front intake, slats, number-plate plinth, and low fog lamp pockets.
  const nosePoint = (y: number, z: number) => at(LENGTH - 0.14 * (y / 0.5) ** 2 + 0.002, y, z)
  fill(
    [
      nosePoint(-0.29, 0.29),
      nosePoint(0.29, 0.29),
      nosePoint(0.29, 0.365),
      nosePoint(-0.29, 0.365),
    ],
    'void',
    'seam',
    0.25,
  )
  for (const z of [0.314, 0.34])
    line(
      sample(20, (t) => nosePoint(-0.28 + 0.56 * t, z)),
      'faint',
      0.13,
    )
  for (const y of [-0.14, 0, 0.14]) line([nosePoint(y, 0.29), nosePoint(y, 0.365)], 'faint', 0.1)
  // Chin splitter lip under the intake.
  fill(
    [
      nosePoint(-0.36, 0.262),
      nosePoint(0.36, 0.262),
      nosePoint(0.36, 0.288),
      nosePoint(-0.36, 0.288),
    ],
    'rubber',
    'seam',
    0.12,
  )
  // Indicator lenses above the fog lamps.
  for (const sg of [-1, 1])
    fill(
      [
        nosePoint(sg * 0.33, 0.373),
        nosePoint(sg * 0.47, 0.373),
        nosePoint(sg * 0.47, 0.408),
        nosePoint(sg * 0.33, 0.408),
      ],
      'glass',
      'seam',
      0.12,
    )
  for (const sg of [-1, 1]) {
    fill(
      [
        nosePoint(sg * 0.33, 0.29),
        nosePoint(sg * 0.46, 0.29),
        nosePoint(sg * 0.46, 0.365),
        nosePoint(sg * 0.33, 0.365),
      ],
      'rubber',
      'seam',
      0.18,
    )
    fill(
      [
        nosePoint(sg * 0.35, 0.303),
        nosePoint(sg * 0.44, 0.303),
        nosePoint(sg * 0.44, 0.35),
        nosePoint(sg * 0.35, 0.35),
      ],
      'metal',
      'faint',
      0.12,
    )
  }
  // Number-plate recess: a dark pocket with a blank, lit plate seated in it and two screws.
  fill(
    [nosePoint(-0.2, 0.366), nosePoint(0.2, 0.366), nosePoint(0.2, 0.412), nosePoint(-0.2, 0.412)],
    'rubber',
    'seam',
    0.15,
  )
  fill(
    [
      nosePoint(-0.185, 0.372),
      nosePoint(0.185, 0.372),
      nosePoint(0.185, 0.407),
      nosePoint(-0.185, 0.407),
    ],
    'body',
    'faint',
    0.1,
  )
  for (const y of [-0.16, 0.16])
    fill(
      ellipse(0, 0, 0.007, 0.007, 8).map(([a, b]) => nosePoint(y + a, 0.389 + b * 0.8)),
      'metal',
      'seam',
      0.06,
    )
  // Cabin is a single curved roof, not a second rectangular volume.
  out.push(solid(cabin, 'body', [], 0.45))
  const quarter: Pt[] = [
    [1.02, 0.03],
    [1.63, 0.03],
    [1.63, 0.27],
    [1.45, 0.26],
    [1.2, 0.16],
  ]
  const door: Pt[] = [
    [1.73, 0.03],
    [2.69, 0.03],
    [2.47, 0.28],
    [2.25, 0.32],
    [1.73, 0.32],
  ]
  // Far glass first; roof gutters continue from the screen seals to the rear-window seal.
  for (const sg of [-1, 1]) {
    for (const shape of [quarter, door]) {
      const uv = shape.map(([a, v]): Pt => [a, sg === 1 ? v : 1 - v])
      canopyPatch(uv, 'rubber', 'seam', 0.32)
      const ca = uv.reduce((n, p) => n + p[0] / uv.length, 0),
        cv = uv.reduce((n, p) => n + p[1] / uv.length, 0)
      canopyPatch(
        uv.map(([a, v]) => [ca + (a - ca) * 0.94, cv + (v - cv) * 0.86]),
        'glass',
        'faint',
        0.12,
      )
    }
  }
  // Front and rear screens taper with the cabin surface. An inset second loop leaves a physical rubber seal.
  for (const [a0, a1, v0, v1] of [
    [2.5, 2.89, 0.19, 0.81],
    [0.8, 1.4, 0.23, 0.77],
  ]) {
    canopyPatch(
      [
        [a0, v0],
        [a1, v0 + 0.025],
        [a1, v1 - 0.025],
        [a0, v1],
      ],
      'rubber',
      'seam',
      0.26,
    )
    canopyPatch(
      [
        [a0 + 0.025, v0 + 0.025],
        [a1 - 0.025, v0 + 0.05],
        [a1 - 0.025, v1 - 0.05],
        [a0 + 0.025, v1 - 0.025],
      ],
      'glass',
      'faint',
      0.14,
    )
  }
  // Side-pane reflection bands: a broad streak and a thin one, both clear of the seals.
  for (const band of [
    [
      [1.96, 0.075],
      [2.05, 0.075],
      [2.27, 0.285],
      [2.19, 0.285],
    ],
    [
      [2.09, 0.075],
      [2.12, 0.075],
      [2.31, 0.265],
      [2.28, 0.265],
    ],
    [
      [1.4, 0.06],
      [1.47, 0.06],
      [1.57, 0.225],
      [1.5, 0.225],
    ],
  ] as Pt[][])
    canopyPatch(band, 'metal', 'faint', 0.05)
  // Rear screen: demister element lines end on the seal's inner edge.
  for (let i = 0; i < 6; i++) {
    const v = 0.33 + i * 0.068
    line(
      sample(10, (t) => cabinAt(0.9 + 0.43 * t, v)),
      'faint',
      0.07,
    )
  }
  // Reflections are surface-bound closed shapes, muted to the same neutral metal ramp as the other vehicles.
  canopyPatch(
    [
      [2.58, 0.28],
      [2.64, 0.29],
      [2.85, 0.43],
      [2.85, 0.47],
    ],
    'metal',
    'faint',
    0.1,
  )
  // Rain channels are continuous between screen boundaries; no floating texture strokes.
  for (const v of [0.345, 0.655])
    line(
      sample(35, (t) => cabinAt(1.4 + 1.1 * t, v)),
      'faint',
      0.15,
    )
  // Each wiper arm meets the middle of its blade; the pivots sit on the screen's lower seal.
  for (const v of [0.36, 0.61]) {
    line([cabinAt(2.87, v + 0.025), cabinAt(2.8, v - 0.03)], 'line', 0.22)
    line([cabinAt(2.8, v - 0.12), cabinAt(2.8, v - 0.03), cabinAt(2.8, v + 0.06)], 'line', 0.34)
    const pivot = cabinAt(2.87, v + 0.025)
    fill(
      ellipse(0, 0, 0.012, 0.012, 8).map(([x, z]) => add(pivot, [x, 0, z + 0.008])),
      'metal',
      'seam',
      0.08,
    )
  }
  // Aerial: a short mast on the rear deck's near shoulder, rubber boot and tip bead; it stands against the sky.
  {
    const base = cabinAt(0.7, 0.1)
    line([base, add(base, [-0.09, 0, 0.34])], 'line', 0.2)
    fill(
      ellipse(0, 0, 0.016, 0.016, 8).map(([x, z]) => add(base, [x, z, 0.004])),
      'rubber',
      'seam',
      0.1,
    )
    fill(
      ellipse(0, 0, 0.01, 0.01, 8).map(([x, z]) => add(base, [-0.09 + x, z, 0.34])),
      'metal',
      'seam',
      0.08,
    )
  }
  // Engine lid: shut line, a dark recess and a bank of lit louvre slats on it.
  line(
    [
      ...sample(8, (t) => cabinAt(0.57 + 0.3 * t, 0.17)),
      ...sample(8, (t) => cabinAt(0.87, 0.17 + 0.66 * t)),
      ...sample(8, (t) => cabinAt(0.87 - 0.3 * t, 0.83)),
      ...sample(8, (t) => cabinAt(0.57, 0.83 - 0.66 * t)),
    ],
    'seam',
    0.18,
    true,
  )
  canopyPatch(
    [
      [0.585, 0.27],
      [0.835, 0.27],
      [0.835, 0.73],
      [0.585, 0.73],
    ],
    'void',
    'seam',
    0.12,
  )
  for (let i = 0; i < 8; i++) {
    const a = 0.6 + i * 0.03
    canopyPatch(
      [
        [a, 0.285],
        [a + 0.017, 0.285],
        [a + 0.017, 0.715],
        [a, 0.715],
      ],
      'body',
      'faint',
      0.08,
    )
  }
  // Near mirror: stalk, rounded painted housing, and a separate mirror face. The far shell is partly hidden by cabin.
  for (const sg of [-1, 1]) {
    const c = at(2.64, sg * 0.82, 0.87)
    const F = G.frameAlong(at(2.63, sg * 0.69, 0.82), [0, sg * 0.9, 0.44])
    out.push(kitSolid(G.disc(0, 0.14, 0.028, F, P, { steps: 16 }), 'rubber', [], 0.2))
    // Sail pad where the arm meets the door, and a collar where it enters the housing.
    out.push(kitSolid(G.disc(-0.006, 0.01, 0.045, F, P, { steps: 16 }), 'rubber', [], 0.16))
    out.push(kitSolid(G.disc(0.1, 0.14, 0.036, F, P, { steps: 16 }), 'metal', [], 0.14))
    const shell: Surface = {
      at: (u, v) => {
        const t = 2 * Math.PI * v,
          lat = Math.PI * (u - 0.5)
        return add(c, [
          0.115 * Math.cos(lat) * Math.cos(t),
          0.072 * Math.cos(lat) * Math.sin(t),
          0.055 * Math.sin(lat),
        ])
      },
      u: 24,
      v: 36,
      closed: true,
      flip: true,
    }
    out.push(solid(shell, 'livery', [], 0.3))
    if (sg === 1)
      fill(
        ellipse(0, 0, 0.077, 0.032, 24).map(([x, z]) => add(c, [x, 0.06, z])),
        'glass',
        'seam',
        0.16,
      )
    if (sg === 1)
      fill(
        ellipse(-0.02, 0, 0.04, 0.012, 12).map(([x, z]) => add(c, [x, 0.061, z + 0.012])),
        'metal',
        'faint',
        0.05,
      )
  }
  // Tail light strip wraps the rear quarter; twin exhaust outlets end on a dark bore.
  // Tail lamp: dark bezel, three lens segments split by ribs, a lit reflector rail and a reversing lens.
  flankLoop(
    [
      [0.07, 0.492],
      [0.43, 0.504],
      [0.43, 0.574],
      [0.07, 0.568],
    ],
    'rubber',
    0.16,
  )
  flankLoop(
    [
      [0.085, 0.5],
      [0.415, 0.511],
      [0.415, 0.565],
      [0.085, 0.56],
    ],
    'glass',
    0.12,
  )
  for (const a of [0.19, 0.3])
    flankLoop(
      [
        [a, 0.502],
        [a, 0.563],
      ],
      undefined,
      0.14,
    )
  flankLoop(
    [
      [0.09, 0.514],
      [0.41, 0.522],
      [0.41, 0.53],
      [0.09, 0.522],
    ],
    'metal',
    0.06,
    'faint',
  )
  flankLoop(
    [
      [0.32, 0.535],
      [0.405, 0.538],
      [0.405, 0.558],
      [0.32, 0.555],
    ],
    'body',
    0.08,
    'faint',
  )
  for (const y of [0.33, 0.43]) {
    const F = G.frameAlong(at(0.16, y, 0.245), [-1, 0, 0])
    out.push(kitSolid(G.ringBand(0, 0.12, 0.025, 0.036, F, P, { steps: 24 }), 'metal', [], 0.2))
    out.push({
      kind: 'fill',
      rings: ringsOfPath(G.circleOf(F, 0.12, 0.025, P)),
      mat: 'void',
      edge: 'seam',
      width: 0.12,
    })
    out.push({
      kind: 'lines',
      lines: { runs: ringsOfPath(G.circleOf(F, 0.118, 0.014, P)), ink: 'faint', width: 0.08 },
    })
  }
  // Raised headlamp bowls face forward and upward, rather than lying on the wing's inward slope.
  for (const sg of [-1, 1]) {
    const F = G.frameAlong(at(3.84, sg * 0.66, 0.735), [0.55, sg * 0.1, 0.83])
    out.push(
      kitSolid(
        G.solidOf(
          [
            [-0.035, 0.08],
            [-0.02, 0.12],
            [0, 0.13],
          ],
          F,
          P,
          { steps: 40 },
        ),
        'body',
        [],
        0.2,
      ),
    )
    out.push(kitSolid(G.disc(0, 0.009, 0.126, F, P, { steps: 40 }), 'rubber', [], 0.22))
    out.push(kitSolid(G.disc(0.009, 0.015, 0.115, F, P, { steps: 40 }), 'metal', [], 0.2))
    out.push(kitSolid(G.disc(0.015, 0.018, 0.097, F, P, { steps: 40 }), 'body', [], 0.16))
    out.push({
      kind: 'lines',
      lines: { runs: ringsOfPath(G.circleOf(F, 0.019, 0.072, P)), ink: 'faint', width: 0.12 },
    })
    // Reflector bowl, bulb and a faint inner lens ring.
    out.push(kitSolid(G.disc(0.018, 0.021, 0.056, F, P, { steps: 32 }), 'metal', [], 0.14))
    out.push(kitSolid(G.disc(0.021, 0.024, 0.021, F, P, { steps: 20 }), 'glass', [], 0.12))
    out.push({
      kind: 'lines',
      lines: { runs: ringsOfPath(G.circleOf(F, 0.0215, 0.038, P)), ink: 'faint', width: 0.08 },
    })
  }
  // Near wheels are smaller than the arch opening, so no tyre is painted across the fender lip.
  out.push(...wheel(d, 0, 1), ...wheel(d, 1, 1))
  for (const axle of AXLES) {
    line(
      sample(48, (t) => {
        const th = Math.PI * (1 - t)
        const r = ARCH_R - 0.022
        return sideAt(axle + r * Math.cos(th), 0.24 + (TYRE_R + r - 0.24) * Math.sin(th))
      }),
      'faint',
      0.1,
    )
    line(
      sample(48, (t) => {
        const th = Math.PI * (1 - t)
        return sideAt(axle + ARCH_R * Math.cos(th), 0.24 + (TYRE_R + ARCH_R - 0.24) * Math.sin(th))
      }),
      'seam',
      0.24,
    )
  }
  return out
}

export async function buildCar(unit = 112) {
  const kit = await loadKit()
  // Derive the kit camera from the road's actual projection. LaneScene's rotated iso basis differs from the air
  // camera: inheriting it keeps tyre contacts, road skew and the existing car scale aligned.
  const { cam, draw, place } = laneCamera(kit, unit / LENGTH)
  const items = coupe(draw)
  const built = serialize(items, place, 1)
  return {
    ...built,
    d: { key: 'road', title: 'A detailed coupé' },
    gear: place(cam.project([0, TRACK[0] / 2 + TYRE_W[0] / 2, 0]))[1],
  }
}
