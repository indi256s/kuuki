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

/** Far to near, so neighbours overlap the way their raised edges do on a tray. */
const PAINT_ORDER: readonly ContinentId[] = [
  'north-america',
  'europe',
  'asia',
  'south-america',
  'africa',
  'oceania',
  'antarctica',
]

/** How far a pick lifts a piece out of the tray, in px (not scaled by k: the card's motion is a fixed 4px). */
const LIFT_PX = 4,
  // Plan scale: degrees to plan units.
  SC = 0.6,
  LAT0 = 84,
  // Tray depths along z: the rim top, the bed the sockets are cut into, the socket floor, and a piece's top.
  RIM = 7.5,
  BED = 3,
  FLOOR = 0.8,
  TOP = 6.5,
  W = 360 * SC,
  D = 112

/**
 * Plan rings (lon, lat flattened) of a continent as tray coordinates. Antarctica is a strip 84° wide in latitude on a map, which reads as a scratch:
 * it is drawn as a compact piece at the bottom instead, its width squeezed to a quarter and its height stretched into the tray's last band.
 */
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

/** A wall ribbon: the points at height `hi`, then back along `lo`. */
const strip = (pts: readonly Pt[], hi: number, lo: number): P3[] => [
  ...pts.map(([x, y]): P3 => [x, y, hi]),
  ...[...pts].reverse().map(([x, y]): P3 => [x, y, lo]),
]

/** A run of neighbouring wall facets of one tone, as the coastline points they span, in ring order. */
type Wall = { pts: Pt[]; tone: Paint }
/**
 * The walls of a ring that face the viewer (`outside`: a raised piece's faces) or the far walls of a hole, whose inner faces face the viewer (`!outside`),
 * far to near. Tones follow a box: faces toward +x take `side`, toward +y `front`. Neighbouring facets of one tone are one polygon, as a prism merges its up-facing facets.
 */
function walls(ring: Pt[], outside: boolean): Wall[] {
  const n = ring.length
  const area = ring.reduce((sum, [x, y], i) => {
    const [x2, y2] = ring[(i + 1) % n]
    return sum + x * y2 - x2 * y
  }, 0)
  // Outward normal; flipped for a hole, whose visible wall is the far one.
  const sign = (area > 0 ? 1 : -1) * (outside ? 1 : -1)
  const tone = ring.map((a, i): Paint | null => {
    const b = ring[(i + 1) % n]
    const nx = (b[1] - a[1]) * sign,
      ny = -(b[0] - a[0]) * sign
    return nx + ny <= 1e-6 ? null : nx > ny ? 'side' : 'front'
  })
  // Start the walk where a run begins, so no run is split by the ring's first point.
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

/**
 * Continents: a world-map jigsaw in its tray. A flown continent is a raised piece in place; one not flown is an empty socket.
 * Parts, in a fixed order whatever is lit, so no element ever moves in the DOM (a moved element loses its CSS transitions):
 * `socket-<id>` (the hole under a flown piece, which stays when the piece lifts) or `piece-<id>` (an unflown continent's empty socket);
 * then one `shadow-<id>` per flown continent (the soft shadow the lifted piece casts on the bed); `piece-<id>` for a flown one (the raised piece at rest);
 * then, when `lit` is set, one `lit-<id>` per continent on top of everything.
 * A flown `lit-<id>` is the accent copy of its piece (walls and top, with the glow); an unflown one is the socket outline in the accent. The lit one has `--lit: 1`
 * and the rest 0 (puzzle.css fades the overlays on it, lifts the lit flown piece and its overlay together by `--lift-y`, and fades its shadow in).
 * Painting the overlays after every rest piece is what makes the lit piece pass over its neighbours as it lifts.
 * The tray: a rim with a bed recessed into it, corner screws and a label plate for the count. Each socket is a real recess: a floor (`floor`, which puzzle.css
 * paints darker than the card's shadow so an empty socket reads in both themes) and the far walls you see into.
 */
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
  // The tray: its rim, then the bed recessed into it (far inner walls), corner screws and the label plate.
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
  /** A piece's exterior walls (BED up to TOP) and its top face. The accent copy's walls are one path (one tone, no creases): it is there for the lift, so it stays light. */
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
    // The floor is painted at the rim of the opening and the far walls hang inside it, so nothing spills onto the bed.
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
