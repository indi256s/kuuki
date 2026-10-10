import type { OverviewScope } from '@kuuki/shared/overview/figures'

export const pad = (value: number) => String(value).padStart(2, '0')
export const hhmm = (minute: number) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`

/** The departure-time facts the Clock card shows: the earliest and latest recorded departures, and the busiest hour. */
export function departures(scope: OverviewScope) {
  const records = scope.records.status === 'ready' ? scope.records.value : null
  return {
    earliest: records?.earliestDeparture ?? null,
    latest: records?.latestDeparture ?? null,
    peak: scope.clock.status === 'ready' ? scope.clock.value.peakHour : null,
  }
}
