// Build-time sailing-yacht artwork for the "By sea" way. Same pinned anatomy kit, surface renderer, materials and
// serializer as the car and the airliners; the camera is the car's (derived from LaneScene), so the waterline sits on
// the lane's level ground. Sails are their own light ramp (--ays*), which stays bright in dark; everything else is the
// shared `--a*` ramps, and the one accent is the boot stripe (--lane-livery), echoed by the masthead burgee.
import { roundedUV, type Draw } from '../airliner/draw'
import { loadKit } from '../airliner/kit'
import { laneCamera } from '../lane-camera'
import type { Ink, Item, Mat } from '../airliner/model'
import { serialize, type Box } from '../airliner/svg'
import { dot, lerp, normalAt, sub, len, type Pt, type Surface, type V3 } from '../airliner/surface'
import {
  BOOM,
  CAB0,
  CAB1,
  JIB,
  LOA,
  MAST,
  STEM,
  FORESTAY_TOP,
  at,
  boomAt,
  cabin,
  cabinAt,
  cabinU,
  deck,
  deckZ,
  hb,
  hood,
  hoodU,
  hw,
  jibAt,
  jibSail,
  mainAt,
  mainSail,
  roofH,
  side,
  sideAt,
  zs,
} from './model'

type Tag = 'sail' | 'water' | 'foam'
type Piece = { item: Item; tag?: Tag }

const sample = (n: number, f: (t: number) => V3) =>
  Array.from({ length: n + 1 }, (_, i) => f(i / n))
const ellipse = (a: number, b: number, ra: number, rb: number, n = 28): Pt[] =>
  Array.from({ length: n }, (_, i) => [
    a + ra * Math.cos((i * 2 * Math.PI) / n),
    b + rb * Math.sin((i * 2 * Math.PI) / n),
  ])
/** Gives a surface the side that faces `hint`. */
const facing = (s: Surface, hint: V3, u = 0.5, v = 0.5): Surface => ({
  ...s,
  flip: dot(normalAt({ ...s, flip: false }, u, v), hint) < 0,
})

export function yacht(d: Draw): Piece[] {
  const { cam, solid, kitSolid, G, P, seam } = d
  const out: Piece[] = []
  const push = (item: Item, tag?: Tag) => out.push({ item, tag })
  const proj = cam.project
  const fill = (pts: V3[], mat: Mat | 'shadow', edge?: Ink, width = 0.22, tag?: Tag) =>
    push({ kind: 'fill', rings: [pts.map(proj)], mat, edge, width }, tag)
  const line = (pts: V3[], ink: Ink = 'seam', width = 0.24, closed = false) => {
    const p = pts.map(proj)
    push({ kind: 'lines', lines: { runs: [closed ? [...p, p[0]] : p], ink, width } })
  }
  const part = (
    s: Surface,
    mat: Mat,
    inner = [] as ReturnType<typeof seam>[],
    edge = 0.3,
    tag?: Tag,
  ) => push(solid(s, mat, inner, edge), tag)

  // ---- primitives
  const quad = (p0: V3, p1: V3, p2: V3, p3: V3, out: V3, flip = false): Surface =>
    facing(
      {
        at: (u, v) => [
          (1 - u) * (1 - v) * p0[0] + u * (1 - v) * p1[0] + u * v * p2[0] + (1 - u) * v * p3[0],
          (1 - u) * (1 - v) * p0[1] + u * (1 - v) * p1[1] + u * v * p2[1] + (1 - u) * v * p3[1],
          (1 - u) * (1 - v) * p0[2] + u * (1 - v) * p1[2] + u * v * p2[2] + (1 - u) * v * p3[2],
        ],
        u: 1,
        v: 1,
        closed: false,
        flip,
      },
      out,
    )
  /** An axis-aligned block in boat coordinates; only the faces the camera can see are drawn. */
  const box = (
    a0: number,
    a1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    mat: Mat,
    topMat: Mat = mat,
    edge = 0.3,
  ) => {
    const c = at
    const faces: [V3[], V3, Mat][] = [
      [[c(a0, y1, z0), c(a1, y1, z0), c(a1, y1, z1), c(a0, y1, z1)], [0, 1, 0], mat],
      [[c(a1, y0, z0), c(a1, y1, z0), c(a1, y1, z1), c(a1, y0, z1)], [1, 0, 0], mat],
      [[c(a0, y0, z1), c(a1, y0, z1), c(a1, y1, z1), c(a0, y1, z1)], [0, 0, 1], topMat],
      [[c(a0, y0, z0), c(a1, y0, z0), c(a1, y0, z1), c(a0, y0, z1)], [0, -1, 0], mat],
    ]
    for (const [p, o, m] of faces)
      if (dot(o, cam.V) > 0.02) push(solid(quad(p[0], p[1], p[2], p[3], o), m, [], edge))
  }
  /** A band between two polylines, over a run of stations. */
  const ribbon = (
    f: (a: number) => [V3, V3],
    a0: number,
    a1: number,
    hint: V3,
    mat: Mat,
    edge = 0.2,
    n = 60,
  ) =>
    part(
      facing(
        {
          at: (u, v) => {
            const [p, q] = f(a0 + (a1 - a0) * u)
            return lerp(p, q, v)
          },
          u: n,
          v: 1,
          closed: false,
        },
        hint,
      ),
      mat,
      [],
      edge,
    )
  const tube = (p0: V3, p1: V3, r: number, mat: Mat, edge = 0.22, steps = 16) => {
    const F = G.frameAlong(p0, sub(p1, p0))
    push(
      kitSolid(
        G.solidOf(
          [
            [0, r],
            [len(sub(p1, p0)), r],
          ],
          F,
          P,
          { steps },
        ),
        mat,
        [],
        edge,
      ),
    )
  }
  const onSurface = (
    s: Surface,
    uv: Pt[],
    mat: Mat,
    edge: Ink = 'seam',
    width = 0.2,
    tag?: Tag,
  ) => {
    const cu = uv.reduce((n, p) => n + p[0] / uv.length, 0),
      cv = uv.reduce((n, p) => n + p[1] / uv.length, 0)
    if (dot(normalAt(s, cu, cv), cam.V) < 0.08) return
    const pts: V3[] = []
    for (let i = 0; i < uv.length; i++) {
      const a = uv[i],
        b = uv[(i + 1) % uv.length]
      for (let j = 0; j < 4; j++)
        pts.push(s.at(a[0] + ((b[0] - a[0]) * j) / 4, a[1] + ((b[1] - a[1]) * j) / 4))
    }
    fill(pts, mat, edge, width, tag)
  }
  /** A flat shape lying on the deck: points in (a, y). */
  const onDeck = (pts: Pt[], mat: Mat, edge: Ink = 'seam', width = 0.2, lift = 0.012) =>
    fill(
      pts.map(([a, y]) => at(a, y, deckZ(a, y) + lift)),
      mat,
      edge,
      width,
    )
  const hullSide = side(1)
  const hullPatch = (
    a0: number,
    a1: number,
    t0: number,
    t1: number,
    mat: Mat,
    edge: Ink = 'seam',
  ) => {
    const pts: V3[] = [
      ...sample(70, (t) => sideAt(a0 + (a1 - a0) * t, t0, 1)),
      ...sample(70, (t) => sideAt(a1 - (a1 - a0) * t, t1, 1)),
    ]
    fill(pts, mat, edge, 0.16)
  }
  const hullLoop = (uv: Pt[], mat: Mat, edge: Ink = 'seam', width = 0.18) =>
    onSurface(
      hullSide,
      uv.map(([a, t]) => [a / LOA, t]),
      mat,
      edge,
      width,
    )

  const stanchionAs = [1.0, 2.3, 3.5, 4.7, 5.9, 7.1, 8.3, 9.1]
  const edgeY = (a: number, sg: number) => sg * (hb(a) - 0.07)
  const railZ = 0.62
  const cockpit = { a0: 0.9, a1: 3.45 }

  // ============================================================== water cue under everything
  {
    const ring = (sg: number, grow: number) =>
      sample(60, (t) => {
        const a = 0.05 + t * (LOA - 0.7)
        const p = sideAt(a, 0, sg)
        return [p[0], p[1] + sg * grow, 0.0] as V3
      })
    const tip = sideAt(LOA, 0, 1)
    fill(
      [
        ...ring(-1, 0.22),
        at(LOA - 0.45, 0, 0.0),
        [tip[0] + 0.22, 0, 0],
        ...ring(1, 0.22).reverse(),
        at(-0.5, 0.6, 0),
        at(-0.5, -0.6, 0),
      ],
      'glass',
      undefined,
      0.2,
      'foam',
    )
    fill([...ring(-1, 0.1), [tip[0] + 0.1, 0, 0], ...ring(1, 0.1).reverse()], 'shadow')
  }

  // ============================================================== stern: swim platform and ladder
  box(-0.42, 0.28, -0.82, 0.82, 0.19, 0.26, 'metal', 'metal', 0.22)
  for (const y of [-0.55, -0.28, 0, 0.28, 0.55])
    line([at(-0.4, y, 0.262), at(0.26, y, 0.262)], 'faint', 0.12)
  // The ladder is folded up against the transom, rails ending on the platform edge and on the top bracket.
  for (const y of [0.5, 0.74]) {
    line([at(-0.07, y, 0.27), at(-0.07, y, 0.84)], 'line', 0.34)
  }
  for (const z of [0.4, 0.56, 0.72]) line([at(-0.07, 0.5, z), at(-0.07, 0.74, z)], 'seam', 0.28)

  // ============================================================== deck (far side first)
  part(deck, 'metal', [], 0.4)
  // Deck non-skid panels: closed shapes lying on the deck.
  onDeck(
    [
      [0.7, -1.15],
      [3.45, -1.15],
      [3.45, -1.0],
      [0.7, -1.0],
    ],
    'rubber',
    'faint',
    0.1,
  )
  // Toe rail along both sheers (far first; the near one comes after the near hull).
  const toe = (sg: number) => {
    const f = (a: number): [V3, V3] => {
      const p = sideAt(a, 1, sg)
      return [p, [p[0], p[1] - sg * 0.025, p[2] + 0.09]]
    }
    ribbon(f, 0.05, LOA - 0.12, [0, sg, 0], 'metal', 0.18, 70)
    ribbon(
      (a) => {
        const p = sideAt(a, 1, sg)
        return [
          [p[0], p[1] - sg * 0.025, p[2] + 0.09],
          [p[0], p[1] - sg * 0.085, p[2] + 0.09],
        ]
      },
      0.05,
      LOA - 0.12,
      [0, 0, 1],
      'metal',
      0.14,
      70,
    )
  }
  toe(-1)

  const stanchion = (a: number, sg: number) => {
    const y = edgeY(a, sg),
      z = deckZ(a, y)
    line([at(a, y, z), at(a, y, z + railZ)], 'line', 0.3)
    fill(
      ellipse(a, y, 0.045, 0.045, 10).map(([x, yy]) => at(x, yy, z + 0.008)),
      'metal',
      'seam',
      0.1,
    )
  }
  const lifelines = (sg: number) => {
    for (const k of [railZ, railZ * 0.5])
      line(
        stanchionAs.map((a) => at(a, edgeY(a, sg), deckZ(a, edgeY(a, sg)) + k)),
        'faint',
        0.2,
      )
  }
  for (const a of stanchionAs) stanchion(a, -1)
  lifelines(-1)

  // Chainplates and the far shrouds run behind the mast and sails.
  const chain = [5.8, 6.15, 6.5]
  const chainpoint = (a: number, sg: number): V3 => {
    const y = sg * (hb(a) - 0.09)
    return at(a, y, deckZ(a, y) + 0.04)
  }
  const chainTab = (a: number, sg: number) => {
    const y = sg * (hb(a) - 0.09),
      z = deckZ(a, y)
    fill(
      [
        at(a - 0.03, y, z + 0.01),
        at(a + 0.03, y, z + 0.01),
        at(a + 0.03, y - sg * 0.12, z + 0.01),
        at(a - 0.03, y - sg * 0.12, z + 0.01),
      ],
      'metal',
      'seam',
      0.1,
    )
  }
  const LOW_SPREADER = 4.6,
    UP_SPREADER = 8.4
  const spreaderTip = (z: number, sg: number): V3 => [
    at(MAST.a, 0, 0)[0] + 0.2,
    sg * (z === LOW_SPREADER ? 0.88 : 0.64),
    z,
  ]
  const shrouds = (sg: number) => {
    const mastAt = (z: number, off = 0): V3 => [at(MAST.a, 0, 0)[0] + off, 0, z]
    // Cap shroud: masthead, over both spreader tips, to the aft chainplate.
    line(
      [
        mastAt(12.5, 0.01),
        spreaderTip(UP_SPREADER, sg),
        spreaderTip(LOW_SPREADER, sg),
        chainpoint(chain[2], sg),
      ],
      'faint',
      0.24,
    )
    // Intermediate: from just above the upper spreader, to the lower tip, to the middle chainplate.
    line([mastAt(8.7, 0.01), spreaderTip(LOW_SPREADER, sg), chainpoint(chain[1], sg)], 'faint', 0.2)
    // Lower: from below the lower spreader to the forward chainplate.
    line([mastAt(4.3, 0.01), chainpoint(chain[0], sg)], 'faint', 0.22)
  }
  for (const a of chain) chainTab(a, -1)
  shrouds(-1)
  for (const z of [LOW_SPREADER, UP_SPREADER]) {
    const tip = spreaderTip(z, -1)
    line([[at(MAST.a, 0, 0)[0] - 0.02, 0, z], tip], 'line', 0.34)
  }

  // ============================================================== foredeck
  // Hatch, anchor on its roller, cleats.
  onDeck(
    [
      [8.72, -0.27],
      [9.38, -0.27],
      [9.38, 0.27],
      [8.72, 0.27],
    ],
    'rubber',
    'seam',
    0.2,
    0.03,
  )
  onDeck(
    [
      [8.78, -0.21],
      [9.32, -0.21],
      [9.32, 0.21],
      [8.78, 0.21],
    ],
    'glass',
    'faint',
    0.12,
    0.034,
  )
  line([at(8.75, -0.27, deckZ(8.75, 0) + 0.05), at(8.75, 0.27, deckZ(8.75, 0) + 0.05)], 'seam', 0.2)
  const cleat = (a: number, y: number) => {
    onDeck(
      [
        [a - 0.1, y - 0.025],
        [a + 0.1, y - 0.025],
        [a + 0.1, y + 0.025],
        [a - 0.1, y + 0.025],
      ],
      'metal',
      'seam',
      0.14,
      0.04,
    )
    onDeck(ellipse(a, y, 0.045, 0.045, 10), 'metal', 'seam', 0.12, 0.014)
  }
  cleat(9.7, 0.3)
  cleat(9.7, -0.3)
  cleat(3.9, 1.5)
  cleat(3.9, -1.5)
  cleat(0.9, 1.2)
  cleat(0.9, -1.2)
  // Stem head fitting and anchor roller, with a plough anchor lying in it.
  box(10.2, 11.12, -0.05, 0.05, deckZ(10.4, 0) - 0.02, deckZ(10.4, 0) + 0.06, 'metal', 'metal', 0.2)
  {
    const z = deckZ(10.6, 0) + 0.075
    fill(
      [at(9.7, -0.025, z), at(10.95, -0.025, z), at(10.95, 0.025, z), at(9.7, 0.025, z)],
      'metal',
      'seam',
      0.12,
    )
    fill(
      [at(10.95, 0, z), at(10.55, -0.17, z), at(10.45, 0, z), at(10.55, 0.17, z)],
      'metal',
      'seam',
      0.16,
    )
    line([at(10.95, 0, z), at(10.6, 0, z)], 'faint', 0.1)
  }

  // ============================================================== cockpit
  {
    const { a0, a1 } = cockpit
    const soleZ = 0.54
    fill(
      [at(a0, -0.52, soleZ), at(a1, -0.52, soleZ), at(a1, 0.52, soleZ), at(a0, 0.52, soleZ)],
      'metal',
      'seam',
      0.2,
    )
    for (let a = a0 + 0.22; a < a1; a += 0.22)
      line([at(a, -0.5, soleZ + 0.004), at(a, 0.5, soleZ + 0.004)], 'faint', 0.1)
    // Stern seat across the transom, the bridge deck step at the companionway.
    box(0.55, a0 + 0.05, -1.26, 1.26, 0.5, 0.96, 'body', 'metal', 0.28)
    // Far seat and far coaming.
    box(a0, a1, -1.12, -0.52, 0.54, 0.9, 'body', 'metal', 0.26)
    box(a0 - 0.1, a1 + 0.05, -1.28, -1.12, 0.62, 1.2, 'body', 'metal', 0.28)
    // Locker lids on the seats.
    for (const sg of [-1, 1]) {
      for (const [x0, x1] of [
        [1.1, 1.9],
        [2.05, 3.2],
      ])
        onSurfaceBox(sg, x0, x1)
    }
    function onSurfaceBox(sg: number, x0: number, x1: number) {
      const zt = 0.9 + 0.002
      line(
        [
          at(x0, sg * 0.58, zt),
          at(x1, sg * 0.58, zt),
          at(x1, sg * 1.08, zt),
          at(x0, sg * 1.08, zt),
        ],
        'faint',
        0.12,
        true,
      )
    }
    // Pedestal and wheel, standing on the sole.
    const base: V3 = at(1.65, 0, soleZ)
    {
      const F = G.frameAlong(base, [0, 0, 1])
      push(
        kitSolid(
          G.solidOf(
            [
              [0, 0.17],
              [0.05, 0.15],
              [0.1, 0.11],
              [0.58, 0.095],
              [0.64, 0.115],
              [0.7, 0.115],
            ],
            F,
            P,
            { steps: 24 },
          ),
          'metal',
          [],
          0.24,
        ),
      )
      // Compass dome.
      push(kitSolid(G.disc(0, 0.04, 0.1, F, P, { steps: 20 }), 'rubber', [], 0.14))
    }
    const hub = at(1.62, 0, 1.3)
    const WF = G.frameAlong(hub, [1, 0, 0.18])
    push(kitSolid(G.ringBand(-0.02, 0.025, 0.325, 0.385, WF, P, { steps: 40 }), 'rubber', [], 0.3))
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3 + 0.3
      line([G.pointOf(WF, 0.004, 0.06, ang), G.pointOf(WF, 0.004, 0.335, ang)], 'line', 0.42)
    }
    push(kitSolid(G.disc(-0.03, 0.04, 0.075, WF, P, { steps: 20 }), 'metal', [], 0.22))
    // Near seat and near coaming; winches stand on the coaming cap.
    box(a0, a1, 0.52, 1.12, 0.54, 0.9, 'body', 'metal', 0.26)
    box(a0 - 0.1, a1 + 0.05, 1.12, 1.28, 0.62, 1.2, 'body', 'metal', 0.3)
    // A step across the companionway and the traveller track on the bridge deck.
    box(a1, a1 + 0.2, -1.0, 1.0, 0.7, 0.98, 'body', 'metal', 0.26)
  }

  // ============================================================== coachroof
  part(cabin, 'body', [], 0.5)
  // Cabin side windows: rubber frame, then glass inset, each an area on the roof skin.
  const roofPatch = (
    a: number,
    v: number,
    ha: number,
    hv: number,
    mat: Mat,
    edge: Ink,
    width: number,
    r = 0.4,
  ) =>
    onSurface(
      cabin,
      roundedUV(a, v, ha, hv, r, 4).map(([x, y]): Pt => [cabinU(x), y]),
      mat,
      edge,
      width,
    )
  for (const [a, ha] of [
    [4.55, 0.42],
    [5.45, 0.42],
    [6.35, 0.42],
  ] as const) {
    roofPatch(a, 0.17, ha + 0.045, 0.098, 'rubber', 'seam', 0.2)
    roofPatch(a, 0.17, ha, 0.075, 'glass', 'faint', 0.1)
  }
  // Raked forward lights where the roof slopes down to the foredeck.
  roofPatch(7.35, 0.2, 0.34, 0.1, 'rubber', 'seam', 0.2, 0.3)
  roofPatch(7.35, 0.2, 0.3, 0.075, 'glass', 'faint', 0.1, 0.3)
  // Windscreen across the cabin front.
  onSurface(
    cabin,
    [
      [7.1, 0.33],
      [7.9, 0.37],
      [7.9, 0.63],
      [7.1, 0.67],
    ].map(([a, v]): Pt => [cabinU(a), v]),
    'rubber',
    'seam',
    0.2,
  )
  onSurface(
    cabin,
    [
      [7.18, 0.36],
      [7.82, 0.39],
      [7.82, 0.61],
      [7.18, 0.64],
    ].map(([a, v]): Pt => [cabinU(a), v]),
    'glass',
    'faint',
    0.1,
  )
  // Roof hatches: a framed lid, an opening line, and the handle.
  roofPatch(5.55, 0.5, 0.36, 0.09, 'rubber', 'seam', 0.2, 0.25)
  roofPatch(5.55, 0.5, 0.31, 0.065, 'glass', 'faint', 0.1, 0.25)
  roofPatch(4.5, 0.5, 0.3, 0.07, 'metal', 'seam', 0.16, 0.25)
  for (const a of [4.28, 4.39, 4.5, 4.61, 4.72])
    line(
      sample(6, (t) => cabinAt(a, 0.46 + 0.08 * t)),
      'faint',
      0.1,
    )
  // Rain gutters and the cabin-top grab rails.
  for (const v of [0.31, 0.69])
    line(
      sample(40, (t) => cabinAt(CAB0 + 0.35 + (CAB1 - CAB0 - 1.6) * t, v)),
      'faint',
      0.12,
    )
  for (const v of [0.41, 0.59])
    line(
      sample(24, (t) => cabinAt(5.0 + 1.9 * t, v)),
      'seam',
      0.2,
    )
  // Sprayhood.
  part(hood, 'rubber', [], 0.4)
  const hoodPatch = (
    a: number,
    v: number,
    ha: number,
    hv: number,
    mat: Mat,
    edge: Ink,
    width: number,
  ) =>
    onSurface(
      hood,
      roundedUV(a, v, ha, hv, 0.3, 4).map(([x, y]): Pt => [hoodU(x), y]),
      mat,
      edge,
      width,
    )
  hoodPatch(4.15, 0.15, 0.4, 0.085, 'rubber', 'seam', 0.16)
  hoodPatch(4.15, 0.15, 0.34, 0.06, 'glass', 'faint', 0.1)
  onSurface(
    hood,
    [
      [3.95, 0.62],
      [4.62, 0.66],
      [4.62, 0.9],
      [3.95, 0.9],
    ].map(([a, v]): Pt => [hoodU(a), v]),
    'rubber',
    'seam',
    0.12,
  )
  // Hood zip line along the arch crown.
  line(
    sample(24, (t) => {
      const a = 3.64 + 1.06 * t
      return at(
        a,
        0,
        roofH(a) + 0.5 * (1 - Math.min(1, Math.max(0, (a - 3.75) / 1))) ** 0.9 + 0.004,
      )
    }),
    'faint',
    0.16,
  )

  // ============================================================== near topsides
  part(hullSide, 'body', [], 0.55)
  // Boot stripe (the livery), then a thin dark waterline and the sheer cove.
  hullPatch(0.45, LOA - 0.7, 0.012, 0.3, 'livery', 'seam')
  line(
    sample(80, (t) => sideAt(0.4 + (LOA - 0.65) * t, 0.012, 1)),
    'line',
    0.3,
  )
  line(
    sample(80, (t) => sideAt(0.1 + (LOA - 0.5) * t, 0.78, 1)),
    'faint',
    0.16,
  )
  // Two oval ports in the forward cabin and a pair of fender cleats.
  for (const a of [8.25, 8.95]) {
    hullLoop(ellipse(a, 0.55, 0.19, 0.2, 24), 'rubber', 'seam', 0.2)
    hullLoop(ellipse(a, 0.55, 0.14, 0.15, 24), 'glass', 'faint', 0.1)
  }
  // Moulded steps: a faint line where the transom corner rolls into the topsides.
  line(
    sample(14, (t) => sideAt(0.02 + 0.45 * t, 0.97 - 0.5 * t * t, 1)),
    'faint',
    0.12,
  )
  toe(1)
  // Waterline foam hugging the near hull, and the bow wave.
  line(
    sample(60, (t) => {
      const p = sideAt(0.5 + (LOA - 1) * t, 0, 1)
      return [p[0], p[1] + 0.07, 0.0] as V3
    }),
    'faint',
    0.26,
  )
  {
    // Bow wave: a foam sheet lying on the water, curling off the stem and fading back along the hull.
    const crest = (t: number, k = 1) => {
      const a = 10.95 - 3.0 * t
      const p = sideAt(a, 0, 1)
      return [
        p[0],
        p[1] +
          0.03 +
          k * 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.04 + 0.04)) ** 0.9 * (1 - 0.5 * t),
        0,
      ] as V3
    }
    const inner = (t: number) => {
      const p = sideAt(10.95 - 3.0 * t, 0, 1)
      return [p[0], p[1] + 0.02, 0] as V3
    }
    fill(
      [...sample(30, (t) => crest(t)), ...sample(30, (t) => inner(1 - t))],
      'glass',
      'faint',
      0.18,
      'foam',
    )
    line(sample(30, (t) => crest(t, 1.55)).slice(2, 26), 'faint', 0.14)
  }
  line(
    sample(14, (t) => at(0.2 - 1.5 * t, 0.9 + 0.55 * t, 0.0)),
    'faint',
    0.16,
  )
  line(
    sample(14, (t) => at(0.2 - 1.0 * t, 0.5 + 0.42 * t, 0.0)),
    'faint',
    0.14,
  )

  // ============================================================== mast, boom and the main
  {
    const mx = at(MAST.a, 0, 0)[0]
    // Mast step collar, then the spar, a masthead fitting and the vane.
    box(
      MAST.a - 0.16,
      MAST.a + 0.16,
      -0.16,
      0.16,
      MAST.base - 0.06,
      MAST.base + 0.04,
      'rubber',
      'rubber',
      0.2,
    )
    {
      const F = G.frameAlong([mx, 0, MAST.base], [0, 0, 1])
      const L = MAST.top - MAST.base
      push(
        kitSolid(
          G.solidOf(
            [
              [0, 0.1],
              [L * 0.78, 0.1],
              [L * 0.985, 0.07],
              [L, 0.07],
            ],
            F,
            P,
            { steps: 20 },
          ),
          'metal',
          [],
          0.3,
        ),
      )
    }
    box(
      MAST.a - 0.12,
      MAST.a + 0.14,
      -0.07,
      0.07,
      MAST.top - 0.01,
      MAST.top + 0.1,
      'metal',
      'metal',
      0.2,
    )
    line(
      [
        [mx, 0, MAST.top + 0.1],
        [mx, 0, MAST.top + 0.62],
      ],
      'line',
      0.3,
    )
    // Spreader roots: a metal collar on the mast, then the near spreaders are drawn with the near rigging.
    for (const z of [LOW_SPREADER, UP_SPREADER])
      push(
        kitSolid(
          G.disc(0, 0.09, 0.125, G.frameAlong([mx, 0, z - 0.045], [0, 0, 1]), P, { steps: 16 }),
          'metal',
          [],
          0.2,
        ),
      )

    // Mainsail: far side of the rig behind it is drawn already.
    const sail = facing(mainSail, [0, 1, 0])
    const panels: ReturnType<typeof seam>[] = []
    for (const k of [0.2, 0.37, 0.54, 0.7, 0.85])
      panels.push(seam(sail, 24, (t) => [t, k + 0.03 * t], 'faint', 0.12))
    // Battens, each ending on a pocket cap at the leech.
    for (const k of [0.24, 0.43, 0.61, 0.78])
      panels.push(seam(sail, 12, (t) => [1 - 0.36 * t, k + 0.022 * (1 - t) - 0.02], 'seam', 0.46))
    // Reef band with its ties, and the luff and foot tapes.
    const reefV = 0.13
    panels.push(seam(sail, 30, (t) => [0.012 + 0.97 * t, reefV], 'seam', 0.2))
    for (let i = 0; i < 9; i++) {
      const u = 0.14 + i * 0.095
      panels.push(seam(sail, 2, (t) => [u, reefV - 0.016 + 0.032 * t], 'seam', 0.26))
    }
    panels.push(seam(sail, 40, (t) => [0.014, t], 'seam', 0.4))
    panels.push(seam(sail, 24, (t) => [t, 0.012], 'seam', 0.4))
    panels.push(seam(sail, 40, (t) => [0.985, t], 'faint', 0.16))
    part(sail, 'glass', panels, 0.5, 'sail')
    // Cringles at the luff and leech ends of the reef band.
    for (const u of [0.014, 0.975]) {
      const p = mainAt(u, reefV)
      fill(
        ellipse(0, 0, 0.055, 0.055, 12).map(([x, z]) => [p[0] + x, p[1] + 0.012, p[2] + z] as V3),
        'metal',
        'seam',
        0.14,
      )
    }
    // Head board and the tack.
    {
      const h = mainAt(0.02, 0.985),
        k = mainAt(0.16, 0.985)
      fill([h, k, [k[0], k[1], k[2] - 0.24], [h[0], h[1], h[2] - 0.34]], 'metal', 'seam', 0.14)
    }
    // Boom with its gooseneck and end cap.
    const b0 = boomAt(-0.05),
      b1 = boomAt(BOOM.len)
    tube(b0, b1, 0.065, 'metal', 0.26)
    box(
      MAST.a - 0.06,
      MAST.a + 0.22,
      -0.07,
      0.1,
      BOOM.z - 0.1,
      BOOM.z + 0.1,
      'metal',
      'metal',
      0.18,
    )
    // Rod vang from the mast foot, topping lift from the boom end to the masthead, mainsheet to the traveller.
    const vangFoot: V3 = [mx - 0.03, 0.05, MAST.base + 0.22]
    const vangBoom = boomAt(1.15)
    line([vangFoot, [vangBoom[0], vangBoom[1], vangBoom[2] - 0.04]], 'line', 0.34)
    line([b1, [mx + 0.02, 0.04, MAST.top - 0.22]], 'faint', 0.2)
    const sheetA = boomAt(3.15)
    const car: V3 = at(cockpit.a1 + 0.1, 0.62, 1.0)
    box(cockpit.a1 + 0.02, cockpit.a1 + 0.18, -0.95, 0.95, 0.98, 1.03, 'metal', 'metal', 0.16)
    line([sub(sheetA, [0.04, 0, 0.0]), sub(car, [0.05, 0, -0.02])], 'seam', 0.3)
    line([sub(sheetA, [-0.04, 0, 0.0]), sub(car, [-0.03, 0, -0.02])], 'seam', 0.3)
    fill(
      [
        [car[0] - 0.12, car[1] - 0.07, car[2] + 0.02],
        [car[0] + 0.08, car[1] - 0.07, car[2] + 0.02],
        [car[0] + 0.08, car[1] + 0.07, car[2] + 0.02],
        [car[0] - 0.12, car[1] + 0.07, car[2] + 0.02],
      ],
      'metal',
      'seam',
      0.14,
    )
  }

  // Masthead burgee: the livery's one echo, flying to leeward.
  {
    const mx = at(MAST.a, 0, 0)[0],
      z = MAST.top + 0.5
    fill(
      [
        [mx, 0, z + 0.14],
        [mx - 0.34, 0.12, z + 0.09],
        [mx - 0.62, 0.28, z + 0.02],
        [mx - 0.36, 0.14, z - 0.04],
        [mx, 0, z - 0.14],
      ],
      'livery',
      'seam',
      0.2,
    )
  }

  // ============================================================== jib and its sheet
  {
    const sail = facing(jibSail, [0, 1, 0])
    const marks: ReturnType<typeof seam>[] = []
    for (const k of [0.22, 0.42, 0.62, 0.82])
      marks.push(seam(sail, 20, (t) => [t, k - 0.05 * t], 'faint', 0.12))
    // Luff tape, leech line, foot tape.
    marks.push(seam(sail, 40, (t) => [0.012, t], 'seam', 0.4))
    marks.push(seam(sail, 40, (t) => [0.99, t], 'faint', 0.16))
    marks.push(seam(sail, 24, (t) => [t, 0.012], 'seam', 0.34))
    // Tell-tales, three pairs up the luff.
    for (const v of [0.3, 0.55, 0.75])
      marks.push(seam(sail, 4, (t) => [0.13 + 0.08 * t, v + 0.012 * t], 'seam', 0.3))
    part(sail, 'glass', marks, 0.5, 'sail')
    // Tack shackle on the stem fitting and the clew cringle.
    fill(
      ellipse(0, 0, 0.06, 0.06, 10).map(
        ([x, z]) => [JIB.tack[0] + x, JIB.tack[1], JIB.tack[2] + z] as V3,
      ),
      'metal',
      'seam',
      0.14,
    )
    fill(
      ellipse(0, 0, 0.07, 0.07, 10).map(
        ([x, z]) => [JIB.clew[0] + x, JIB.clew[1] + 0.02, JIB.clew[2] + z] as V3,
      ),
      'metal',
      'seam',
      0.14,
    )
    // Forestay: masthead to the stem fitting, over the jib's luff.
    line([FORESTAY_TOP, STEM], 'faint', 0.26)
    // Near jib sheet: clew, fairlead block on the side deck, aft to the winch on the coaming.
    const block = at(4.85, 1.45, deckZ(4.85, 1.45) + 0.06)
    const winch = at(2.45, 1.2, 1.2 + 0.085)
    fill(
      [
        at(4.75, 1.4, block[2] + 0.015),
        at(4.95, 1.4, block[2] + 0.015),
        at(4.95, 1.5, block[2] + 0.015),
        at(4.75, 1.5, block[2] + 0.015),
      ].map((p) => [p[0], p[1], p[2]] as V3),
      'metal',
      'seam',
      0.14,
    )
    line([jibAt(1, 0), block], 'seam', 0.34)
    line([block, [winch[0] + 0.16, winch[1] - 0.02, winch[2] - 0.05]], 'seam', 0.34)
    // Winch drums on the near coaming cap (the sheet ends on the nearer one).
    for (const [a, z] of [
      [2.45, 1.2],
      [1.55, 1.2],
    ] as const) {
      const F = G.frameAlong(at(a, 1.2, z), [0, 0, 1])
      push(
        kitSolid(
          G.solidOf(
            [
              [0, 0.11],
              [0.03, 0.1],
              [0.045, 0.075],
              [0.14, 0.085],
              [0.175, 0.105],
              [0.195, 0.085],
            ],
            F,
            P,
            { steps: 24 },
          ),
          'metal',
          [],
          0.24,
        ),
      )
    }
    line(
      [
        [winch[0] + 0.14, winch[1] - 0.06, winch[2] - 0.06],
        [winch[0] + 0.14, winch[1] + 0.02, winch[2] - 0.12],
      ],
      'seam',
      0.3,
    )
  }

  // ============================================================== near rigging, rails and fittings
  for (const a of chain) chainTab(a, 1)
  shrouds(1)
  for (const z of [LOW_SPREADER, UP_SPREADER]) {
    const tip = spreaderTip(z, 1)
    line([[at(MAST.a, 0, 0)[0] - 0.02, 0, z], tip], 'line', 0.34)
    fill(
      ellipse(0, 0, 0.04, 0.04, 8).map(([x, y]) => [tip[0] + x * 0.5, tip[1] + y, tip[2]] as V3),
      'metal',
      'seam',
      0.1,
    )
  }
  // Forestay and backstay on the centre line, stern and bow pulpits, then the stanchions and lifelines.
  line([FORESTAY_TOP, STEM], 'faint', 0.26)
  {
    const mx = at(MAST.a, 0, 0)[0]
    line([[mx + 0.02, 0, MAST.top - 0.3], at(0.12, 0, zs(0.12) + 0.66)], 'faint', 0.24)
  }
  const pulpit = (pts: Pt[], mat: Ink = 'line') => {
    const top = pts.map(([a, y]) => at(a, y, deckZ(a, y) + railZ + 0.02))
    const mid = pts.map(([a, y]) => at(a, y, deckZ(a, y) + railZ * 0.5))
    line(top, mat, 0.46)
    line(mid, 'seam', 0.3)
    for (const [a, y] of pts)
      line([at(a, y, deckZ(a, y)), at(a, y, deckZ(a, y) + railZ + 0.02)], 'line', 0.34)
  }
  pulpit([
    [8.9, -(hb(8.9) - 0.07)],
    [9.9, -0.3],
    [10.28, 0],
    [9.9, 0.3],
    [8.9, hb(8.9) - 0.07],
  ])
  pulpit([
    [1.0, -(hb(1.0) - 0.07)],
    [0.2, -1.1],
    [0.2, 1.1],
    [1.0, hb(1.0) - 0.07],
  ])
  lifelines(1)
  for (const a of stanchionAs) stanchion(a, 1)
  // The near stern light on the pushpit and the boarding gate in the lifelines.
  {
    const y = 1.1,
      z = deckZ(0.2, y) + railZ + 0.02
    fill(
      ellipse(0.2, y, 0.05, 0.05, 10).map(([a, yy]) => at(a, yy, z + 0.03)),
      'rubber',
      'seam',
      0.14,
    )
  }
  return out
}

const REMAP: Record<Tag, (s: string) => string> = {
  sail: (s) => s.replace(/var\(--ag([0-4p])\)/g, 'var(--ays$1)'),
  water: (s) => s.replace(/style="fill:var\(--agp\)/g, 'style="opacity:.6;fill:var(--ayw)'),
  foam: (s) => s.replace(/style="fill:var\(--agp\)/g, 'style="opacity:.5;fill:var(--ayf)'),
}

/** Sails get their own light ramp; the water cue its foam tint. Everything else is the shared aircraft ramps. */
export const YACHT_CSS = `.lane-vehicle{
  --ays4:color-mix(in oklab,var(--iso-top) 70%,white);--ays3:var(--iso-top);
  --ays2:color-mix(in oklab,var(--iso-top) 60%,var(--iso-front));--ays1:color-mix(in oklab,var(--iso-front) 78%,var(--iso-side));
  --ays0:color-mix(in oklab,var(--iso-side) 52%,var(--iso-front));--aysp:var(--ays3);
  --ayw:color-mix(in oklab,var(--iso-top) 55%,var(--agp));--ayf:color-mix(in oklab,var(--iso-top) 80%,var(--ayw));
}
:root[data-theme='dark'] .lane-vehicle{
  --ays4:white;--ays3:color-mix(in oklab,white 97%,var(--iso-front));
  --ays2:color-mix(in oklab,white 93%,var(--iso-front));--ays1:color-mix(in oklab,white 86%,var(--iso-front));
  --ays0:color-mix(in oklab,white 78%,var(--iso-front));--aysp:var(--ays3);
  --ayw:color-mix(in oklab,var(--text) 22%,var(--agp));--ayf:color-mix(in oklab,var(--text) 55%,var(--ayw));
}`

export async function buildYacht(unit = 72) {
  const kit = await loadKit()
  // The car's camera: the road's projection from LaneScene, so the waterline keeps the lane's level ground.
  const { cam, draw, place } = laneCamera(kit, unit / LOA)
  const pieces = yacht(draw)
  const scale = unit / 90
  let body = ''
  const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  for (let i = 0; i < pieces.length;) {
    const tag = pieces[i].tag
    let j = i
    while (j < pieces.length && pieces[j].tag === tag) j++
    const built = serialize(
      pieces.slice(i, j).map((p) => p.item),
      place,
      scale,
    )
    body += tag ? REMAP[tag](built.body) : built.body
    box.x0 = Math.min(box.x0, built.box.x0)
    box.y0 = Math.min(box.y0, built.box.y0)
    box.x1 = Math.max(box.x1, built.box.x1)
    box.y1 = Math.max(box.y1, built.box.y1)
    i = j
  }
  return {
    body,
    box,
    d: { key: 'sea', title: 'A sailing yacht' },
    gear: place(cam.project([0, hw(LOA * 0.4) + 0.2, 0]))[1],
  }
}
