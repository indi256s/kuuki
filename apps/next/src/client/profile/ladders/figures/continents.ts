import { Scene, hull, type P3, type Pt } from '../../../overview/iso/scene'
import { shadowRect } from '../../../overview/iso/solids'
import type { LadderFigureDef } from './types'

// A cork board standing on a small easel: wooden frame with a ledge, six continent outlines on the cork, one push-pin per visited continent.
// Rung r pushes r + 1 pins; the newest stands upright with an accent head, the earlier ones lean.
// The board's face is the x-z plane at y = FY, turned toward the viewer; pins stick out toward +y.
const W = 150,
  H = 66,
  BAR = 8,
  Z0 = 10,
  TH = 8,
  FY = TH,
  CY = FY - 3,
  ZTOP = Z0 + H,
  ZB = Z0 + BAR,
  ZC = ZTOP - BAR
/** The map is authored in 134 × 80 units; it is stretched to the cork's inner area. */
const MX = (W - 2 * BAR) / 134,
  MY = (H - 2 * BAR) / 80

type Region = { name: string; shape: readonly Pt[]; pin: Pt; tilt: Pt }

/** Simplified outlines in map units (x 0–134, y 0–80), in the order the pins go in. */
const REGIONS: readonly Region[] = [
  {
    name: 'europe',
    shape: [
      [58, 12],
      [64, 8],
      [72, 7],
      [79, 11],
      [77, 19],
      [68, 23],
      [59, 20],
    ],
    pin: [68, 15],
    tilt: [-2.2, 1.6],
  },
  {
    name: 'north-america',
    shape: [
      [6, 10],
      [18, 5],
      [31, 5],
      [46, 10],
      [44, 24],
      [37, 35],
      [28, 34],
      [22, 27],
      [10, 22],
    ],
    pin: [28, 19],
    tilt: [2.4, 1.2],
  },
  {
    name: 'asia',
    shape: [
      [82, 10],
      [96, 5],
      [112, 6],
      [124, 12],
      [121, 27],
      [109, 35],
      [96, 33],
      [88, 24],
    ],
    pin: [103, 19],
    tilt: [1.8, -2.1],
  },
  {
    name: 'africa',
    shape: [
      [61, 28],
      [73, 27],
      [83, 36],
      [79, 54],
      [71, 64],
      [65, 51],
      [58, 38],
    ],
    pin: [71, 43],
    tilt: [-1.6, -2],
  },
  {
    name: 'south-america',
    shape: [
      [33, 41],
      [45, 40],
      [53, 50],
      [47, 66],
      [41, 75],
      [37, 61],
      [30, 49],
    ],
    pin: [42, 55],
    tilt: [2.2, 1.8],
  },
  {
    name: 'oceania',
    shape: [
      [103, 55],
      [118, 52],
      [128, 58],
      [124, 70],
      [111, 74],
      [102, 66],
    ],
    pin: [114, 63],
    tilt: [0, 0],
  },
]

/** Mulberry32: the speckle's only source of randomness. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export const continents: LadderFigureDef = {
  id: 'continents',
  rungs: 5,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    const pinCount = rung + 1
    const cracked = rung === 5
    const X: P3 = [1, 0, 0],
      Zv: P3 = [0, 0, 1]
    /** A map point on the cork face, y up. */
    const wx = (m: Pt) => BAR + m[0] * MX
    const wz = (m: Pt) => ZC - m[1] * MY
    const onCork = (m: Pt, y = CY + 0.03): P3 => [wx(m), y, wz(m)]
    const fy = (x: number, z: number, y = FY): P3 => [x, y, z]

    if (hero) {
      shadowRect(s, 0, -40, W, TH + 60, 6)
      // Rear easel leg, with the hinge bracket on the frame's top.
      const lx = W - 14
      s.poly(
        [
          [lx + 5, -1, ZTOP - 4],
          [lx + 5, -1, ZTOP - 14],
          [lx + 5, -50, 4],
          [lx + 5, -50, 0],
        ],
        'side',
        'line',
      )
      s.poly(
        [
          [lx, -1, ZTOP - 4],
          [lx + 5, -1, ZTOP - 4],
          [lx + 5, -50, 0],
          [lx, -50, 0],
        ],
        'top',
        'line',
      )
      s.line(
        [
          [lx + 2.5, -3, ZTOP - 8],
          [lx + 2.5, -48, 1.5],
        ],
        'crease',
        0.6,
      )
    } else shadowRect(s, 0, 0, W, TH + 16, 5)

    // Ledge on two feet, so the board stands on it.
    if (hero) {
      s.box(8, 2, 0, 12, 12, 4, { top: 'top', front: 'front', side: 'side' })
      s.box(W - 20, 2, 0, 12, 12, 4, { top: 'top', front: 'front', side: 'side' })
    }
    const LZ = hero ? 4 : 0
    s.box(4, 0, LZ, W - 8, 17, Z0 - LZ, { top: 'top', front: 'top', side: 'side' })
    if (hero) {
      s.box(4, 14.5, Z0, W - 8, 2.5, 2.6, { top: 'top', front: 'top', side: 'side' })
      // Ledge seam and two screws in its lip.
      s.line(
        [
          [4, 17, Z0 - 3.2],
          [W - 4, 17, Z0 - 3.2],
        ],
        'crease',
        0.6,
      )
    }

    // Frame: the board is one slab whose front face is the frame bars.
    s.box(0, 0, Z0, W, TH, H, { top: 'top', front: 'top', side: 'side' })

    // Cork: a solid recessed face, then the two inner walls that face the viewer.
    s.poly(
      [fy(BAR, ZB, CY), fy(W - BAR, ZB, CY), fy(W - BAR, ZC, CY), fy(BAR, ZC, CY)],
      'side',
      'crease',
    )
    s.poly([fy(BAR, ZB, FY), fy(BAR, ZC, FY), fy(BAR, ZC, CY), fy(BAR, ZB, CY)], 'front', 'line')
    s.poly(
      [fy(BAR, ZB, FY), fy(W - BAR, ZB, FY), fy(W - BAR, ZB, CY), fy(BAR, ZB, CY)],
      'top',
      'line',
    )
    if (hero) {
      // Cork edge bevel: a thin step just inside the walls.
      s.line(
        [fy(BAR + 2, ZC - 1, CY), fy(BAR + 2, ZB + 2, CY), fy(W - BAR - 1, ZB + 2, CY)],
        'crease',
        0.5,
      )
    }

    // Real cork: a fine, sparse speckle that thins out toward the frame.
    if (hero) {
      const rnd = seeded(2024)
      const flecks: P3[][] = [],
        dots: P3[][] = []
      const x0 = BAR + 1,
        x1 = W - BAR - 1,
        z0 = ZB + 1,
        z1 = ZC - 1
      for (let i = 0; i < 1500; i++) {
        const x = x0 + rnd() * (x1 - x0),
          z = z0 + rnd() * (z1 - z0)
        const edge = Math.min(x - x0, x1 - x, z - z0, z1 - z)
        const keep = rnd() < smooth(0, 24, edge) * 0.85
        const a = rnd() * Math.PI,
          len = 0.5 + rnd() * 1.3,
          big = rnd() < 0.3
        if (!keep) continue
        if (big)
          dots.push([
            [x, CY + 0.02, z],
            [x + 0.2, CY + 0.02, z + 0.1],
          ])
        else
          flecks.push([
            [x, CY + 0.02, z],
            [x + Math.cos(a) * len, CY + 0.02, z + Math.sin(a) * len],
          ])
      }
      s.segs(flecks, 'crease', 0.7)
      s.segs(dots, 'crease', 1.5)
      // The six continents: paper cut-outs lying on the cork.
      for (const r of REGIONS)
        s.poly(
          r.shape.map((m) => onCork(m)),
          'front',
          'line',
          0.55,
          0.9,
          0.7,
        )
    }

    // Frame details on the bars: mitre joints, grain, nail heads.
    if (hero) {
      // Mitre joints: the diagonals from outer to inner corners, drawn as seams.
      s.segs(
        [
          [fy(0, Z0), fy(BAR, ZB)],
          [fy(W, Z0), fy(W - BAR, ZB)],
          [fy(0, ZTOP), fy(BAR, ZC)],
          [fy(W, ZTOP), fy(W - BAR, ZC)],
        ].map((seg) => seg as P3[]),
        'line',
        0.8,
      )
      // Grain along each bar, from mitre to mitre.
      const g = [2.6, 5.4]
      const grain: P3[][] = []
      for (const o of g) {
        grain.push([fy(o, Z0 + o), fy(W - o, Z0 + o)])
        grain.push([fy(o, ZTOP - o), fy(W - o, ZTOP - o)])
        grain.push([fy(o, Z0 + o), fy(o, ZTOP - o)])
        grain.push([fy(W - o, Z0 + o), fy(W - o, ZTOP - o)])
      }
      s.segs(grain, 'detail', 0.5)
      const nails: Pt[] = [
        [20, Z0 + 4],
        [W - 20, Z0 + 4],
        [20, ZTOP - 4],
        [W - 20, ZTOP - 4],
        [4, Z0 + 22],
        [4, ZTOP - 22],
        [W - 4, Z0 + 22],
        [W - 4, ZTOP - 22],
      ]
      for (const [nx, nz] of nails) {
        s.poly(s.circle([nx, FY, nz], X, Zv, 0, 0, 1, 8), 'detail', 'line', undefined, 0.6)
        s.line(
          [
            [nx - 0.5, FY, nz - 0.4],
            [nx + 0.5, FY, nz + 0.4],
          ],
          'crease',
          0.5,
        )
      }
      // Hinge bracket on the top rim, where the easel leg joins.
      const hx = W - 19
      s.box(hx, 1, ZTOP, 11, 6, 1.4, { top: 'side', front: 'side', side: 'side' })
      for (const sx of [hx + 2.5, hx + 8.5]) {
        s.poly(
          s.circle([sx, 4, ZTOP + 1.4], X, [0, 1, 0], 0, 0, 0.9, 8),
          'detail',
          'line',
          undefined,
          0.6,
        )
      }
    }

    // Rung 5 joke: the sixth pin split the bottom bar near the right corner, down to the ledge, and a chip fell off.
    if (cracked) {
      const bx = W - 42
      // The split: a jagged gap across the bar, with a short run up the cork's edge.
      const left: P3[] = [
        [bx - 0.64, CY, ZB + 7],
        [bx - 2.56, CY, ZB + 3.5],
        [bx - 1.28, FY, ZB],
        [bx - 3.52, FY, ZB - 2.6],
        [bx - 0.96, FY, ZB - 5.2],
        [bx - 2.88, FY, Z0],
      ]
      const right: P3[] = [
        [bx + 0.96, CY, ZB + 7],
        [bx + 0.64, CY, ZB + 3.5],
        [bx + 2.24, FY, ZB],
        [bx + 0.32, FY, ZB - 2.6],
        [bx + 3.52, FY, ZB - 5.2],
        [bx + 1.92, FY, Z0],
      ]
      s.poly([...left, ...right.reverse()], 'side', 'line', undefined, 0.9)
      // The chip: a splinter lying on the ledge, with a crumb beside it.
      s.poly(
        [
          [bx + 3, FY + 5, Z0 + 0.1],
          [bx + 10, FY + 7.5, Z0 + 0.1],
          [bx + 6, FY + 6.2, Z0 + 1.8],
        ],
        'top',
        'line',
      )
      s.poly(
        [
          [bx + 12, FY + 3, Z0 + 0.1],
          [bx + 14, FY + 4, Z0 + 0.1],
          [bx + 13, FY + 3.6, Z0 + 0.9],
        ],
        'top',
        'line',
      )
    }

    // Pins: head and shaft, toward the viewer.
    const sc = hero ? 1 : 2.3
    for (let i = 0; i < pinCount; i++) {
      const r = REGIONS[i],
        newest = i === pinCount - 1
      const px = wx(r.pin),
        pz = wz(r.pin)
      const rad = newest ? (hero ? 4.5 : 12.6) : hero ? 3.1 : 9
      const len = newest ? (hero ? 10 : 12) : hero ? 6.5 : 9
      const hh = newest ? (hero ? 2.6 : 4.5) : hero ? 1.9 : 3.4
      const [tx, tz] = newest ? [0, 0] : [r.tilt[0] * sc, -r.tilt[1] * sc]
      const hx = px + tx,
        hz = pz + tz,
        hy = CY + len
      // Shadow on the cork, thrown right and down.
      if (hero)
        s.poly(
          s.circle([px + 2.4 * sc, CY + 0.04, pz - 2.4 * sc], X, Zv, 0, 0, 2.4, 12),
          'shadow',
          'none',
        )
      s.line(
        [
          [px, CY, pz],
          [hx, hy - hh, hz],
        ],
        'line',
        hero ? 1.1 : 1.5,
      )
      const back = s.circle([hx, hy - hh, hz], X, Zv, 0, 0, rad, 16),
        face = s.circle([hx, hy, hz], X, Zv, 0, 0, rad, 16)
      const outline = hull([...s.pp(back), ...s.pp(face)])
      const shine: P3[] = [
        [hx - rad * 0.55, hy + 0.05, hz + rad * 0.2],
        [hx - rad * 0.2, hy + 0.05, hz + rad * 0.6],
      ]
      if (newest)
        s.group('lit', () => {
          s.poly2(outline, 'accent-side', 'accent')
          s.lit(face)
          if (hero) s.line(shine, 'on-accent', 0.7)
        })
      else {
        // Thumb: a solid line-coloured head, so every earned pin counts.
        s.poly2(outline, hero ? 'side' : 'line', 'line')
        s.poly(face, hero ? 'top' : 'line', 'line')
        if (hero) s.line(shine, 'crease', 0.6)
      }
    }

    return s.done()
  },
}
