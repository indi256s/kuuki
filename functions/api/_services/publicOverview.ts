import { coordinates } from '../../../packages/shared/src/geo'
import { computeOverview } from '../../../packages/shared/src/overview/compute'
import type { RecordRef } from '../../../packages/shared/src/overview/model'
import { parsePrefs } from '../../../packages/shared/src/overview/prefs'
import type { PublicOverview } from '../../../packages/shared/src/overview/public'
import { readOverviewData } from './overviewData'

function publicRecord(ref: RecordRef | null) {
  return ref ? { origin: ref.origin, destination: ref.destination, value: ref.value } : null
}

export async function readPublicOverview(db: D1Database, username: string): Promise<PublicOverview | null> {
  const profile = await db.prepare('SELECT id, is_public FROM profiles WHERE lower(username) = lower(?) LIMIT 1')
    .bind(username).first<{ id: string; is_public: number }>()
  if (!profile?.is_public) return null
  const ownerId = profile.id
  const payload = await readOverviewData(db, ownerId)
  // Recheck visibility and section consent after the private read, as publicProfiles does.
  const current = await db.prepare('SELECT is_public, overview_prefs FROM profiles WHERE id = ?').bind(ownerId)
    .first<{ is_public: number; overview_prefs: string | null }>()
  if (!current?.is_public) return null
  const prefs = parsePrefs(current.overview_prefs)
  const scope = computeOverview(payload, {})
  const result: PublicOverview = {
    routes: scope.globe.routes.map(({ a, b }): [string, string] => [a, b])
      .sort(([a, b], [c, d]) => a < c ? -1 : a > c ? 1 : b < d ? -1 : b > d ? 1 : 0),
    airports: Object.fromEntries(scope.globe.airports.map(({ iata }) => [iata, coordinates(payload.refs.airports[iata])] as const)
      .filter((entry): entry is readonly [string, { lat: number; lon: number }] => entry[1] !== null)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)),
  }
  if (prefs.publicSections.records && scope.records.status === 'ready') {
    const records = scope.records.value
    result.records = {
      longest: publicRecord(records.longest), shortest: publicRecord(records.shortest),
      longestDuration: publicRecord(records.longestDuration), shortestDuration: publicRecord(records.shortestDuration),
      biggestClockJump: publicRecord(records.biggestClockJump),
      northernmost: records.northernmost ? { iata: records.northernmost.iata, lat: records.northernmost.lat } : null,
      southernmost: records.southernmost, longestStreakMonths: records.longestStreakMonths,
    }
  }
  if (prefs.publicSections.fleet && scope.fleet.status === 'ready') {
    const fleet = scope.fleet.value
    result.fleet = { topType: fleet.topType, byBodyType: fleet.byBodyType, byManufacturer: fleet.byManufacturer,
      families: fleet.families, types: fleet.types, typed: fleet.typed, total: fleet.total }
  }
  return result
}
