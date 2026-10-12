import { X, Y, Zd, flat } from './flat'
import { Scene, hull, type IsoFigureData, type P3, type Pt } from './scene'

/** Largest code size, in plane units; a code too long for the face shrinks to fit it. */
const CODE_MAX = 16,
  /** Advance of one mono glyph, in em, with a little room over Paper Mono's. */
  GLYPH = 0.62

export type GateSignInput = {
  /** The leader's code as shown on the sign: an airline or airport code (`QR`, `DOH`) or a route (`ROV–VKO`). */
  code: string
}

/**
 * Rankings: an airport gate, the jet-bridge door and the podium under a lit sign that shows the leader's code.
 * The sign is the hero: a wide face over the door, the code as large as the face allows, on a short wall and a shallow floor, so the code reads at card size.
 * Part: `sign` (the lit face and its code). Geometry never depends on `code`, so a new leader keeps the figure's scale and box. Motion lives in `gate-sign.css`.
 */
export function gateSign(k: number, { code }: GateSignInput): IsoFigureData {
  const s = new Scene(k)
  const G = 2,
    W = 100,
    WD = 5,
    WH = 58,
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

  // The jet-bridge door: frame, two glass leaves, push bars.
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

  // A band of terminal glazing right of the door, three panes.
  const WL = 52,
    WR = 94,
    WB = G + 13,
    WT = G + 27
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

  // The sign: a housing on the wall over the door, its lit face, the code centred.
  const SL = 4,
    SR = 78,
    SZ = G + 33,
    SH = 21,
    SD = 4,
    IN = 1.6
  s.box(SL, F, SZ, SR - SL, SD, SH)
  s.group('sign', () => {
    s.lit(rect(SL + IN, SR - IN, SZ + IN, SZ + SH - IN, F + SD), 4)
    const size = Math.min(CODE_MAX, (SR - SL - 2 * IN - 8) / (code.length * GLYPH))
    s.text(code, [(SL + SR) / 2, F + SD, SZ + SH / 2 - size * 0.36], X, Zd, {
      size,
      fill: 'on-accent',
      weight: 700,
      mono: true,
      anchor: 'middle',
    })
  })

  // Queue posts and their belt, in front of the door.
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
    cylinder(s, x, y, 3.6, G, G + 1.4)
    cylinder(s, x, y, 1.2, G + 1.4, G + 19)
  }
  post(10, 26)
  s.line(
    [
      [10, 26, G + 17],
      [38, 26, G + 17],
    ],
    'detail',
    2,
  )
  post(38, 26)

  // The podium: a desk with an overhanging top and a pass reader.
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
  s.box(66, 16, G, 24, 14, 20)
  s.box(64, 14, G + 20, 28, 18, 2.4)
  s.box(80, 19, G + 22.4, 8, 7, 3)
  s.poly(rect(81, 87, G + 23, G + 24.6, 26), 'glass', 'line', undefined, 0.6)
  s.line(
    [
      [68, 30, G + 14],
      [88, 30, G + 14],
    ],
    'detail',
    0.7,
  )
  return s.done()
}

/** Upright disc: wall then top, centre (x, y), radius r, from z0 to z1. */
function cylinder(s: Scene, x: number, y: number, r: number, z0: number, z1: number) {
  const a = s.circle([x, y, z0], X, Y, 0, 0, r, 32),
    b = s.circle([x, y, z1], X, Y, 0, 0, r, 32)
  s.poly2(hull(s.pp([...a, ...b])), 'front', 'line')
  s.poly(b, 'top', 'line')
}
