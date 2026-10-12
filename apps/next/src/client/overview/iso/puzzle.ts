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

/** How far a pick lifts a piece out of the tray, in px (not scaled by k: the card's motion is a fixed 4px). */
const LIFT_PX = 4,
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
 * Parts, in a fixed order whatever is lit, so no element ever moves in the DOM (a moved element loses its CSS transitions):
 * `socket-<id>` (the hole under a flown piece, which stays when the piece lifts) or `piece-<id>` (an unflown continent's empty socket);
 * `piece-<id>` for a flown one (the raised piece at rest); then, when `lit` is set, one `lit-<id>` per continent on top of everything.
 * A flown `lit-<id>` is the accent copy of its piece with the glow; an unflown one is the socket outline in the accent. The lit one has `--lit: 1`
 * and the rest 0 (puzzle.css fades the overlays on it, and lifts the lit flown piece and its overlay together by `--lift-y`).
 * Painting the overlays after every rest piece is what makes the lit piece pass over its neighbours as it lifts.
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
  const vars = (id: ContinentId, lifts: boolean) => ({
    ...(lifts ? { '--lift-y': `${-LIFT_PX}px` } : {}),
    '--lit': id === lit ? '1' : '0',
  })

  for (const id of CONTINENT_IDS)
    s.group(flown[id] ? `socket-${id}` : `piece-${id}`, () => layer(id, T, 'glass', 'detail', 1.6))
  const raised = PAINT_ORDER.filter((id) => flown[id])
  for (const id of raised)
    s.group(
      `piece-${id}`,
      () => {
        layer(id, T, 'side', 'line', 1.8)
        layer(id, R, 'detail', 'line', 1.6)
      },
      { vars: vars(id, true) },
    )
  if (lit)
    for (const id of PAINT_ORDER) {
      if (!flown[id]) {
        s.group(
          `lit-${id}`,
          () => {
            for (const r of plan(id)) s.poly(flat(r, T), 'none', 'accent', undefined, 1.6)
          },
          { vars: vars(id, false) },
        )
        continue
      }
      s.group(
        `lit-${id}`,
        () => {
          layer(id, T, 'accent-side', 'line', 1.8)
          s.glow(4, () => {
            for (const r of plan(id)) s.poly(flat(r, R), 'accent', 'none')
          })
          layer(id, R, 'accent', 'accent', 1.6)
        },
        { vars: vars(id, true) },
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
