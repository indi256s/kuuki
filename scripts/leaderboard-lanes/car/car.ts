// Build-time coupe artwork. Shares the airliner's pinned anatomy kit, material ramps and SVG serializer.
import { drawing, ringsOfPath, type Draw } from '../airliner/draw'
import { LaneScene, W } from '../../../apps/next/src/client/leaderboard/lanes/draw/lane-scene'
import { loadKit } from '../airliner/kit'
import type { Ink, Item, Mat } from '../airliner/model'
import { serialize } from '../airliner/svg'
import {
  add,
  dot,
  normalAt,
  type Camera,
  type Pt,
  type Surface,
  type V3,
} from '../airliner/surface'
import {
  ARCH_R,
  AXLES,
  LENGTH,
  TRACK,
  TYRE_R,
  TYRE_W,
  at,
  cabin,
  cabinAt,
  cabinU,
  halfWidth,
  side,
  sideAt,
  top,
  topAt,
} from './model'

const sample = (n: number, f: (t: number) => V3) =>
  Array.from({ length: n + 1 }, (_, i) => f(i / n))
const loop = (p: Pt[]) => [...p, p[0]]
const ellipse = (a: number, b: number, ra: number, rb: number, n = 40): Pt[] =>
  Array.from({ length: n }, (_, i) => [
    a + ra * Math.cos((i * 2 * Math.PI) / n),
    b + rb * Math.sin((i * 2 * Math.PI) / n),
  ])
const rectangle = (a: number, b: number, w: number, h: number): Pt[] => [
  [a, b],
  [a + w, b],
  [a + w, b + h],
  [a, b + h],
]

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
  out.push(
    fill(
      rectangle(-R * 0.47, -R * 0.19, R * 0.18, R * 0.38).map(([x, z]) =>
        point(x, z, outer + 0.009),
      ),
      'rubber',
      'faint',
      0.12,
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
  }

  out.push(
    kitSolid(G.disc(outer + 0.021, outer + 0.028, R * 0.18, F, P, { steps: 24 }), 'metal', [], 0.2),
  )
  for (let i = 0; i < 5; i++) {
    const t = (2 * Math.PI * i) / 5 + 0.45
    out.push(
      fill(
        ellipse(R * 0.235 * Math.cos(t), R * 0.235 * Math.sin(t), 0.013, 0.013, 10).map(([x, z]) =>
          point(x, z, outer + 0.024),
        ),
        'void',
      ),
    )
  }
  out.push({
    kind: 'lines',
    lines: {
      runs: ringsOfPath(G.circleOf(F, outer + 0.002, R * 0.84, P)),
      ink: 'faint',
      width: 0.14,
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
  const flankLoop = (pts: Pt[], mat?: Mat, width = 0.25) => {
    const p = pts.map(([a, z]) => sideAt(a, z))
    if (mat) fill(p, mat, 'seam', width)
    else line(p, 'seam', width, true)
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
  // Fuel flap, handle pocket and door seal belong to the near side skin.
  flankLoop(ellipse(3.02, 0.745, 0.075, 0.06, 24), undefined, 0.17)
  flankLoop(
    [
      [1.66, 0.77],
      [1.64, 0.43],
      [1.73, 0.325],
      [2.78, 0.325],
      [2.86, 0.4],
      [2.88, 0.76],
    ],
    undefined,
    0.24,
  )
  flankLoop(
    [
      [1.79, 0.69],
      [1.99, 0.69],
      [2.01, 0.723],
      [1.8, 0.723],
    ],
    'void',
    0.12,
  )
  flankLoop(
    [
      [1.8, 0.716],
      [1.98, 0.716],
      [1.98, 0.74],
      [1.8, 0.74],
    ],
    'metal',
    0.14,
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
  fill(
    [
      nosePoint(-0.16, 0.365),
      nosePoint(0.16, 0.365),
      nosePoint(0.16, 0.405),
      nosePoint(-0.16, 0.405),
    ],
    'body',
    'seam',
    0.15,
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
    line([cabinAt(2.8, v - 0.12), cabinAt(2.8, v - 0.03), cabinAt(2.8, v + 0.06)], 'line', 0.26)
  }
  // Engine lid follows the rear slope; eight real closed cooling slots.
  for (let i = 0; i < 8; i++) {
    const a = 0.59 + i * 0.028
    canopyPatch(
      [
        [a, 0.34],
        [a + 0.012, 0.34],
        [a + 0.012, 0.66],
        [a, 0.66],
      ],
      'void',
      'faint',
      0.1,
    )
  }
  // Near mirror: stalk, rounded painted housing, and a separate mirror face. The far shell is partly hidden by cabin.
  for (const sg of [-1, 1]) {
    const c = at(2.64, sg * 0.82, 0.87)
    const F = G.frameAlong(at(2.63, sg * 0.69, 0.82), [0, sg * 0.9, 0.44])
    out.push(kitSolid(G.disc(0, 0.14, 0.028, F, P, { steps: 16 }), 'rubber', [], 0.2))
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
  }
  // Tail light strip wraps the rear quarter; twin exhaust outlets end on a dark bore.
  flankLoop(
    [
      [0.08, 0.5],
      [0.42, 0.51],
      [0.42, 0.566],
      [0.08, 0.56],
    ],
    'glass',
    0.2,
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
  }
  // Near wheels are smaller than the arch opening, so no tyre is painted across the fender lip.
  out.push(...wheel(d, 0, 1), ...wheel(d, 1, 1))
  for (const axle of AXLES) {
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
  const zoom = 4
  // Derive the kit camera from the road's actual projection. LaneScene's rotated iso basis differs from the air
  // camera: inheriting it keeps tyre contacts, road skew and the existing car scale aligned.
  const scene = new LaneScene((unit / LENGTH) * zoom)
  const px = scene.project(W([1, 0, 0])),
    py = scene.project(W([0, 1, 0])),
    pz = scene.project(W([0, 0, 1]))
  const P = {
    ...kit.P,
    azimuth: (Math.atan2(px[0], -py[0]) * 180) / Math.PI,
    elevation: (Math.atan2(Math.hypot(px[1], py[1]), -pz[1]) * 180) / Math.PI,
    scale: Math.hypot(px[0], py[0]) / Math.sqrt(1.6),
  }
  const cam: Camera = {
    ...kit.cam,
    project: (p: V3) => kit.k.iso(p, P) as Pt,
    V: kit.G.viewOf(P),
    L: kit.G.lightOf(P),
  }
  const items = coupe(drawing(cam, { G: kit.G, P }))
  const place = ([x, y]: Pt): Pt => [x / zoom, (y - scene.slope() * x) / zoom]
  const built = serialize(items, place, 1)
  return {
    ...built,
    d: { key: 'road', title: 'A detailed coupé' },
    gear: place(cam.project([0, TRACK[0] / 2 + TYRE_W[0] / 2, 0]))[1],
  }
}
