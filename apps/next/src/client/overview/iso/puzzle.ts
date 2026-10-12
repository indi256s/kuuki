import { CONTINENT_RINGS } from './continents.generated'
import { X, Y, flat } from './flat'
import { Scene, type IsoFigureData, type Paint, type Pt } from './scene'

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

/** How far a pick lifts a piece out of the tray, in iso units. */
const LIFT = 5,
  SC = 0.6,
  LAT0 = 84,
  LAT1 = -84,
  T = 4,
  R = 6.5

/** Plan rings (lon, lat flattened) of a continent as tray coordinates. */
const plan = (id: ContinentId): Pt[][] =>
  RINGS[id].map((flatRing) => {
    const ring: Pt[] = []
    for (let i = 0; i < flatRing.length; i += 2)
      ring.push([(flatRing[i] + 180) * SC, (LAT0 - flatRing[i + 1]) * SC])
    return ring
  })

/**
 * Continents: a world-map jigsaw in its tray. A flown continent is a raised piece in place; one not flown is an empty socket.
 * Parts: `piece-<id>` for every continent (the raised piece, or for one not flown its empty socket), plus `socket-<id>` for a flown one (the hole under its piece, which stays when the piece lifts). A flown piece's group carries `--lift-y`, the lift in px (negative: up).
 * Painter's order: sockets, then raised pieces far to near, the lit one last. The lit piece takes the accent and glow; a lit continent not flown outlines its socket in the accent instead.
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
  const W = 360 * SC,
    D = (LAT0 - LAT1) * SC
  s.poly(
    flat(
      [
        [-12, -10],
        [W + 14, -10],
        [W + 14, D + 14],
        [-12, D + 14],
      ],
      0,
    ),
    'shadow',
    'none',
  )
  s.rbox(-9, -9, 0, W + 18, D + 18, 4, 4, { top: 'front' })
  /** A continent's outline without its internal borders: stroked wide, then filled over. */
  const layer = (id: ContinentId, z: number, fill: Paint, stroke: Paint, width: number) => {
    const rings = plan(id)
    for (const r of rings) s.poly(flat(r, z), fill, stroke, undefined, width)
    for (const r of rings) s.poly(flat(r, z), fill, 'none')
  }
  const socket = (id: ContinentId) =>
    layer(id, T, 'glass', id === lit && !flown[id] ? 'accent' : 'detail', 1.6)
  const [, liftY] = s.vector(0, 0, LIFT)

  // Sockets first, the lit empty one last among them so its outline is not overdrawn.
  const sockets = CONTINENT_IDS.filter((id) => id !== lit || flown[id]).concat(
    lit && !flown[lit] ? [lit] : [],
  )
  for (const id of sockets) s.group(flown[id] ? `socket-${id}` : `piece-${id}`, () => socket(id))
  // Raised pieces, the lit one last so it passes over its neighbours as it lifts.
  const raised = PAINT_ORDER.filter((id) => flown[id] && id !== lit).concat(
    lit && flown[lit] ? [lit] : [],
  )
  for (const id of raised) {
    const hot = id === lit
    s.group(
      `piece-${id}`,
      () => {
        layer(id, T, hot ? 'accent-side' : 'side', 'line', 1.8)
        if (hot)
          s.glow(4, () => {
            for (const r of plan(id)) s.poly(flat(r, R), 'accent', 'none')
          })
        layer(id, R, hot ? 'accent' : 'detail', hot ? 'accent' : 'line', 1.6)
      },
      { vars: { '--lift-y': `${liftY}px` } },
    )
  }
  // A frame label, and the count where a tray would print its contents.
  s.text(label, [W + 4, D + 9, T], X, Y, {
    size: 6,
    fill: 'muted',
    weight: 700,
    mono: true,
    anchor: 'end',
  })
  return s.done()
}
