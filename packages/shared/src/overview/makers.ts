import { MAKER_SLOTS, makerOf, type MakerKey } from '../../../data/src/aircraft-makers'
import { coverage, totals, type Gate } from './figures'
import type { OverviewPayload, OverviewRow } from './model'

interface MakerMetrics {
  flights: number
  minutes: number
  km: number
}
export interface Makers {
  rows: Array<MakerMetrics & { key: MakerKey }>
  other: Array<MakerMetrics & { key: string; family: string }>
  totals: MakerMetrics & { minutesApproximate: boolean }
  flights: Array<{
    key: string
    flightId: number
    maker: MakerKey
    origin: string
    destination: string
    date: string
    aircraft: string | null
    durationMinutes: number | null
  }>
}

export function makers(
  rows: OverviewRow[],
  refs: OverviewPayload['refs'],
  mode: OverviewPayload['mode'],
): Gate<Makers> {
  const { typed } = coverage(rows)
  if (typed < 5) return { status: 'below', have: typed, need: 5 }
  const slots: Makers['rows'] = MAKER_SLOTS.map((key) => ({ key, flights: 0, minutes: 0, km: 0 }))
  const families = new Map<string, Makers['other'][number]>()
  for (const row of rows) {
    const maker = makerOf(row.aircraft)
    const slot = slots[MAKER_SLOTS.indexOf(maker)]
    const metrics = totals([row])
    slot.flights += metrics.flights
    slot.minutes += metrics.durationMinutes
    slot.km += metrics.distanceKm
    const family = row.aircraft ? refs.aircraft[row.aircraft]?.family : null
    if (maker === 'other' && family) {
      const item = families.get(family) ?? { key: family, family, flights: 0, minutes: 0, km: 0 }
      item.flights += metrics.flights
      item.minutes += metrics.durationMinutes
      item.km += metrics.distanceKm
      families.set(family, item)
    }
  }
  const sum = totals(rows)
  return {
    status: 'ready',
    value: {
      rows: slots,
      other: [...families.values()].sort(
        (a, b) => b.flights - a.flights || a.key.localeCompare(b.key),
      ),
      totals: {
        flights: sum.flights,
        minutes: sum.durationMinutes,
        km: sum.distanceKm,
        minutesApproximate: rows.some(
          (row) =>
            row.durationSource === 'estimate' &&
            row.durationMinutes !== null &&
            Number.isFinite(row.durationMinutes) &&
            row.durationMinutes >= 0,
        ),
      },
      flights:
        mode === 'aggregate'
          ? []
          : rows
              .map((row) => ({
                key: String(row.id),
                flightId: row.id,
                maker: makerOf(row.aircraft),
                origin: row.origin,
                destination: row.destination,
                date: row.date,
                aircraft: row.aircraft,
                durationMinutes: row.durationMinutes,
              }))
              .sort(
                (a, b) =>
                  MAKER_SLOTS.indexOf(a.maker) - MAKER_SLOTS.indexOf(b.maker) ||
                  a.date.localeCompare(b.date) ||
                  a.flightId - b.flightId,
              ),
    },
  }
}
