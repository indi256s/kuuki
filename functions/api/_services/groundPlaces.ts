// Ground-travel place picker: bounded prefix search over the GeoNames catalog (ground_places /
// ground_place_names) plus the owner's private manual places (ground_manual_places).
// Contract: .scratch/ground-travel/places-contract.md. Keep the key helpers free of runtime imports other
// than the shared folding, because scripts/generate-geonames-places.ts builds the catalog keys with them.
import {
  GROUND_LIMITS,
  isUuid,
  type GroundPlaceOption,
  type GroundPlaceSnapshot,
  type ManualPlaceInput,
} from '../../../packages/shared/src/groundTravel'
import { foldSearchText } from '../../../packages/shared/src/airportSearch'
import { nowIso } from '../_lib/time'

const BUCKET_MAX_CHARS = 3
/** Longest key stored or queried; longer input is cut so one request cannot build an unbounded range. */
const MAX_KEY_CHARS = 64
/** Highest code point: every real key starting with the query sorts below `query + MAX_CODE_POINT`. */
const MAX_CODE_POINT = '\u{10FFFF}'
/** Rows read per catalog bucket query. Aliases of one place collapse afterwards, so over-fetch ×5. */
const BUCKET_FETCH = GROUND_LIMITS.searchResults * 5
const MANUAL_LIST_LIMIT = 1000

/**
 * Search/storage key of a place name: case- and diacritic-folded (`foldSearchText`), punctuation and
 * hyphens turned into single spaces ("Coeur d'Alene" → "coeur d alene"), trimmed. Catalog rows and queries
 * must use this same function.
 */
export function placeNameKey(text: string): string {
  return Array.from(
    foldSearchText(text)
      .replace(/[\p{P}\p{S}\s]+/gu, ' ')
      .trim(),
  )
    .slice(0, MAX_KEY_CHARS)
    .join('')
}

/** Bucket of a key: its first three characters (the whole key when shorter). */
export function placePrefix(key: string): string {
  return Array.from(key).slice(0, BUCKET_MAX_CHARS).join('')
}

interface CatalogNameRow {
  geoname_id: number
  name_key?: string
}

interface CatalogPlaceRow {
  geoname_id: number
  name: string
  name_ru: string | null
  name_en: string | null
  country_code: string
  region: string | null
  region_ru: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  catalog_version: string
}

interface ManualPlaceRow {
  id: string
  user_id?: string
  name: string
  name_key?: string
  country_code: string
  latitude: number | null
  longitude: number | null
  timezone: string | null
}

/** Statements behind one catalog lookup. Exported so tests can EXPLAIN the exact SQL that runs. */
export const catalogSql = {
  exact:
    'SELECT geoname_id FROM ground_place_names WHERE name_key = ? ORDER BY population DESC LIMIT ?',
  bucket:
    'SELECT geoname_id, name_key FROM ground_place_names WHERE prefix = ? AND name_key >= ? AND name_key < ? ORDER BY population DESC LIMIT ?',
  range:
    'SELECT geoname_id, name_key FROM ground_place_names WHERE name_key >= ? AND name_key < ? ORDER BY population DESC LIMIT ?',
  manual:
    'SELECT id, name, name_key, country_code, latitude, longitude, timezone FROM ground_manual_places WHERE user_id = ? AND name_key >= ? AND name_key < ? ORDER BY name_key, id LIMIT ?',
  places: (count: number) =>
    `SELECT geoname_id, name, name_ru, name_en, country_code, region, region_ru, latitude, longitude, timezone, catalog_version FROM ground_places WHERE geoname_id IN (${Array(count).fill('?').join(',')})`,
} as const

const catalogOption = (row: CatalogPlaceRow): GroundPlaceOption => ({
  source: 'geonames',
  id: String(row.geoname_id),
  name: row.name,
  nameRu: row.name_ru,
  nameEn: row.name_en,
  countryCode: row.country_code,
  region: row.region,
  regionRu: row.region_ru,
  lat: row.latitude,
  lon: row.longitude,
  timezone: row.timezone,
  catalogVersion: row.catalog_version,
})

const manualSnapshot = (row: ManualPlaceRow): GroundPlaceSnapshot => ({
  source: 'manual',
  id: row.id,
  name: row.name,
  nameRu: null,
  nameEn: null,
  countryCode: row.country_code,
  region: null,
  lat: row.latitude,
  lon: row.longitude,
  timezone: row.timezone,
  catalogVersion: null,
})

/**
 * Up to GROUND_LIMITS.searchResults places for a typed query: the owner's own manual places and catalog
 * matches, exact-name matches first (manual before catalog), then prefix matches (manual, then by
 * population). One catalog bucket is read per keystroke; an empty or unloaded catalog just yields manual
 * matches. A query under GROUND_LIMITS.searchMinChars folded characters returns nothing.
 */
export async function searchGroundPlaces(
  db: D1Database,
  ownerId: string,
  rawQuery: string,
  limit: number = GROUND_LIMITS.searchResults,
): Promise<GroundPlaceOption[]> {
  const key = placeNameKey(rawQuery)
  if (Array.from(key).length < GROUND_LIMITS.searchMinChars) return []
  const upper = key + MAX_CODE_POINT

  // Up to three characters a bucket holds every match in population order, so the scan stops after the
  // limit. Longer keys narrow the bucket to a handful of rows, so seek the key range instead: it reads
  // only the matches (worst measured: ~2.3k keys for "sant") where the bucket walk could read all ~7.6k.
  const narrow = Array.from(key).length >= BUCKET_MAX_CHARS + 1
  const [exact, bucket, manual] = await db.batch([
    db.prepare(catalogSql.exact).bind(key, limit),
    narrow
      ? db.prepare(catalogSql.range).bind(key, upper, BUCKET_FETCH)
      : db.prepare(catalogSql.bucket).bind(placePrefix(key), key, upper, BUCKET_FETCH),
    db.prepare(catalogSql.manual).bind(ownerId, key, upper, limit),
  ])
  const exactIds = (exact.results as CatalogNameRow[]).map((row) => row.geoname_id)
  const prefixIds = (bucket.results as CatalogNameRow[]).map((row) => row.geoname_id)
  const manualRows = manual.results as ManualPlaceRow[]

  const catalogIds = [...new Set([...exactIds, ...prefixIds])]
  const places = new Map<number, GroundPlaceOption>()
  if (catalogIds.length > 0) {
    const rows = await db
      .prepare(catalogSql.places(catalogIds.length))
      .bind(...catalogIds)
      .all<CatalogPlaceRow>()
    for (const row of rows.results) places.set(row.geoname_id, catalogOption(row))
  }

  const manualExact = manualRows.filter((row) => row.name_key === key)
  const manualPrefix = manualRows.filter((row) => row.name_key !== key)
  const ordered: GroundPlaceOption[] = [
    ...manualExact.map(manualSnapshot),
    ...exactIds.flatMap((id) => places.get(id) ?? []),
    ...manualPrefix.map(manualSnapshot),
    ...prefixIds.flatMap((id) => places.get(id) ?? []),
  ]
  const seen = new Set<string>()
  const out: GroundPlaceOption[] = []
  for (const option of ordered) {
    const identity = `${option.source}:${option.id}`
    if (seen.has(identity)) continue
    seen.add(identity)
    out.push(option)
    if (out.length >= limit) break
  }
  return out
}

/** The owner's manual places for reselection, by name. */
export async function listManualPlaces(
  db: D1Database,
  ownerId: string,
): Promise<GroundPlaceSnapshot[]> {
  const rows = await db
    .prepare(
      'SELECT id, name, country_code, latitude, longitude, timezone FROM ground_manual_places WHERE user_id = ? ORDER BY name_key, id LIMIT ?',
    )
    .bind(ownerId, MANUAL_LIST_LIMIT)
    .all<ManualPlaceRow>()
  return rows.results.map(manualSnapshot)
}

const TIMEZONE_SHAPE = /^(?:UTC|[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+)$/

function validTimezone(value: string): boolean {
  if (value.length > 64 || !TIMEZONE_SHAPE.test(value)) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** Validate a POST body into a ManualPlaceInput; the error is a safe client-facing message. */
export function parseManualPlaceInput(
  body: unknown,
): { ok: true; input: ManualPlaceInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return { ok: false, error: 'Body must be an object' }
  const v = body as Record<string, unknown>
  const id = v.id
  if (!isUuid(id)) return { ok: false, error: 'id must be a UUID' }
  if (typeof v.name !== 'string') return { ok: false, error: 'name is required' }
  const name = v.name.trim()
  if (
    name.length < 1 ||
    name.length > GROUND_LIMITS.placeName ||
    /[\p{Cc}\p{Cf}]/u.test(name) ||
    placeNameKey(name) === ''
  )
    return { ok: false, error: 'name is invalid' }
  if (typeof v.countryCode !== 'string' || !/^[A-Z]{2}$/.test(v.countryCode))
    return { ok: false, error: 'countryCode is invalid' }

  const lat = v.lat ?? null
  const lon = v.lon ?? null
  if ((lat === null) !== (lon === null)) return { ok: false, error: 'lat and lon go together' }
  if (
    lat !== null &&
    (typeof lat !== 'number' ||
      typeof lon !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180)
  )
    return { ok: false, error: 'coordinates are out of range' }

  const timezone = v.timezone ?? null
  if (timezone !== null && (typeof timezone !== 'string' || !validTimezone(timezone)))
    return { ok: false, error: 'timezone must be an IANA zone' }

  return {
    ok: true,
    input: {
      id: id.toLowerCase(),
      name,
      countryCode: v.countryCode,
      lat: lat as number | null,
      lon: lon as number | null,
      timezone: timezone as string | null,
    },
  }
}

export type ManualPlaceResult =
  | { kind: 'created' | 'existing'; place: GroundPlaceSnapshot }
  | { kind: 'conflict' }

/**
 * Idempotent create by client id. The same owner replaying the same payload gets the stored place; a
 * different payload, or an id held by anyone else, is a conflict that discloses nothing about the other row.
 */
export async function createManualPlace(
  db: D1Database,
  ownerId: string,
  input: ManualPlaceInput,
): Promise<ManualPlaceResult> {
  const inserted = await db
    .prepare(
      'INSERT OR IGNORE INTO ground_manual_places (id, user_id, name, name_key, country_code, latitude, longitude, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      input.id,
      ownerId,
      input.name,
      placeNameKey(input.name),
      input.countryCode,
      input.lat,
      input.lon,
      input.timezone,
      nowIso(),
    )
    .run()
  const row = await db
    .prepare(
      'SELECT id, user_id, name, country_code, latitude, longitude, timezone FROM ground_manual_places WHERE id = ?',
    )
    .bind(input.id)
    .first<ManualPlaceRow>()
  if (!row || row.user_id !== ownerId) return { kind: 'conflict' }
  const place = manualSnapshot(row)
  if (inserted.meta.changes === 1) return { kind: 'created', place }
  const same =
    place.name === input.name &&
    place.countryCode === input.countryCode &&
    place.lat === input.lat &&
    place.lon === input.lon &&
    place.timezone === input.timezone
  return same ? { kind: 'existing', place } : { kind: 'conflict' }
}
