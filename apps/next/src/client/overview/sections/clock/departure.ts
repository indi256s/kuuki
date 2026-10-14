import type { OverviewScope } from '@kuuki/shared/overview/figures'

const pad = (value: number) => String(value).padStart(2, '0')
export const hhmm = (minute: number) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`

/**
 * The departure-time facts the Clock card shows: the earliest and latest recorded departures, the busiest hour,
 * and the headline time (the earliest departure, else the busiest hour on the hour).
 */
export function departures(scope: OverviewScope) {
  const records = scope.records.status === 'ready' ? scope.records.value : null
  const earliest = scope.clock.status === 'ready' ? scope.clock.value.earliestDeparture : null,
    peak = scope.clock.status === 'ready' ? scope.clock.value.peakHour : null
  return {
    earliest,
    latest: records?.latestDeparture ?? null,
    peak,
    time: earliest ? hhmm(earliest.depMinute) : peak ? hhmm(peak.hour * 60) : null,
  }
}
