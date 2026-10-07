import type { OverviewRow } from './model'

const sum = (a: number | null, b: number | null) => a === null && b === null ? null : (a ?? 0) + (b ?? 0)

export function aggregateRows(rows: OverviewRow[]): OverviewRow[] {
  const groups = new Map<string, OverviewRow>()
  for (const row of rows) {
    const month = row.date.slice(0, 7)
    const hour = row.depMinute === null ? null : Math.floor(row.depMinute / 60)
    const key = JSON.stringify([row.state, row.origin, row.destination, row.airline, row.aircraft,
      month, hour, row.durationSource, row.suppressed])
    const group = groups.get(key)
    if (!group) {
      groups.set(key, { ...row, date: `${month}-01`, depMinute: hour === null ? null : hour * 60,
        flightNumber: null, departureUtc: null })
      continue
    }
    group.id = Math.min(group.id, row.id)
    group.weight += row.weight
    group.distanceKm = sum(group.distanceKm, row.distanceKm)
    group.durationMinutes = sum(group.durationMinutes, row.durationMinutes)
    group.zonesOverflown = sum(group.zonesOverflown, row.zonesOverflown)
    if (group.originTz !== row.originTz) group.originTz = null
    if (group.destTz !== row.destTz) group.destTz = null
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
}
