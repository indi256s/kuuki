import { allianceAt } from '../../../data/src/alliance-membership'
import type { OverviewRow } from './model'
import { preciseDurationSamples } from './figures'
import { crossingTime } from './crossings'
import { absoluteClockShiftMinutes, dateInstant, recordExtrema, recordFlights } from './records'

const sum = (a: number | null, b: number | null) => a === null && b === null ? null : (a ?? 0) + (b ?? 0)

export function aggregateRows(rows: OverviewRow[]): OverviewRow[] {
  const groups = new Map<string, OverviewRow>()
  for (const row of rows) {
    const month = row.date.slice(0, 7)
    const hour = row.depMinute === null || !Number.isFinite(row.depMinute) || row.depMinute < 0 || row.depMinute > 1439
      ? null : Math.floor(row.depMinute / 60)
    const arrivalHour = row.arrMinute === null || !Number.isFinite(row.arrMinute) || row.arrMinute < 0 || row.arrMinute > 1439
      ? null : Math.floor(row.arrMinute / 60)
    // Keep filters, paired metrics and zone coverage identical; invalid dates cannot add to valid calendar evidence.
    const key = JSON.stringify([row.state, row.origin, row.destination, row.airline, row.aircraft,
      month, dateInstant(row.date) !== null, allianceAt(row.airline, row.date), hour, arrivalHour, row.durationSource, row.suppressed, row.originTz, row.destTz,
      row.distanceKm === null ? null : row.distanceKm / row.weight,
      row.durationMinutes === null ? null : row.durationMinutes > 0])
    const samples = preciseDurationSamples(row)
    const time = crossingTime(row)
    const group = groups.get(key)
    if (!group) {
      const first: OverviewRow = { ...row, preciseDurationSamples: samples, depMinute: hour === null ? null : hour * 60,
        arrMinute: arrivalHour === null ? null : arrivalHour * 60, flightNumber: null, departureUtc: null, recordExtrema: recordExtrema([row]),
        recordFlights: recordFlights([row]),
        clockShiftMinutes: absoluteClockShiftMinutes(row) }
      if (time) first.crossingTime = time
      if (!samples.length) delete first.preciseDurationSamples
      groups.set(key, first)
      continue
    }
    if (time) {
      const previous = group.crossingTime
      group.crossingTime = { forwardMinutes: (previous?.forwardMinutes ?? 0) + time.forwardMinutes,
        backMinutes: (previous?.backMinutes ?? 0) + time.backMinutes,
        offsets: [...new Set([...(previous?.offsets ?? []), ...time.offsets])].sort((a, b) => a - b) }
    }
    if (samples.length) (group.preciseDurationSamples ??= []).push(...samples)
    group.recordFlights = recordFlights([group, row])
    group.recordExtrema = recordExtrema([group, row])
    group.clockShiftMinutes = sum(group.clockShiftMinutes ?? null, absoluteClockShiftMinutes(row))
    if (row.date < group.date) group.date = row.date
    group.id = Math.min(group.id, row.id)
    group.weight += row.weight
    group.distanceKm = sum(group.distanceKm, row.distanceKm)
    group.durationMinutes = sum(group.durationMinutes, row.durationMinutes)
    group.zonesOverflown = sum(group.zonesOverflown, row.zonesOverflown)
  }
  for (const group of groups.values()) group.preciseDurationSamples?.sort((a, b) => a - b)
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
}
