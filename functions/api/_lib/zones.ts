import tzLookup from '@photostructure/tz-lookup'
import { greatCirclePoints, type LatLon } from '../../../packages/shared/src/geo'
import { utcOffsetMinutes } from '../../../packages/shared/src/timezones'

export function zoneAt(p: LatLon): string {
  return tzLookup(p.lat, p.lon)
}

export function zonesOverflown(a: LatLon, b: LatLon, instant: Date): number {
  let previous: number | null = null
  let changes = 0
  for (const sample of greatCirclePoints(a, b, 50)) {
    const offset = utcOffsetMinutes(zoneAt(sample), instant)
    if (offset === null) continue
    if (previous !== null && offset !== previous) changes++
    previous = offset
  }
  return changes
}
