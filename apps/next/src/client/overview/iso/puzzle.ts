import { CONTINENT_RINGS } from './continents.generated'
import { X, Y, flat } from './flat'
import { Scene, roundRect, type IsoFigureData, type P3, type Paint, type Pt } from './scene'

export const CONTINENT_IDS = [
  'europe',
  'asia',
  'africa',
  'north-america',
  'south-america',
  'oceania',
  'antarctica',
] as const
export type ContinentId = (typeof CONTINENT_IDS)[number]

const RINGS: Record<ContinentId, readonly (readonly number[])[]> = CONTINENT_RINGS

const PAINT_ORDER: readonly ContinentId[] = [
  'north-america',
  'europe',
  'asia',
  'south-america',
  'africa',
  'oceania',
  'antarctica',
]

const LIFT_PX = 4,
  SC = 0.6,
  LAT0 = 84,
  RIM = 7.5,
  BED = 3,
  FLOOR = 0.8,
  TOP = 6.5,
  W = 360 * SC,
  D = 112

const plan = (id: ContinentId): Pt[][] =>
  RINGS[id].map((flatRing) => {
    const ring: Pt[] = []
    for (let i = 0; i < flatRing.length; i += 2) {
      const lon = flatRing[i],
        lat = flatRing[i + 1]
      ring.push(
        id === 'antarctica'
          ? [(lon * 0.26 + 180) * SC, 90 + ((-68 - lat) / 16) * 20]
          : [(lon + 180) * SC, (LAT0 - lat) * SC],
      )
    }
    return ring
  })
const PLAN = Object.fromEntries(CONTINENT_IDS.map((id) => [id, plan(id)])) as Record<
  ContinentId,
  Pt[][]
>

const strip = (pts: readonly Pt[], hi: number, lo: number): P3[] => [
  ...pts.map(([x, y]): P3 => [x, y, hi]),
  ...[...pts].reverse().map(([x, y]): P3 => [x, y, lo]),
]

type Wall = { pts: Pt[]; tone: Paint }
function walls(ring: Pt[], outside: boolean): Wall[] {
  const n = ring.length
  const area = ring.reduce((sum, [x, y], i) => {
    const [x2, y2] = ring[(i + 1) % n]
    return sum + x * y2 - x2 * y
  }, 0)
  const sign = (area > 0 ? 1 : -1) * (outside ? 1 : -1)
  const tone = ring.map((a, i): Paint | null => {
    const b = ring[(i + 1) % n]
    const nx = (b[1] - a[1]) * sign,
      ny = -(b[0] - a[0]) * sign
    return nx + ny <= 1e-6 ? null : nx > ny ? 'side' : 'front'
  })
  let start = tone.findIndex((t, i) => t !== tone[(i + n - 1) % n])
  if (start < 0) start = 0
  const out: Wall[] = []
  for (let j = 0; j < n; j++) {
    const i = (start + j) % n,
      t = tone[i]
    if (!t) continue
    const last = out[out.length - 1]
    const prev = tone[(i + n - 1) % n]
    if (last && prev === t && j > 0) last.pts.push(ring[(i + 1) % n])
    else out.push({ pts: [ring[i], ring[(i + 1) % n]], tone: t })
  }
  const depth = (w: Wall) => w.pts.reduce((sum, [x, y]) => sum + x + y, 0) / w.pts.length
  return out.sort((p, q) => depth(p) - depth(q))
}

export function puzzle(
  k: number,
  {
    flown,
    lit,
    label,
  }: { flown: Record<ContinentId, boolean>; lit: ContinentId | null; label: string },
): IsoFigureData {
  const s = new Scene(k)
  s.poly(
    flat(
      [
        [-13, -12],
        [W + 16, -12],
        [W + 16, D + 24],
        [-13, D + 24],
      ],
      0,
    ),
    'shadow',
    'none',
  )
  const OUT = 9,
    FRONT = 17,
    IN = 2
  s.rbox(-OUT, -OUT, 0, W + 2 * OUT, D + OUT + FRONT, RIM, 5)
  s.poly(flat(roundRect(-IN, -IN, W + 2 * IN, D + 2 * IN, 2.5), RIM), 'front', 'crease')
  s.poly(
    [
      [-IN, -IN + 2.5, RIM],
      [-IN, D + IN - 2.5, RIM],
      [-IN, D + IN - 2.5, BED],
      [-IN, -IN + 2.5, BED],
    ],
    'side',
    'crease',
  )
  s.poly(
    [
      [-IN + 2.5, -IN, RIM],
      [W + IN - 2.5, -IN, RIM],
      [W + IN - 2.5, -IN, BED],
      [-IN + 2.5, -IN, BED],
    ],
    'side',
    'crease',
  )
  for (const [cx, cy] of [
    [-5.5, -5.5],
    [W + 5.5, -5.5],
    [-5.5, D + 5.5 + 3],
    [W + 5.5, D + 5.5 + 3],
  ]) {
    s.poly(s.circle([0, 0, RIM], X, Y, cx, cy, 1.5, 10), 'detail', 'crease')
    s.segs(
      [
        [
          [cx - 0.9, cy, RIM],
          [cx + 0.9, cy, RIM],
        ],
      ],
      'crease',
      0.7,
    )
  }
  if (label) {
    const px = W - 90,
      pw = 92,
      py = D + 6.5,
      pd = 10
    s.box(px, py, RIM, pw, pd, 0.7, { top: 'front', front: 'side', side: 'side' })
    s.text(label, [px + pw / 2, py + pd / 2 + 2.6, RIM + 0.7], X, Y, {
      size: 7,
      fill: 'muted',
      weight: 700,
      mono: true,
      anchor: 'middle',
    })
  }

  const vars = (id: ContinentId, lifts: boolean) => ({
    ...(lifts ? { '--lift-y': `${-LIFT_PX}px` } : {}),
    '--lit': id === lit ? '1' : '0',
  })
  const solid = (id: ContinentId, accent: boolean) => {
    if (accent)
      s.area(
        PLAN[id].flatMap((ring) => walls(ring, true).map(({ pts }) => s.pp(strip(pts, TOP, BED)))),
        'accent-side',
      )
    else
      for (const ring of PLAN[id])
        for (const { pts, tone } of walls(ring, true))
          s.poly(strip(pts, TOP, BED), tone, 'crease', undefined, 0.6)
    for (const ring of PLAN[id])
      s.poly(
        flat(ring, TOP),
        accent ? 'accent' : 'detail',
        accent ? 'accent' : 'line',
        undefined,
        1.3,
      )
  }
  const socket = (id: ContinentId) => {
    s.group(
      'floor',
      () => {
        for (const ring of PLAN[id]) s.poly(flat(ring, BED), 'shade', 'crease', undefined, 1.1)
      },
      { vars: { '--iso-shadow': 'var(--puzzle-floor)' } },
    )
    for (const ring of PLAN[id])
      for (const { pts, tone } of walls(ring, false)) s.poly(strip(pts, BED, FLOOR), tone, 'none')
  }

  for (const id of CONTINENT_IDS)
    s.group(flown[id] ? `socket-${id}` : `piece-${id}`, () => socket(id))
  const raised = PAINT_ORDER.filter((id) => flown[id])
  for (const id of raised)
    s.group(
      `shadow-${id}`,
      () => {
        for (const ring of PLAN[id]) s.poly(flat(ring, BED), 'shadow', 'none')
      },
      { vars: vars(id, false) },
    )
  for (const id of raised) s.group(`piece-${id}`, () => solid(id, false), { vars: vars(id, true) })
  if (lit)
    for (const id of PAINT_ORDER) {
      if (!flown[id]) {
        s.group(
          `lit-${id}`,
          () => {
            for (const r of PLAN[id]) s.poly(flat(r, BED), 'none', 'accent', undefined, 1.6)
          },
          { vars: vars(id, false) },
        )
        continue
      }
      s.group(
        `lit-${id}`,
        () => {
          s.glow(4, () => {
            for (const r of PLAN[id]) s.poly(flat(r, TOP), 'accent', 'none')
          })
          solid(id, true)
        },
        { vars: vars(id, true) },
      )
    }
  return s.done()
}
