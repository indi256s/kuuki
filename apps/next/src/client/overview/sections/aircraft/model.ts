import type { MakerKey } from '@kuuki/data/aircraft-makers'
import type { Makers } from '@kuuki/shared/overview/makers'
import type { Shed } from '../../iso/hangars'

export type MakerRow = {
  key: MakerKey
  flights: number
  km: number
  minutes: number
  share: number
}

/** Share of flights as the chapter prints it; a share that rounds to nothing is still not zero. */
export const shareText = (share: number) =>
  share > 0 && share < 0.005 ? '<1%' : `${Math.round(share * 100)}%`

/**
 * The makers with flights, the most flown first and Unknown last. Every share uses all selected flights,
 * including those whose maker is unknown.
 */
export function makerRows(data: Makers) {
  const live = data.rows.filter((row) => row.flights > 0)
  const known = live.filter((row) => row.key !== 'unknown')
  const total = live.reduce((sum, row) => sum + row.flights, 0)
  const order = (key: MakerKey) => data.rows.findIndex((row) => row.key === key)
  const rows: MakerRow[] = [
    ...known.sort((a, b) => b.flights - a.flights || order(a.key) - order(b.key)),
    ...live.filter((row) => row.key === 'unknown'),
  ].map((row) => ({ ...row, share: total ? row.flights / total : 0 }))
  return { rows, total }
}

export type ShedPlan = {
  /** At most three, the largest first. */
  sheds: Shed[]
  /** The shed that carries a maker's flights; null for Unknown, which has no hangar. */
  shedOf(maker: MakerKey): string | null
  /** Nothing to draw yet: placeholder sheds with no shares. */
  blank: boolean
}

const PLACEHOLDER: Shed[] = [
  { key: 'airbus', name: 'AIRBUS', share: 0.59 },
  { key: 'boeing', name: 'BOEING', share: 0.31 },
  { key: 'other', name: 'OTHER', share: 0.1 },
]

/**
 * The hangars: the makers themselves while they fit in three sheds, otherwise the two most flown named makers and one
 * "Other" shed for every other maker (Other included). A maker with no shed of its own lights the Other shed.
 */
export function planSheds(
  rows: readonly MakerRow[],
  name: (key: MakerKey) => string,
  locale: 'en' | 'ru',
): ShedPlan {
  const known = rows.filter((row) => row.key !== 'unknown')
  if (!known.length)
    return {
      sheds: PLACEHOLDER.map((shed) => ({
        ...shed,
        name: locale === 'ru' && shed.key === 'other' ? 'ДРУГИЕ' : shed.name,
      })),
      shedOf: () => null,
      blank: true,
    }
  const named = known.filter((row) => row.key !== 'other')
  const other = known.filter((row) => row.key === 'other')
  const own = named.length + other.length <= 3 ? named : named.slice(0, 2)
  const rest = known.filter((row) => !own.includes(row))
  const shed = (key: string, label: string, share: number): Shed => ({
    key,
    name: label.toUpperCase(),
    share,
  })
  const sheds = [
    ...own.map((row) => shed(row.key, name(row.key), row.share)),
    ...(rest.length
      ? [
          shed(
            'other',
            name('other'),
            rest.reduce((sum, row) => sum + row.share, 0),
          ),
        ]
      : []),
  ].sort((a, b) => b.share - a.share)
  return {
    sheds,
    shedOf: (maker) =>
      maker === 'unknown' ? null : own.some((row) => row.key === maker) ? maker : 'other',
    blank: false,
  }
}
