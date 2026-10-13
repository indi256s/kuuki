import { X, Y, Zd, flat } from './flat'
import { Scene, type IsoFigureData, type P3, type Pt } from './scene'

/** Largest code size, in plane units; a code too long for the face shrinks to fit it. */
const CODE_MAX = 16,
  /** Advance of one mono glyph, in em, with a little room over Paper Mono's. */
  GLYPH = 0.62

export type GateSignInput = {
  /** The leader's code as shown on the sign: an airline or airport code (`QR`, `DOH`) or a route (`ROV–VKO`). */
  code: string
  /** The small line on the unlit strip under the code, for example `#1 ×214` (rank and flights). Empty leaves the strip blank. */
  note?: string
}

/**
 * Rankings: an airport gate, the jet-bridge door and the podium under a lit sign that shows the leader's code.
 * The sign is the hero: a wide face over the door, the code as large as the face allows, on a short wall and a shallow floor, so the code reads at card size.
 * Under the lit face sits a second, unlit strip with `note`. The gate around it: tiled floor with a queue lane, a belt between two stanchions, a pass-reader podium.
 * Part: `sign` (the lit face and its code). Geometry never depends on `code` or `note`, so a new leader keeps the figure's scale and box. Motion lives in `gate-sign.css`.
 */
export function gateSign(k: number, { code, note = '' }: GateSignInput): IsoFigureData {
  const s = new Scene(k)
  const G = 2,
    W = 100,
    WD = 5,
    WH = 70,
    F = WD

  // Floor slab and its shadow, then the wall the jet bridge docks to.
  s.poly(
    flat(
      [
        [-8, -6],
        [110, -6],
        [110, 38],
        [-8, 38],
      ],
      0,
    ),
    'shadow',
    'none',
  )
  s.rbox(-6, -4, 0, 114, 40, G, 3, { top: 'front' })
  // Floor tiles: seams run edge to edge of the slab; the queue lane (x = 26) is the heavier line from the wall to the slab's front edge.
  s.segs(
    [10, 42, 58, 74, 90, 106].map((x) => [
      [x, F, G],
      [x, 36, G],
    ]),
    'crease',
    0.5,
  )
  s.segs(
    [16, 27].map((y) => [
      [-6, y, G],
      [108, y, G],
    ]),
    'crease',
    0.5,
  )
  s.line(
    [
      [26, F, G],
      [26, 36, G],
    ],
    'detail',
    1.1,
  )
  s.poly(
    flat(
      [
        [1, WD],
        [W + 3, WD],
        [W + 3, WD + 3],
        [1, WD + 3],
      ],
      G,
    ),
    'shadow',
    'none',
  )
  s.box(0, 0, G, W, WD, WH)
  // Wall: a skirting along the foot, panel joints from the skirting to the top edge, a cap line under the roof edge.
  s.box(0, F, G, W, 0.8, 3)
  s.segs(
    [50, 98].map((x) => [
      [x, F, G + 3],
      [x, F, G + WH],
    ]),
    'crease',
    0.6,
  )
  s.line(
    [
      [0, F, G + WH - 3],
      [W, F, G + WH - 3],
    ],
    'crease',
    0.6,
  )

  const front = (pts: readonly Pt[], y = F): P3[] => pts.map(([x, z]) => [x, y, z])
  const rect = (l: number, r: number, b: number, t: number, y = F) =>
    front(
      [
        [l, t],
        [r, t],
        [r, b],
        [l, b],
      ],
      y,
    )
  /** A screw head: a small disc on a front-facing plane. */
  const screw = (x: number, z: number, y: number) =>
    s.poly(s.circle([x, y, z], X, [0, 0, 1], 0, 0, 0.5, 8), 'line', 'none')

  // The jet-bridge door: frame, two glass leaves, push bars, kick plates.
  const DL = 12,
    DR = 40,
    DH = G + 27,
    DM = (DL + DR) / 2
  s.poly(rect(DL - 2.5, DR + 2.5, G, DH + 2.5), 'top', 'line')
  s.poly(rect(DL, DR, G, DH), 'glass', 'line')
  s.line(
    front([
      [DM, DH],
      [DM, G],
    ]),
    'line',
    0.8,
  )
  s.poly(rect(DL + 1, DM - 1, G, G + 4), 'top', 'crease')
  s.poly(rect(DM + 1, DR - 1, G, G + 4), 'top', 'crease')
  s.segs(
    [
      [DL + 3, DM - 3],
      [DM + 3, DR - 3],
    ].map(([a, b]) =>
      front([
        [a, G + 14],
        [b, G + 14],
      ]),
    ),
    'detail',
    1.2,
  )

  // A band of terminal glazing right of the door, three panes on a sill.
  const WL = 52,
    WR = 94,
    WB = G + 13,
    WT = G + 27
  s.box(WL - 1, F, WB - 1.4, WR - WL + 2, 1.4, 1.4)
  s.poly(rect(WL, WR, WB, WT), 'glass', 'line')
  s.segs(
    [1, 2].map((i) =>
      front([
        [WL + ((WR - WL) * i) / 3, WT],
        [WL + ((WR - WL) * i) / 3, WB],
      ]),
    ),
    'line',
    0.8,
  )

  // The sign: mount straps, a housing with a bevelled bezel and top vents, a lit code face over an unlit note strip.
  const SL = 4,
    SR = 78,
    SZ = G + 32,
    SH = 34,
    SD = 4,
    IN = 1.6,
    NB = SZ + IN,
    NT = NB + 9,
    LB = NT + 1.4,
    FY = F + SD
  for (const x of [SL + 9, SR - 15]) {
    s.box(x, F, SZ - 0.8, 6, SD - 1, 0.8)
    s.box(x, F, SZ + SH, 6, SD - 1, 0.8)
    screw(x + 3, SZ + SH + 0.8, F + SD - 1.6)
  }
  s.box(SL, F, SZ, SR - SL, SD, SH)
  // Vents: slots cut into the top face, one run of them near each end of the housing.
  for (let i = 0; i < 6; i++) {
    for (const x0 of [SL + 24, SR - 36]) {
      const x = x0 + i * 2
      s.poly(
        [
          [x, F + 1, SZ + SH],
          [x + 1, F + 1, SZ + SH],
          [x + 1, F + 3, SZ + SH],
          [x, F + 3, SZ + SH],
        ],
        'shade',
        'none',
      )
    }
  }
  // Bezel: a step in from the housing edge, then the face; screws at the four corners.
  s.poly(rect(SL + 0.7, SR - 0.7, SZ + 0.7, SZ + SH - 0.7, FY), 'none', 'crease', undefined, 0.6)
  for (const x of [SL + 1.6, SR - 1.6]) for (const z of [SZ + 1.6, SZ + SH - 1.6]) screw(x, z, FY)
  s.poly(rect(SL + IN, SR - IN, NB, NT, FY), 'shade', 'line', undefined, 0.6)
  if (note) {
    s.text(note, [(SL + SR) / 2, FY, (NB + NT) / 2 - 2.2], X, Zd, {
      size: 5,
      fill: 'muted',
      weight: 600,
      mono: true,
      anchor: 'middle',
    })
  } else {
    s.line(
      front(
        [
          [(SL + SR) / 2 - 8, (NB + NT) / 2],
          [(SL + SR) / 2 + 8, (NB + NT) / 2],
        ],
        FY,
      ),
      'muted',
      0.8,
    )
  }
  s.group('sign', () => {
    s.lit(rect(SL + IN, SR - IN, LB, SZ + SH - IN, FY), 4)
    const size = Math.min(CODE_MAX, (SR - SL - 2 * IN - 8) / (code.length * GLYPH))
    s.text(code, [(SL + SR) / 2, FY, (LB + SZ + SH - IN) / 2 - size * 0.36], X, Zd, {
      size,
      fill: 'on-accent',
      weight: 700,
      mono: true,
      anchor: 'middle',
    })
  })

  // Queue posts and their belt, in front of the door: a post is a weighted foot, a pole and a ball cap; the belt sags between a cassette on one and a clip on the other.
  const post = (x: number, y: number) => {
    s.poly(
      flat(
        [
          [x - 3, y - 3],
          [x + 5.5, y - 3],
          [x + 5.5, y + 5.5],
          [x - 3, y + 5.5],
        ],
        G,
      ),
      'shadow',
      'none',
    )
    s.cylinder(x, y, 3.6, G, G + 1.4)
    s.cylinder(x, y, 1.2, G + 1.4, G + 19)
    s.cylinder(x, y, 1.8, G + 19, G + 20.4)
  }
  post(10, 26)
  s.line(
    [
      [10, 26, G + 16.5],
      [24, 26, G + 15],
      [38, 26, G + 16.5],
    ],
    'detail',
    2,
  )
  s.box(8.2, 24.2, G + 14.5, 3.6, 3.6, 4)
  post(38, 26)
  s.box(36.4, 24.4, G + 15, 1.8, 3.2, 3, { stroke: 'line' })

  // The podium: a desk on a plinth, an overhanging top, a pass reader, a screen and a pass laid down; a trim band runs the full width of its face.
  s.poly(
    flat(
      [
        [67, 17],
        [93, 17],
        [93, 33],
        [67, 33],
      ],
      G,
    ),
    'shadow',
    'none',
  )
  s.box(65, 15, G, 26, 16, 1.6)
  s.box(66, 16, G, 24, 14, 20)
  s.poly(rect(68, 88, G + 16.4, G + 18.6, 30), 'none', 'crease', undefined, 0.6)
  s.line(
    [
      [66, 30, G + 14],
      [90, 30, G + 14],
    ],
    'detail',
    0.8,
  )
  s.box(64, 14, G + 20, 28, 18, 2.4)
  // Screen: a foot, a neck and a glass panel facing the queue.
  s.box(67, 20, G + 22.4, 6, 4, 0.8)
  s.box(69.4, 21.4, G + 23.2, 1.2, 1.2, 2.4)
  s.box(66.6, 21, G + 25.6, 6.8, 1, 4.4, { front: 'glass' })
  // The reader: a block with its window and a slot, the pass half inside it.
  s.box(80, 19, G + 22.4, 8, 7, 3)
  s.poly(rect(81, 87, G + 23, G + 24.6, 26), 'glass', 'line', undefined, 0.6)
  s.poly(
    [
      [75, 21, G + 22.4],
      [79, 21, G + 22.4],
      [79, 27, G + 22.4],
      [75, 27, G + 22.4],
    ],
    'top',
    'line',
    undefined,
    0.6,
  )
  s.segs(
    [
      [
        [76, 22.5, G + 22.4],
        [78, 22.5, G + 22.4],
      ],
      [
        [76, 24, G + 22.4],
        [78, 24, G + 22.4],
      ],
    ],
    'detail',
    0.6,
  )
  return s.done()
}
