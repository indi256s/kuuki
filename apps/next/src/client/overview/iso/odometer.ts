import { Scene, roundRect, type IsoFigureData, type P3, type Pt } from './scene'
import { NZ, X, Y, cylX, rrOn, shadowRect } from './solids'

/** Housing, drum and window dimensions in iso units. */
const FOOT = 4,
  H = 72,
  D = 44,
  DW = 22,
  /** One digit's pitch: the window cell is this tall and the strip moves by it. */
  PITCH = 28,
  MIN_DRUMS = 6,
  // Window rows on the front face, measured down from its top edge.
  CELL_V = 13,
  BASELINE_V = CELL_V + 20.3,
  RIM = 3

/**
 * Kilometres: a mechanical odometer, the real whole-km total on its drums and the units drum lit.
 * `digits` is plain ASCII, 1 to 8 characters. The housing always has room for 6 drums, shorter totals get leading zeros in the quiet tones, longer ones widen it.
 * Part: `last-drum`, the units strip (this digit, then the next one a pitch below) clipped to its cell, so it ticks over without leaving the window. Motion lives in `odometer.css`.
 */
export function odometer(k: number, { digits }: { digits: string }): IsoFigureData {
  const s = new Scene(k)
  const n = Math.max(MIN_DRUMS, digits.length),
    drums = digits.padStart(n, '0'),
    lead = n - digits.length
  const GW = n * DW + 4,
    BW = GW + 8,
    W = BW + 36,
    TOP = FOOT + H
  const BX = 18,
    FB: P3 = [0, D + 1.5, TOP],
    onFB = s.on(FB, X, NZ)

  shadowRect(s, 0, -2, W + 12, D + 14, 3)

  // Mounting tabs: they reach past the housing so their screw heads show.
  for (const x of [10, W - 34]) {
    s.box(x, -2, 0, 24, D + 14, FOOT)
    const c: P3 = [x + 12, D + 7, FOOT]
    s.poly(s.circle(c, X, Y, 0, 0, 2.4, 14), 'detail', 'line', 0.7)
    s.line(
      [
        [c[0] - 1.7, c[1] + 1.7, FOOT],
        [c[0] + 1.7, c[1] - 1.7, FOOT],
      ],
      'line',
      0.6,
    )
  }

  s.rbox(0, 0, FOOT, W, D, H, 6, { top: 'top', wall: 'front', side: 'side' })

  // Panel seams wrap the visible half of the housing and end on its silhouette.
  const plan = roundRect(0, 0, W, D, 6),
    m = plan.length
  const facing = plan.map(([x0, y0], i) => {
    const [x1, y1] = plan[(i + 1) % m]
    return y1 - y0 + (x0 - x1) > 1e-6
  })
  const first = facing.findIndex((f, i) => f && !facing[(i + m - 1) % m])
  const run: Pt[] = []
  let j = first
  while (facing[j % m]) run.push(plan[j++ % m])
  run.push(plan[j % m])
  for (const z of [FOOT + 4, TOP - 4])
    s.line(
      run.map(([x, y]): P3 => [x, y, z]),
      'detail',
      0.7,
    )

  // Lid: panel seam, two screws and a finger slot.
  const lid = roundRect(4, 4, W - 8, D - 8, 3).map(([x, y]): P3 => [x, y, TOP])
  s.line([...lid, lid[0]], 'detail', 0.7)
  for (const x of [12, W - 12]) {
    const c: P3 = [x, D / 2, TOP]
    s.poly(s.circle(c, X, Y, 0, 0, 2.2, 14), 'detail', 'line', 0.7)
    s.line(
      [
        [x - 1.5, D / 2 + 1.5, TOP],
        [x + 1.5, D / 2 - 1.5, TOP],
      ],
      'line',
      0.6,
    )
  }
  s.poly(rrOn(s, [0, 0, TOP], X, Y, W / 2 - 14, D / 2 - 2, 28, 4, 2), 'glass', 'line', 0.7)

  // Reset knob on the right end: a plate with four screws, a collar, then the knurled knob.
  const E: P3 = [W, 0, TOP],
    onE = s.on(E, Y, NZ),
    KY = D / 2,
    KV = 36,
    KZ = TOP - KV
  s.poly(rrOn(s, E, Y, NZ, 9, 8, D - 18, 56, 3), 'front', 'line', 0.7)
  for (const [u, v] of [
    [13, 12],
    [D - 13, 12],
    [13, 60],
    [D - 13, 60],
  ] as const) {
    s.poly(s.circle(E, Y, NZ, u, v, 1.5, 12), 'detail', 'line', 0.6)
    s.line([onE(u - 1, v + 1), onE(u + 1, v - 1)], 'line', 0.6)
  }
  cylX(s, W, KY, KZ, 11, 2.5, { face: 'top', body: 'side' })
  const KX = W + 2.5,
    KW = 9
  cylX(s, KX, KY, KZ, 8.5, KW, { face: 'side', body: 'front' })
  const knurl: P3[][] = []
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 2 * Math.PI,
      y = KY + 8.5 * Math.cos(a),
      z = KZ + 8.5 * Math.sin(a)
    // Only ridges on the side facing the viewer.
    if (Math.cos(a) + Math.sin(a) > 0.15)
      knurl.push([
        [KX, y, z],
        [KX + KW, y, z],
      ])
  }
  s.segs(knurl, 'detail', 0.7)
  s.poly(s.circle([KX + KW, KY, KZ], Y, NZ, 0, 0, 5.5, 20), 'front', 'detail', 0.8)
  s.line(
    [
      [KX + KW, KY - 8.5, KZ],
      [KX + KW, KY + 8.5, KZ],
    ],
    'line',
    0.8,
  )

  // Window: a raised bezel with corner screws round a glass, six or more drums inside.
  s.box(BX, D, TOP - 46, BW, 1.5, 38)
  s.poly(rrOn(s, FB, X, NZ, BX + 4, 12, GW, 30, 2), 'glass', 'line', 0.7)
  const GX = BX + 6,
    CELL_BOTTOM = CELL_V + PITCH,
    cell = (i: number) => {
      const u = GX + i * DW
      return [
        onFB(u, CELL_V),
        onFB(u + DW, CELL_V),
        onFB(u + DW, CELL_BOTTOM),
        onFB(u, CELL_BOTTOM),
      ]
    }
  const last = n - 1,
    bands: ReturnType<typeof s.pp>[] = []
  for (let i = 0; i < last; i++) {
    s.poly(cell(i), 'top', 'none')
    bands.push(
      s.pp([
        onFB(GX + i * DW, CELL_V),
        onFB(GX + (i + 1) * DW, CELL_V),
        onFB(GX + (i + 1) * DW, CELL_V + RIM),
        onFB(GX + i * DW, CELL_V + RIM),
      ]),
      s.pp([
        onFB(GX + i * DW, CELL_BOTTOM - RIM),
        onFB(GX + (i + 1) * DW, CELL_BOTTOM - RIM),
        onFB(GX + (i + 1) * DW, CELL_BOTTOM),
        onFB(GX + i * DW, CELL_BOTTOM),
      ]),
    )
  }
  s.area(bands, 'side')
  for (let i = 0; i < last; i++)
    s.text(drums[i], onFB(GX + i * DW + DW / 2, BASELINE_V), X, NZ, {
      size: 18,
      fill: i < lead ? 'detail' : 'ink',
      weight: 600,
      mono: true,
      anchor: 'middle',
    })

  // The units drum: the current digit and the next one a pitch below, both on the accent face. The clip is the cell, so the strip rolls inside it.
  const LU = GX + last * DW,
    d = Number(drums[last]),
    next = String((d + 1) % 10)
  const [tx, ty] = s.vector(0, 0, PITCH)
  s.glow(5, () => s.poly(cell(last), 'accent', 'none'))
  s.group(
    'last-drum',
    () => {
      s.poly(
        [
          onFB(LU, CELL_V),
          onFB(LU + DW, CELL_V),
          onFB(LU + DW, CELL_BOTTOM + PITCH),
          onFB(LU, CELL_BOTTOM + PITCH),
        ],
        'accent',
        'none',
      )
      s.line([onFB(LU, CELL_BOTTOM), onFB(LU + DW, CELL_BOTTOM)], 'accent-plate', 0.7)
      const opts = {
        size: 18,
        fill: 'on-accent',
        weight: 700,
        mono: true,
        anchor: 'middle',
      } as const
      s.text(drums[last], onFB(LU + DW / 2, BASELINE_V), X, NZ, opts)
      s.text(next, onFB(LU + DW / 2, BASELINE_V + PITCH), X, NZ, opts)
    },
    {
      clip: [
        onFB(LU, CELL_V),
        onFB(LU + DW, CELL_V),
        onFB(LU + DW, CELL_BOTTOM),
        onFB(LU, CELL_BOTTOM),
      ],
      vars: { '--tick-x': `${tx}px`, '--tick-y': `${ty}px` },
    },
  )
  s.area(
    [
      s.pp([
        onFB(LU, CELL_V),
        onFB(LU + DW, CELL_V),
        onFB(LU + DW, CELL_V + RIM),
        onFB(LU, CELL_V + RIM),
      ]),
      s.pp([
        onFB(LU, CELL_BOTTOM - RIM),
        onFB(LU + DW, CELL_BOTTOM - RIM),
        onFB(LU + DW, CELL_BOTTOM),
        onFB(LU, CELL_BOTTOM),
      ]),
    ],
    'accent-side',
  )

  // Drum separators, rim lines and the glass highlight, all ending on the drums' edges.
  const x0 = GX,
    x1 = GX + n * DW
  s.segs(
    Array.from({ length: n + 1 }, (_, i) => [
      onFB(GX + i * DW, CELL_V),
      onFB(GX + i * DW, CELL_BOTTOM),
    ]),
    'line',
    0.8,
  )
  s.segs(
    [CELL_V + RIM, CELL_BOTTOM - RIM].map((v) => [onFB(x0, v), onFB(x1, v)]),
    'detail',
    0.6,
  )
  s.poly(
    [
      onFB(x0, CELL_V + RIM + 1.5),
      onFB(x1, CELL_V + RIM + 1.5),
      onFB(x1, CELL_V + RIM + 2.7),
      onFB(x0, CELL_V + RIM + 2.7),
    ],
    'top',
    'none',
    undefined,
    undefined,
    0.35,
  )
  for (const [u, v] of [
    [BX + 2, 10],
    [BX + BW - 2, 10],
    [BX + 2, 44],
    [BX + BW - 2, 44],
  ] as const) {
    s.poly(s.circle(FB, X, NZ, u, v, 1.5, 12), 'detail', 'line', 0.6)
    s.line([onFB(u - 1, v + 1), onFB(u + 1, v - 1)], 'line', 0.6)
  }

  // Front plates on the lower face: a counter label, a vent row and the KM legend.
  const PZ = TOP - 62,
    PL = 64,
    PK = 36,
    PY = D + 0.8,
    onP = s.on([0, PY, TOP], X, NZ)
  const kx = W - 18 - PK
  s.box(18, D, PZ, PL, 0.8, 11, { top: 'top', front: 'top' })
  s.box(kx, D, PZ, PK, 0.8, 11, { top: 'top', front: 'top' })
  for (const [px, pw] of [
    [18, PL],
    [kx, PK],
  ] as const)
    for (const u of [px + 4, px + pw - 4]) {
      s.poly(s.circle([0, PY, TOP], X, NZ, u, 56.5, 1.2, 10), 'detail', 'line', 0.6)
    }
  s.segs(
    [
      [onP(27, 54), onP(18 + PL - 10, 54)],
      [onP(27, 56.5), onP(18 + PL - 20, 56.5)],
      [onP(27, 59), onP(18 + PL - 14, 59)],
    ],
    'detail',
    0.6,
  )
  s.text('KM', onP(kx + PK / 2, 59.2), X, NZ, {
    size: 7.5,
    fill: 'ink',
    weight: 700,
    mono: true,
    anchor: 'middle',
  })
  const vents = Math.min(8, Math.floor((kx - 8 - (18 + PL + 8)) / 5) + 1),
    vx = (18 + PL + kx) / 2 - ((vents - 1) * 5) / 2
  for (let i = 0; i < vents; i++)
    s.poly(rrOn(s, [0, D, TOP], X, NZ, vx + i * 5 - 0.9, 52.5, 1.8, 8, 0.8), 'glass', 'line', 0.5)

  return s.done()
}
