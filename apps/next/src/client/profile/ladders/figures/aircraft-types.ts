import { Scene, roundRect, type IsoNode, type P3, type Paint } from '../../../overview/iso/scene'
import { NZ, X, cylX, cylY, shadowDisc } from '../../../overview/iso/solids'
import type { LadderFigureDef } from './types'

/** The stretch: one airliner, side-on and long, whose barrel grows by plugs. Doors are the countable rhythm. */
const RAD = Math.PI / 180
/** Barrel radius, barrel axis height, nose and tail cone lengths. */
const R = 13,
  ZC = 27,
  NOSE = 22,
  TAIL = 34
const DOOR_W = 9,
  DOOR_BOT = -8,
  DOOR_TOP = 7
/** Longitudinal shading bands (degrees round the barrel, 0 = up, 90 = the near side), top to belly. */
const BANDS = [-45, 22, 78, 135]

type Section = { x0: number; x1: number; doors: number[] }
type Layout = { lit: number; sections: Section[] }

/** Section 1 is lit in every rung: the front barrel, then the first plug, then the long second plug. Only its joint straps and its doors light up. */
const LAYOUTS: Layout[] = [
  {
    lit: 1,
    sections: [
      { x0: 0, x1: 40, doors: [31] },
      { x0: 40, x1: 80, doors: [62] },
    ],
  },
  {
    lit: 1,
    sections: [
      { x0: 0, x1: 40, doors: [31] },
      { x0: 40, x1: 80, doors: [50, 70] },
      { x0: 80, x1: 120, doors: [102] },
    ],
  },
  {
    lit: 1,
    sections: [
      { x0: 0, x1: 40, doors: [31] },
      { x0: 40, x1: 200, doors: [50, 70, 90, 110, 130, 150, 170, 190] },
      { x0: 200, x1: 240, doors: [210, 230] },
      { x0: 240, x1: 280, doors: [262] },
    ],
  },
]

/** Radius and axis height of the body at x: a barrel, an ellipse nose and a tail cone that sweeps up. */
function prof(x: number, B: number) {
  if (x > B) {
    const t = (x - B) / NOSE
    return { r: Math.max(R * Math.sqrt(Math.max(1 - t * t, 0)), 0.8), z: ZC - 3 * t * t }
  }
  if (x < 0) {
    const t = -x / TAIL
    return { r: R - (R - 2.5) * Math.pow(t, 1.3), z: ZC + 9 * t * t }
  }
  return { r: R, z: ZC }
}

export const aircraftTypes: LadderFigureDef = {
  id: 'aircraft-types',
  rungs: 3,
  build(k, { rung, lod }) {
    const hero = lod === 'hero'
    const main = new Scene(k)
    let s = main
    const cut = rung === 3 && hero
    const layout = LAYOUTS[rung - 1]
    const B = layout.sections[layout.sections.length - 1].x1
    const doors = layout.sections.flatMap((sec) => sec.doors)

    /** Point on the skin at x, `a` degrees round the barrel (0 up, 90 the near side). */
    const edge = (x: number, a: number): P3 => {
      const p = prof(x, B)
      return [x, p.r * Math.sin(a * RAD), p.z + p.r * Math.cos(a * RAD)]
    }
    /** Point on the skin at x and height h above the axis, on the near side. */
    const at = (x: number, h: number): P3 => {
      const p = prof(x, B)
      return [x, Math.sqrt(Math.max(p.r * p.r - h * h, 0)), p.z + h]
    }
    const ring = (x: number, stroke: Paint, from = BANDS[0], to = BANDS[3]) =>
      s.line(
        Array.from({ length: 11 }, (_, i) => edge(x, from + ((to - from) * i) / 10)),
        stroke,
      )
    /** Dots of a rivet row round the barrel at x: short ticks, 1px wide. */
    const rivets = (x: number) =>
      s.segs(
        Array.from({ length: 17 }, (_, i) => {
          const a = -35 + i * 10
          return [edge(x, a), edge(x + 0.5, a)]
        }),
        'detail',
      )

    /** The skin between xs in four shading bands, then the two silhouette edges. */
    const skin = (xs: number[], tones: readonly [Paint, Paint, Paint]) => {
      for (let i = 0; i < 3; i++)
        s.poly(
          [
            ...xs.map((x) => edge(x, BANDS[i])),
            ...[...xs].reverse().map((x) => edge(x, BANDS[i + 1])),
          ],
          tones[i],
          tones[i],
        )
      s.line(
        xs.map((x) => edge(x, BANDS[0])),
        'line',
      )
      s.line(
        xs.map((x) => edge(x, BANDS[3])),
        'line',
      )
    }

    const door = (xc: number, lit: boolean) => {
      const w = hero ? DOOR_W : 12,
        b = hero ? DOOR_BOT : -10,
        t = hero ? DOOR_TOP : 10
      const outline = roundRect(xc - w / 2, b, w, t - b, 2, 3).map(([x, h]) => at(x, h))
      s.poly(
        outline,
        'side',
        lit ? 'accent' : 'line',
        undefined,
        (hero ? 1 : 1.8) + (lit ? 0.4 : 0),
      )
      if (!hero) return
      s.poly(
        roundRect(xc - 3.4, DOOR_BOT + 1.6, 6.8, DOOR_TOP - DOOR_BOT - 3.2, 1.2, 2).map(([x, h]) =>
          at(x, h),
        ),
        'none',
        'crease',
        0.9,
      )
      s.poly(
        roundRect(xc - 1.6, 2.4, 3.2, 3.6, 1.1, 2).map(([x, h]) => at(x, h)),
        'glass',
        'crease',
      )
      s.line([at(xc + 2.3, -2.4), at(xc + 2.3, -0.4)], 'detail', 1.6)
    }

    /** Window centres in the stretches between doors: evenly spread, clear of doors and section ends. */
    const windowsOf = (sec: Section) => {
      const xs: number[] = []
      const blocks = [sec.x0 + 3, ...doors.flatMap((d) => [d - 7.5, d + 7.5]), sec.x1 - 3]
        .filter((x) => x >= sec.x0 + 3 - 1e-6 && x <= sec.x1 - 3 + 1e-6)
        .sort((a, b) => a - b)
      const stops = [sec.x0 + 3, ...blocks, sec.x1 - 3]
      for (let i = 0; i < stops.length; i += 2) {
        const a = stops[i],
          b = stops[i + 1]
        if (b === undefined || b < a) continue
        const mid = (a + b) / 2
        if (doors.some((d) => Math.abs(mid - d) < 7.5)) continue
        const n = Math.floor((b - a) / 5.2) + 1
        for (let j = 0; j < n; j++) xs.push(a + (b - a - (n - 1) * 5.2) / 2 + j * 5.2)
      }
      return xs
    }

    const section = (sec: Section, lit: boolean) => {
      skin([sec.x0, sec.x1], ['top', 'front', 'side'])
      if (hero) {
        for (const h of [9.6, -10.6]) s.line([at(sec.x0, h), at(sec.x1, h)], 'crease', 0.9)
        for (const x of windowsOf(sec))
          s.poly(
            roundRect(x - 1.6, 2.4, 3.2, 3.6, 1.1, 2).map(([a, h]) => at(a, h)),
            'glass',
            'crease',
          )
      }
      if (!lit || !hero) for (const d of sec.doors) door(d, false)
    }

    const finish = () => {
      const data = main.done()
      if (tailNode) {
        const i = data.nodes.findIndex((n) => n.kind === 'group' && n.part === tailSlot)
        data.nodes[i] = tailNode
      }
      return data
    }

    // Floor line, taxi stripe and contact shadow.
    const x0 = -TAIL - 3,
      x1 = B + NOSE + 3
    shadowDisc(s, (x0 + x1) / 2, 0, (x1 - x0) / 2 + 6, 24)
    s.line(
      [
        [x0, 0, 0],
        [x1, 0, 0],
      ],
      'crease',
    )
    if (hero)
      s.segs(
        Array.from({ length: Math.floor((x1 - x0) / 16) }, (_, i) => [
          [x0 + 4 + i * 16, 0, 0] as P3,
          [x0 + 4 + i * 16 + 8, 0, 0] as P3,
        ]),
        'detail',
      )

    // Landing gear: legs under the belly, wheels on the floor line.
    const wheel = (x: number, y: number) => {
      s.box(x - 0.9, y - 0.9, 5, 1.8, 1.8, 10)
      cylY(s, x, y - 1.6, 4.5, 4.5, 3.2, { body: 'side', face: 'front' }, hero ? 18 : 12)
      if (hero) s.poly(s.circle([x, y + 1.6, 4.5], X, NZ, 0, 0, 1.8, 10), 'detail', 'line')
    }
    wheel(B + 2, 0)
    if (hero) wheel(20, 8)

    // Far wing and far stabiliser, behind the body.
    const WZ = ZC - 9
    if (hero)
      s.poly(
        [
          [26, -9.4, WZ],
          [14, -26, WZ],
          [6, -26, WZ],
          [3, -9.4, WZ],
        ],
        'top',
        'line',
      )
    const rootY = (x: number, z: number) => {
      const p = prof(x, B)
      return Math.sqrt(Math.max(p.r * p.r - (z - p.z) ** 2, 0))
    }
    const SZ = ZC + 5
    const stab = (sign: 1 | -1) =>
      [
        [-8, sign * rootY(-8, SZ), SZ],
        [-22, sign * 18, SZ],
        [-31, sign * 18, SZ],
        [-27, sign * rootY(-27, SZ), SZ],
      ] as P3[]

    const cone = (from: number, to: number) =>
      Array.from({ length: 8 }, (_, i) => from + ((to - from) * i) / 7)
    const topAt = (x: number) => {
      const p = prof(x, B)
      return p.z + p.r
    }
    const FIN = ZC + R + 22
    /** The tail: APU stub, far stabiliser, cone, fin and near stabiliser. */
    const drawTail = () => {
      // APU exhaust: a stub past the tail tip, covered by the cone where it joins.
      if (hero)
        cylX(s, -TAIL - 3, 0, prof(-TAIL, B).z, 1.8, 3.2, { body: 'side', face: 'shade' }, 10)
      if (hero) s.poly(stab(-1), 'top', 'line')
      skin(cone(-TAIL, 0), ['top', 'front', 'side'])
      s.line(
        Array.from({ length: 7 }, (_, i) => edge(-TAIL, 135 + i * 30)),
        'line',
      )
      // Tail fin: a slim slab standing on the tail's top line.
      const base = [-5, -10, -16, -22, -26].map((x) => [x, topAt(x) - 0.3] as const)
      s.poly(
        [
          [-1.5, -1, topAt(-1.5)],
          [-1.5, 1, topAt(-1.5)],
          [-15, 1, FIN],
          [-15, -1, FIN],
        ],
        'side',
        'crease',
      )
      s.poly(
        [
          [-1.5, 1, topAt(-1.5) - 0.3],
          [-15, 1, FIN],
          [-25, 1, FIN],
          [-29, 1, topAt(-29) - 0.3],
          ...base.map(([x, z]) => [x, 1, z] as P3).reverse(),
        ],
        'front',
        'line',
      )
      s.line(
        [
          [-24.5, 1, topAt(-24.5) - 0.3],
          [-21, 1, FIN],
        ],
        'crease',
      )
      if (hero) s.poly(stab(1), 'top', 'line')
    }
    // Top rung, hero: the tail is cut off by the frame, so only the cone's last bit and the fin's tip show. It is drawn in its own scene so the fit box frames the nose and the barrel.
    const tailSlot = 'tail-slot'
    let tailNode: IsoNode | undefined
    if (cut) {
      const tail = new Scene(k)
      const xc = -20.5 / Math.cos(Math.PI / 6)
      s = tail
      tail.group('tail', drawTail, {
        clip: [
          [xc, 0, -60],
          [xc, 0, 120],
          [xc + 400, 0, 120],
          [xc + 400, 0, -60],
        ],
      })
      s = main
      main.include([[-15, 1, FIN]])
      tailNode = tail.done().nodes[0]
      s.group(tailSlot, () => {})
    } else drawTail()
    layout.sections.forEach((sec, i) => {
      if (i !== layout.lit) return section(sec, false)
      section(sec, true)
      // Lit: the plug's two joint straps (wide bands round the barrel) and its door outlines.
      const w = hero ? 1.8 : 5
      const strap = (x: number): P3[] => [
        ...Array.from({ length: 11 }, (_, j) => edge(x - w, BANDS[0] + (j * 180) / 10)),
        ...Array.from({ length: 11 }, (_, j) => edge(x + w, BANDS[3] - (j * 180) / 10)),
      ]
      s.group('lit', () => {
        for (const x of [sec.x0, sec.x1]) {
          s.glow(3, () => s.poly(strap(x), 'accent', 'none'))
          s.poly(strap(x), 'accent', 'accent')
        }
        if (hero) for (const d of sec.doors) door(d, true)
      })
    })
    skin(cone(B, B + NOSE), ['top', 'front', 'side'])

    // Joints: a plain ring where nothing was added, a doubled strap where a plug went in.
    ring(0, 'crease')
    ring(B, 'crease')
    layout.sections.slice(1).forEach((sec) => {
      if (rung === 1) return ring(sec.x0, 'crease')
      ring(sec.x0, 'line')
      const strapped =
        sec.x0 === layout.sections[layout.lit].x0 || sec.x0 === layout.sections[layout.lit].x1
      if (hero && !strapped) {
        ring(sec.x0 - 1.8, 'crease')
        ring(sec.x0 + 1.8, 'crease')
        rivets(sec.x0 - 3)
        rivets(sec.x0 + 3)
      }
    })

    // Nose: cockpit windows, pitot.
    const tipX = B + NOSE
    s.poly([at(B + 3.5, 7.4), at(B + 8.2, 7.4), at(B + 7.6, 3.2), at(B + 3, 3.2)], 'glass', 'line')
    s.poly([at(B + 9, 7.4), at(B + 13.6, 7), at(B + 12.4, 3.4), at(B + 8.6, 3.2)], 'glass', 'line')
    if (hero) {
      s.line(
        [
          [tipX, 0, prof(tipX, B).z],
          [tipX + 7, 0, prof(tipX, B).z + 0.4],
        ],
        'line',
      )
      for (const x of [34, B - 14]) {
        const top = ZC + R
        s.poly(
          [
            [x, 0.6, top],
            [x + 3.2, 0.6, top],
            [x + 1.8, 0.6, top + 5],
            [x - 0.8, 0.6, top + 5],
          ],
          'front',
          'line',
        )
      }
      // Belly fairing where the wing joins: a closed lens, so no end floats.
      const lens = (sign: 1 | -1) =>
        Array.from({ length: 11 }, (_, i) => {
          const u = i / 10
          return edge(4 + 34 * u, 112 + sign * 12 * Math.sin(Math.PI * u))
        })
      s.poly([...lens(1), ...lens(-1).reverse()], 'none', 'crease', 0.9)
    }

    // Wing root stub with a flap line, pylon and engine.
    if (!hero) return finish()
    const wing = (z: number): P3[] => [
      [26, 9.4, z],
      [14, 26, z],
      [6, 26, z],
      [3, 9.4, z],
    ]
    s.poly(
      [
        [26, 9.4, WZ],
        [14, 26, WZ],
        [14, 26, WZ - 2],
        [26, 9.4, WZ - 2],
      ],
      'side',
      'crease',
    )
    s.poly(
      [
        [14, 26, WZ],
        [6, 26, WZ],
        [6, 26, WZ - 2],
        [14, 26, WZ - 2],
      ],
      'front',
      'crease',
    )
    s.poly(wing(WZ), 'top', 'line')
    if (hero)
      s.line(
        [
          [11, 9.4, WZ],
          [8.5, 26, WZ],
        ],
        'crease',
        0.9,
      )
    s.box(11, 17, WZ - 2.6, 7, 2, 0.8)
    const nac = cylX(s, 8, 18, 10.5, 5, 15, { body: 'front', face: 'side' }, hero ? 20 : 12)
    void nac
    s.poly(s.circle([23, 18, 10.5], Y_AXIS, NZ, 0, 0, 3.3, hero ? 16 : 10), 'shade', 'line')
    if (hero)
      s.segs(
        [0, 1, 2, 3, 4, 5].map((i) => {
          const a = i * 60 * RAD
          return [
            [23.05, 18, 10.5] as P3,
            [23.05, 18 + 3.1 * Math.cos(a), 10.5 - 3.1 * Math.sin(a)] as P3,
          ]
        }),
        'detail',
      )

    return finish()
  },
}

const Y_AXIS: P3 = [0, 1, 0]
