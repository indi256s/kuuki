// Supabase snapshot -> explicitly selected, isolated LOCAL Cloudflare D1.
// Plan by default; --apply inserts missing rows only after source/target preflight.
// Remote transfer is separately reviewed through remote-migration-proposal.ts.
//
// Column lists are driven from db/_snapshot/_schema.json (the LIVE information_schema),
// rather than historical frontend types. The live `flights` table has 20 columns
// and NO `aircraft_lookup_attempts`; that column exists ONLY in the D1 target schema
// (db/migrations/0001_init.sql, INTEGER NOT NULL DEFAULT 0). The flights INSERT OMITS it
// and relies on the D1 DEFAULT 0.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openLocalTarget, parseLocalTarget } from './migration-target'
import { TABLES as ORACLE_TABLES, buildRows as buildOracleRows } from './ship-oracle'

// Reuse the REAL canonical timestamp normalizer and the REAL password verifier — do NOT
// reimplement them. normalizeIso turns Postgres timestamptz into YYYY-MM-DDTHH:MM:SS.sssZ.
import { normalizeIso } from '../functions/api/_lib/time'
import { verifyPassword } from '../functions/api/_lib/crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_DIR = join(__dirname, '..', 'db', '_snapshot')

// ---------------------------------------------------------------------------
// Snapshot JSON shapes (raw Postgres rows as serialized by the snapshot tool).
// ---------------------------------------------------------------------------

interface AuthUserRow {
  id: string
  email: string
  created_at: string
}

interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  home_airport: string | null
  is_public: boolean
  show_on_leaderboards: boolean
  gemini_api_key: string | null
  locale: string | null
  created_at: string
  updated_at: string
  theme_color: string | null
}

interface FlightRow {
  id: number
  user_id: string
  flight_number: string | null
  date: string
  departure_time: string | null
  arrival_time: string | null
  origin: string
  destination: string
  airline_iata: string | null
  aircraft_icao: string | null
  distance_km: number | null
  duration_minutes: number | null
  source: string
  created_at: string
  is_upcoming: boolean
  origin_tz: string | null
  dest_tz: string | null
  departure_utc: string | null
  arrival_utc: string | null
  enrichment_status: string
}

interface CountryClaimRow {
  id: string
  user_id: string
  country_code: string
  claimed_at: string
}

interface GroundVisitRow {
  id: string
  user_id: string
  country_code: string
  visit_year: number | null
  entry_method: string | null
  note: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSnapshot<T>(name: string, snapshotDir = SNAPSHOT_DIR): T[] {
  const path = join(snapshotDir, `${name}.json`)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as T[]
  if (!Array.isArray(parsed)) {
    throw new Error(`Snapshot ${name}.json did not parse to an array`)
  }
  return parsed
}

/** Postgres BOOLEAN -> SQLite INTEGER 0/1. Throws on anything that is not a boolean. */
function boolToInt(value: boolean, ctx: string): number {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected boolean for ${ctx}, got ${typeof value}: ${JSON.stringify(value)}`)
  }
  return value ? 1 : 0
}

/** NUMERIC/DECIMAL -> REAL (JS number) or null. Throws on non-number, non-null. */
function decimalToReal(value: number | null, ctx: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Expected finite numeric for ${ctx}, got ${JSON.stringify(value)}`)
  }
  return value
}

/** Required timestamptz -> canonical ISO. Throws if normalizeIso returns null (invalid). */
function tsRequired(value: string, ctx: string): string {
  const iso = normalizeIso(value)
  if (iso === null) {
    throw new Error(`Required timestamp ${ctx} normalized to null from ${JSON.stringify(value)}`)
  }
  return iso
}

/** Optional timestamptz -> canonical ISO or null. */
function tsOptional(value: string | null | undefined): string | null {
  return normalizeIso(value)
}

const PASSWORD_PLACEHOLDER = 'RESET_REQUIRED'

// Bind-variable budget per D1 statement = 100; rowsPerInsert = floor(100 / numCols).
function rowsPerInsert(numCols: number): number {
  return Math.floor(100 / numCols)
}

type Bind = string | number | null

/**
 * Build chunked INSERT statements for a table. Each chunk packs up to
 * floor(100 / numCols) rows so no statement exceeds D1's 100-variable limit.
 * Pattern mirrors functions/api/_services/leaderboard.ts.
 */
function buildInserts(
  db: D1Database,
  table: string,
  columns: string[],
  rows: Bind[][],
): D1PreparedStatement[] {
  const numCols = columns.length
  for (const r of rows) {
    if (r.length !== numCols) {
      throw new Error(`Row arity ${r.length} != ${numCols} columns for ${table}`)
    }
  }
  const perInsert = rowsPerInsert(numCols)
  const colList = columns.join(', ')
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`
  const statements: D1PreparedStatement[] = []
  for (let i = 0; i < rows.length; i += perInsert) {
    const chunk = rows.slice(i, i + perInsert)
    const placeholders = chunk.map(() => rowPlaceholder).join(', ')
    const binds: Bind[] = []
    for (const r of chunk) binds.push(...r)
    statements.push(
      db.prepare(`INSERT INTO ${table} (${colList}) VALUES ${placeholders}`).bind(...binds),
    )
  }
  return statements
}

// ---------------------------------------------------------------------------
// Asserts — ALL run BEFORE any write. Throw == abort, nothing imported.
// ---------------------------------------------------------------------------

async function runAsserts(
  authUsers: AuthUserRow[],
  profiles: ProfileRow[],
  flights: FlightRow[],
  countryClaims: CountryClaimRow[],
  groundVisits: GroundVisitRow[],
): Promise<void> {
  const fail = (msg: string): never => {
    throw new Error(`ASSERT FAILED: ${msg}`)
  }

  // A1: source closure, independent of a particular dated rehearsal snapshot.
  if (authUsers.length === 0 || profiles.length !== authUsers.length)
    fail('auth/profile source count mismatch')

  // A2: every profiles.id is present in auth_users.id (and == 26 join coverage).
  const authIds = new Set(authUsers.map((u) => u.id))
  if (authIds.size !== authUsers.length) fail('auth_users contains duplicate ids')
  let profileJoinCount = 0
  for (const p of profiles) {
    if (!authIds.has(p.id)) fail(`profile id ${p.id} not found in auth_users`)
    profileJoinCount++
  }
  if (
    profileJoinCount !== authUsers.length ||
    new Set(profiles.map((p) => p.id)).size !== profiles.length
  ) {
    fail('profile->auth join coverage or profile ids are not unique')
  }

  // A3: every flights.user_id references a profiles.id (no orphan flights).
  const profileIds = new Set(profiles.map((p) => p.id))
  for (const f of flights) {
    if (!profileIds.has(f.user_id)) fail(`flight id ${f.id} user_id ${f.user_id} has no profile`)
  }

  // A3b: every country_claims.user_id and ground_visits.user_id references a profile.
  for (const c of countryClaims) {
    if (!profileIds.has(c.user_id))
      fail(`country_claim ${c.id} user_id ${c.user_id} has no profile`)
  }
  for (const g of groundVisits) {
    if (!profileIds.has(g.user_id)) fail(`ground_visit ${g.id} user_id ${g.user_id} has no profile`)
  }

  // A4: every timestamptz string contains '+00' (UTC offset present pre-normalization).
  const assertTz = (value: string | null | undefined, ctx: string) => {
    if (value === null || value === undefined) return
    if (!value.includes('+00'))
      fail(`timestamp ${ctx} missing '+00' offset: ${JSON.stringify(value)}`)
  }
  for (const u of authUsers) assertTz(u.created_at, `auth_users.created_at[${u.id}]`)
  for (const p of profiles) {
    assertTz(p.created_at, `profiles.created_at[${p.id}]`)
    assertTz(p.updated_at, `profiles.updated_at[${p.id}]`)
  }
  for (const f of flights) {
    assertTz(f.created_at, `flights.created_at[${f.id}]`)
    assertTz(f.departure_utc, `flights.departure_utc[${f.id}]`)
    assertTz(f.arrival_utc, `flights.arrival_utc[${f.id}]`)
  }
  for (const c of countryClaims) assertTz(c.claimed_at, `country_claims.claimed_at[${c.id}]`)
  for (const g of groundVisits) assertTz(g.created_at, `ground_visits.created_at[${g.id}]`)

  // A5: the RESET_REQUIRED placeholder is structurally NOT a valid password hash, so
  // verifyPassword(anything, 'RESET_REQUIRED', secret) === false. No real password can
  // be recovered; every migrated user MUST go through password reset. Verify against the
  // REAL crypto.ts implementation (not a copy).
  const verified = await verifyPassword('any-plaintext', PASSWORD_PLACEHOLDER, 'any-secret')
  if (verified !== false) {
    fail(`verifyPassword('${PASSWORD_PLACEHOLDER}') returned ${verified}, expected false`)
  }
}

// ---------------------------------------------------------------------------
// Transform: snapshot rows -> ordered bind tuples per D1 table.
// Column lists below are the LIVE columns from _schema.json mapped to the D1 target.
// ---------------------------------------------------------------------------

// users: synthesized. 4 cols -> floor(100/4) = 25 rows/insert.
const USERS_COLUMNS = ['id', 'email', 'password_hash', 'created_at']

function buildUserRows(authUsers: AuthUserRow[], profiles: ProfileRow[]): Bind[][] {
  // id = profiles.id; email = lower(trim(auth_users.email)) joined by id; password reset.
  const authById = new Map(authUsers.map((u) => [u.id, u]))
  return profiles.map((p) => {
    const auth = authById.get(p.id)
    if (!auth)
      throw new Error(`No auth_users row for profile ${p.id} (should be caught by asserts)`)
    const email = auth.email.trim().toLowerCase()
    const createdAt = tsRequired(auth.created_at, `users.created_at[${p.id}]`)
    return [p.id, email, PASSWORD_PLACEHOLDER, createdAt]
  })
}

// profiles: 11 cols -> floor(100/11) = 9 rows/insert. (Spec says chunk 7; 9 also satisfies
// the <=100-var budget. We use the exact floor(100/numCols) rule via rowsPerInsert.)
const PROFILES_COLUMNS = [
  'id',
  'username',
  'display_name',
  'bio',
  'avatar_url',
  'gemini_api_key',
  'home_airport',
  'is_public',
  'locale',
  'show_on_leaderboards',
  'theme_color',
  'created_at',
  'updated_at',
]

function buildProfileRows(profiles: ProfileRow[]): Bind[][] {
  return profiles.map((p) => [
    p.id,
    p.username, // carried verbatim (0 display_names in snapshot)
    p.display_name,
    p.bio,
    p.avatar_url,
    p.gemini_api_key,
    p.home_airport,
    boolToInt(p.is_public, `profiles.is_public[${p.id}]`),
    p.locale ?? 'en',
    boolToInt(p.show_on_leaderboards, `profiles.show_on_leaderboards[${p.id}]`),
    p.theme_color,
    tsRequired(p.created_at, `profiles.created_at[${p.id}]`),
    tsRequired(p.updated_at, `profiles.updated_at[${p.id}]`),
  ])
}

// flights: 20 LIVE columns. aircraft_lookup_attempts is OMITTED (D1 DEFAULT 0). Explicit
// integer `id` preserved. 20 cols -> floor(100/20) = 5 rows/insert.
const FLIGHTS_COLUMNS = [
  'id',
  'user_id',
  'date',
  'origin',
  'destination',
  'airline_iata',
  'aircraft_icao',
  'flight_number',
  'departure_time',
  'arrival_time',
  'departure_utc',
  'arrival_utc',
  'origin_tz',
  'dest_tz',
  'distance_km',
  'duration_minutes',
  'source',
  'is_upcoming',
  'enrichment_status',
  'created_at',
]

// The approved source delta maps exactly snapshot flight IDs 495 and 496 from
// non-ICAO 'A380' to canonical 'A388'. buildImportTables asserts that set before
// writing and records it in the local manifest for validation.
function buildFlightRows(flights: FlightRow[]): Bind[][] {
  if (FLIGHTS_COLUMNS.length !== 20) {
    throw new Error(
      `flights column list must be 20 (omitting aircraft_lookup_attempts), got ${FLIGHTS_COLUMNS.length}`,
    )
  }
  return flights.map((f) => [
    f.id, // explicit PK preserved
    f.user_id,
    f.date, // DATE YYYY-MM-DD verbatim
    f.origin,
    f.destination,
    f.airline_iata,
    f.aircraft_icao,
    f.flight_number,
    f.departure_time, // TIME HH:MM:SS verbatim
    f.arrival_time,
    tsOptional(f.departure_utc),
    tsOptional(f.arrival_utc),
    f.origin_tz,
    f.dest_tz,
    decimalToReal(f.distance_km, `flights.distance_km[${f.id}]`),
    f.duration_minutes,
    f.source,
    boolToInt(f.is_upcoming, `flights.is_upcoming[${f.id}]`),
    f.enrichment_status,
    tsRequired(f.created_at, `flights.created_at[${f.id}]`),
  ])
}

// country_claims: 4 cols -> floor(100/4) = 25 rows/insert.
const COUNTRY_CLAIMS_COLUMNS = ['id', 'user_id', 'country_code', 'claimed_at']

function buildCountryClaimRows(rows: CountryClaimRow[]): Bind[][] {
  return rows.map((c) => [
    c.id, // UUID verbatim
    c.user_id,
    c.country_code,
    tsRequired(c.claimed_at, `country_claims.claimed_at[${c.id}]`),
  ])
}

// ground_visits: 7 cols -> floor(100/7) = 14 rows/insert.
const GROUND_VISITS_COLUMNS = [
  'id',
  'user_id',
  'country_code',
  'visit_year',
  'note',
  'entry_method',
  'created_at',
]

function buildGroundVisitRows(rows: GroundVisitRow[]): Bind[][] {
  return rows.map((g) => [
    g.id, // UUID verbatim
    g.user_id,
    g.country_code,
    g.visit_year,
    g.note,
    g.entry_method,
    tsRequired(g.created_at, `ground_visits.created_at[${g.id}]`),
  ])
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface ImportTable {
  table: string
  columns: string[]
  key: string
  rows: Bind[][]
}

/** Source FK closure is checked against source plus pre-existing target parents. */
export function assertSourceForeignKeyClosure(
  tables: ImportTable[],
  sourceVisits: Array<{ user_id: string }>,
  existingUsers: string[],
  existingBadges: number[],
): void {
  const table = (name: string): ImportTable => {
    const found = tables.find((item) => item.table === name)
    if (!found) throw new Error(`Missing source table ${name}`)
    return found
  }
  const keys = (name: string, column: string): Set<string> => {
    const source = table(name)
    const index = source.columns.indexOf(column)
    if (index < 0) throw new Error(`Missing ${name}.${column}`)
    return new Set(source.rows.map((row) => String(row[index])))
  }
  const users = keys('users', 'id')
  for (const id of existingUsers) users.add(id)
  const badges = keys('badge_definitions', 'id')
  for (const id of existingBadges) badges.add(String(id))
  const edge = (name: string, column: string, parents: Set<string>): void => {
    const source = table(name)
    const index = source.columns.indexOf(column)
    if (index < 0) throw new Error(`Missing ${name}.${column}`)
    for (const row of source.rows) {
      if (!parents.has(String(row[index])))
        throw new Error(`Source FK closure failed: ${name}.${column}`)
    }
  }
  for (const name of [
    'profiles',
    'flights',
    'country_claims',
    'ground_visits',
    'legacy_visit_evidence',
    'user_stats',
    'user_advanced_stats',
    'user_badges',
  ]) {
    edge(name, name === 'profiles' ? 'id' : 'user_id', users)
  }
  edge('user_badges', 'badge_id', badges)
  for (const visit of sourceVisits)
    if (!users.has(String(visit.user_id))) {
      throw new Error('Source FK closure failed: visits.user_id')
    }
}

interface PreparedTable extends ImportTable {
  before: number
  missing: Bind[][]
}

interface VisitRow {
  id: number
  user_id: string
  airport_iata: string | null
  country_code: string | null
  city: string | null
  first_visit: string
  last_visit: string
  visit_count: number
}

export interface ImportManifest {
  sourceSnapshotSha256: string
  sourceFiles: Record<string, { sha256: string; rows: number }>
  /** Hash of every projected aircraft/airport reference row and column, including country names. */
  referenceSourceSha256: string
  /** Pinned upstream OurAirports dataset hash, retained as provenance only. */
  referenceDatasetSha256: string
  tableRows: Record<string, number>
  expectedUnionCounts?: Record<string, number>
  visitEvidence: {
    raw: number
    contributing: number
    derivedKeys: number
    expectedUnionKeys: number
  }
  aircraftCorrections: { count: number; ids: number[]; from: 'A380'; to: 'A388' }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

export function buildImportTables(
  snapshotDir: string,
  supplementPath = join(__dirname, '..', 'db', 'reference-supplements.json'),
): { tables: ImportTable[]; manifest: ImportManifest } {
  const files = [
    'auth_users',
    'profiles',
    'flights',
    'country_claims',
    'ground_visits',
    'visits',
    'user_stats',
    'user_advanced_stats',
    'user_badges',
    'leaderboard_cache',
    'badge_definitions',
    'code_adjectives',
    'code_nouns',
  ]
  const sourceFiles: ImportManifest['sourceFiles'] = {}
  for (const name of files) {
    const sourceText = readFileSync(join(snapshotDir, `${name}.json`), 'utf8')
    const rows = JSON.parse(sourceText) as unknown
    if (!Array.isArray(rows)) throw new Error(`Source ${name} is not an array`)
    sourceFiles[name] = { sha256: digest(sourceText), rows: rows.length }
  }
  const sourceSnapshotSha256 = digest(stableJson(sourceFiles))
  const authUsers = readSnapshot<AuthUserRow>('auth_users', snapshotDir)
  const profiles = readSnapshot<ProfileRow>('profiles', snapshotDir)
  const flights = readSnapshot<FlightRow>('flights', snapshotDir)
  const countryClaims = readSnapshot<CountryClaimRow>('country_claims', snapshotDir)
  const groundVisits = readSnapshot<GroundVisitRow>('ground_visits', snapshotDir)
  const sourceVisits = readSnapshot<VisitRow>('visits', snapshotDir)

  const dataDir = join(__dirname, '..', 'packages', 'data', 'src')
  const aircraft = loadJson<
    Array<{
      icao: string
      iata: string | null
      name: string
      manufacturer: string
      model: string
      type: string
      engineType: string
      engineCount: number
    }>
  >(join(dataDir, 'aircraft.json'))
  const baseAirports = loadJson<
    Array<{
      iata: string
      icao: string | null
      name: string
      city: string
      country: string
      countryCode: string
      latitude: number | null
      longitude: number | null
    }>
  >(join(dataDir, 'airports.json'))
  const countries = loadJson<Record<string, { name: string }>>(join(dataDir, 'countries.json'))
  const supplement = loadJson<{
    source: { sha256: string; license: string }
    airports: Array<{
      iata: string
      icao: string
      name: string
      city: string
      countryCode: string
      latitude: number
      longitude: number
    }>
  }>(supplementPath)
  if (
    supplement.source.license !== 'Public Domain' ||
    !/^[a-f0-9]{64}$/.test(supplement.source.sha256)
  )
    throw new Error('Unverified airport supplement provenance')

  const aircraftByIcao = new Map<string, (typeof aircraft)[number]>()
  for (const row of aircraft) if (!aircraftByIcao.has(row.icao)) aircraftByIcao.set(row.icao, row)
  const airportsByIata = new Map<string, Bind[]>()
  const airportColumns = [
    'iata',
    'icao',
    'name',
    'city',
    'country',
    'country_code',
    'latitude',
    'longitude',
  ]
  for (const a of baseAirports) {
    if (airportsByIata.has(a.iata)) throw new Error('Duplicate base airport IATA')
    airportsByIata.set(a.iata, [
      a.iata,
      a.icao,
      a.name,
      a.city,
      a.country,
      a.countryCode,
      a.latitude,
      a.longitude,
    ])
  }
  const expectedSupplement = ['ARK', 'BAX', 'KBV', 'MCX', 'MRV', 'NAL', 'VOG', 'ZIA']
  if (stableJson(supplement.airports.map((a) => a.iata).sort()) !== stableJson(expectedSupplement))
    throw new Error('Airport supplement code set changed')
  for (const a of supplement.airports) {
    const country = countries[a.countryCode]?.name
    if (!country || airportsByIata.has(a.iata))
      throw new Error('Airport supplement conflicts with base reference')
    airportsByIata.set(a.iata, [
      a.iata,
      a.icao,
      a.name,
      a.city,
      country,
      a.countryCode,
      a.latitude,
      a.longitude,
    ])
  }

  const corrected = flights.filter((f) => f.aircraft_icao === 'A380')
  const correctionIds = corrected.map((f) => f.id).sort((a, b) => a - b)
  if (correctionIds.length && stableJson(correctionIds) !== stableJson([495, 496])) {
    throw new Error('A380 correction source set changed; review before import')
  }
  const transformedFlights = flights.map((f) =>
    f.aircraft_icao === 'A380' ? { ...f, aircraft_icao: 'A388' } : f,
  )
  const completed = new Map<string, { first: string; last: string; count: number }>()
  for (const f of transformedFlights) {
    if (f.is_upcoming) continue
    for (const code of [f.origin, f.destination]) {
      if (!airportsByIata.has(code)) continue
      const key = `${f.user_id}|${code}`
      const prior = completed.get(key)
      if (prior) {
        prior.first = prior.first < f.date ? prior.first : f.date
        prior.last = prior.last > f.date ? prior.last : f.date
        prior.count++
      } else completed.set(key, { first: f.date, last: f.date, count: 1 })
    }
  }
  const sourceVisitKeys = new Set<string>()
  const evidenceRows: Bind[][] = sourceVisits.map((v) => {
    const sourceId = String(v.id)
    if (!v.airport_iata)
      throw new Error('Null source airport requires explicit review before import')
    const key = `${v.user_id}|${v.airport_iata}`
    if (sourceVisitKeys.has(key)) throw new Error('Duplicate source visit user/airport key')
    sourceVisitKeys.add(key)
    const replay = completed.get(key)
    // The archived counter is cumulative and may include edited/deleted flight history.
    // Merge only if it adds a key or a wider observed count/date; never sum counters.
    const contributes =
      !replay ||
      v.first_visit < replay.first ||
      v.last_visit > replay.last ||
      v.visit_count > replay.count
        ? 1
        : 0
    const sourceJson = stableJson(v)
    return [
      sourceId,
      v.user_id,
      v.airport_iata,
      v.country_code,
      v.city,
      v.first_visit,
      v.last_visit,
      v.visit_count,
      digest(sourceJson),
      'supabase.public.visits',
      contributes,
      sourceJson,
    ]
  })
  const evidenceColumns = [
    'source_id',
    'user_id',
    'airport_iata',
    'country_code',
    'city',
    'first_visit',
    'last_visit',
    'visit_count',
    'source_digest',
    'provenance',
    'contributes',
    'source_json',
  ]
  const contributing = evidenceRows.filter((r) => r[10] === 1).length
  const unionKeys = new Set([...completed.keys(), ...sourceVisitKeys])
  const badgeRows = readSnapshot<Record<string, unknown>>('badge_definitions', snapshotDir).map(
    (b) => [
      Number(b.id),
      String(b.code),
      String(b.name),
      b.description as string | null,
      b.category as string | null,
      b.tier as string | null,
      b.icon as string | null,
      b.points == null ? null : Number(b.points),
      b.criteria == null ? null : JSON.stringify(b.criteria),
    ],
  )
  const tables: ImportTable[] = [
    {
      table: 'aircraft_reference',
      key: 'icao',
      columns: [
        'icao',
        'iata',
        'name',
        'manufacturer',
        'model',
        'type',
        'engine_type',
        'engine_count',
      ],
      rows: [...aircraftByIcao.values()].map((a) => [
        a.icao,
        a.iata,
        a.name,
        a.manufacturer,
        a.model,
        a.type,
        a.engineType,
        a.engineCount,
      ]),
    },
    {
      table: 'airports_reference',
      key: 'iata',
      columns: airportColumns,
      rows: [...airportsByIata.values()],
    },
    {
      table: 'badge_definitions',
      key: 'id',
      columns: [
        'id',
        'code',
        'name',
        'description',
        'category',
        'tier',
        'icon',
        'points',
        'criteria',
      ],
      rows: badgeRows,
    },
    {
      table: '_code_adjectives',
      key: 'word',
      columns: ['word'],
      rows: readSnapshot<{ word: string }>('code_adjectives', snapshotDir).map((r) => [r.word]),
    },
    {
      table: '_code_nouns',
      key: 'word',
      columns: ['word'],
      rows: readSnapshot<{ word: string }>('code_nouns', snapshotDir).map((r) => [r.word]),
    },
    { table: 'users', key: 'id', columns: USERS_COLUMNS, rows: buildUserRows(authUsers, profiles) },
    { table: 'profiles', key: 'id', columns: PROFILES_COLUMNS, rows: buildProfileRows(profiles) },
    {
      table: 'flights',
      key: 'id',
      columns: FLIGHTS_COLUMNS,
      rows: buildFlightRows(transformedFlights),
    },
    {
      table: 'country_claims',
      key: 'id',
      columns: COUNTRY_CLAIMS_COLUMNS,
      rows: buildCountryClaimRows(countryClaims),
    },
    {
      table: 'ground_visits',
      key: 'id',
      columns: GROUND_VISITS_COLUMNS,
      rows: buildGroundVisitRows(groundVisits),
    },
    {
      table: 'legacy_visit_evidence',
      key: 'source_id',
      columns: evidenceColumns,
      rows: evidenceRows,
    },
  ]
  // Leaderboards are rebuilt from published stats and get new autoincrement IDs.
  // Preserve the source file hash, but never treat cache row IDs as import keys.
  for (const def of ORACLE_TABLES.filter(
    (d) => d.table !== 'visits' && d.table !== 'leaderboard_cache',
  )) {
    tables.push({
      table: def.table,
      key: def.autoincrement ? 'id' : 'user_id',
      columns: def.specs.map((s) => s.col),
      rows: buildOracleRows(def, readSnapshot<Record<string, unknown>>(def.table, snapshotDir)),
    })
  }
  const referenceSourceSha256 = digest(
    stableJson(
      tables
        .filter(
          (table) => table.table === 'aircraft_reference' || table.table === 'airports_reference',
        )
        .map((table) => ({
          table: table.table,
          columns: table.columns,
          rows: [...table.rows].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        })),
    ),
  )
  const tableRows = Object.fromEntries(tables.map((t) => [t.table, t.rows.length]))
  return {
    tables,
    manifest: {
      sourceSnapshotSha256,
      sourceFiles,
      referenceSourceSha256,
      referenceDatasetSha256: supplement.source.sha256,
      tableRows,
      visitEvidence: {
        raw: sourceVisits.length,
        contributing,
        derivedKeys: completed.size,
        expectedUnionKeys: unionKeys.size,
      },
      aircraftCorrections: {
        count: correctionIds.length,
        ids: correctionIds,
        from: 'A380',
        to: 'A388',
      },
    },
  }
}

function equalCell(a: unknown, b: Bind): boolean {
  if (a == null || b == null) return a == null && b == null
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b)
  return a === b
}

const COMPUTED_STATS = new Set([
  'total_flights',
  'total_distance_km',
  'total_duration_minutes',
  'longest_flight_minutes',
  'airports_count',
  'cities_count',
  'countries_count',
  'continents_count',
  'airlines_count',
  'aircraft_count',
  'has_night_departure',
  'updated_at',
])
const COMPUTED_ADVANCED = new Set([
  'avia_geek_unlocked',
  'country_geek_unlocked',
  'duration_unlocked',
  'aircraft_breakdown',
  'manufacturer_breakdown',
  'aircraft_type_breakdown',
  'continent_breakdown',
  'region_breakdown',
  'duration_stats',
  'departure_patterns',
  'duration_coverage',
  'fleet_insights',
  'manufacturer_insights',
  'card_insights',
  'duration_year_comparison',
  'updated_at',
])

export function sameProjectedRow(
  table: ImportTable,
  actual: Record<string, unknown>,
  values: Bind[],
  repaired = false,
): boolean {
  return table.columns.every((column, i) => {
    if (repaired && table.table === 'user_stats' && COMPUTED_STATS.has(column)) return true
    if (repaired && table.table === 'user_advanced_stats' && COMPUTED_ADVANCED.has(column))
      return true
    if (
      table.table === 'users' &&
      column === 'password_hash' &&
      values[i] === PASSWORD_PLACEHOLDER
    ) {
      return typeof actual[column] === 'string' && actual[column].length > 0
    }
    return equalCell(actual[column], values[i])
  })
}

/** Reads every touched target table and resolves all collisions before the first INSERT. */
async function prepareImport(db: D1Database, tables: ImportTable[]): Promise<PreparedTable[]> {
  const prepared: PreparedTable[] = []
  const conflicts: Record<string, number> = {}
  const existingByTable = new Map<string, Record<string, unknown>[]>()
  const repairedRows = await db
    .prepare(
      'SELECT user_id FROM user_derived_state WHERE revision = published_revision AND revision > 0',
    )
    .all<{ user_id: string }>()
  const repairedUsers = new Set(repairedRows.results.map((r) => r.user_id))
  for (const table of tables) {
    const existing = (
      await db
        .prepare(`SELECT ${table.columns.join(', ')} FROM ${table.table}`)
        .all<Record<string, unknown>>()
    ).results
    existingByTable.set(table.table, existing)
    const keyIndex = table.columns.indexOf(table.key)
    if (keyIndex < 0) throw new Error(`Import key missing in ${table.table}`)
    const existingByKey = new Map(existing.map((r) => [String(r[table.key]), r]))
    const sourceKeys = new Set<string>()
    const missing: Bind[][] = []
    for (const values of table.rows) {
      if (values.length !== table.columns.length)
        throw new Error(`Arity mismatch in ${table.table}`)
      const key = String(values[keyIndex])
      if (sourceKeys.has(key)) throw new Error(`Duplicate source key in ${table.table}`)
      sourceKeys.add(key)
      const found = existingByKey.get(key)
      if (!found) missing.push(values)
      else if (!sameProjectedRow(table, found, values, repairedUsers.has(key)))
        conflicts[table.table] = (conflicts[table.table] ?? 0) + 1
    }
    prepared.push({ ...table, before: existing.length, missing })
  }
  // Natural-key conflicts can otherwise occur after some earlier tables have been inserted.
  const users = tables.find((t) => t.table === 'users')!
  const oldUsers = existingByTable.get('users')!
  for (const row of users.rows) {
    if (
      oldUsers.some(
        (old) =>
          old.id !== row[0] && String(old.email).toLowerCase() === String(row[1]).toLowerCase(),
      )
    ) {
      conflicts.users = (conflicts.users ?? 0) + 1
    }
  }
  const profiles = tables.find((t) => t.table === 'profiles')!
  const oldProfiles = existingByTable.get('profiles')!
  for (const row of profiles.rows) {
    if (
      row[1] &&
      oldProfiles.some(
        (old) =>
          old.id !== row[0] &&
          String(old.username ?? '').toLowerCase() === String(row[1]).toLowerCase(),
      )
    ) {
      conflicts.profiles = (conflicts.profiles ?? 0) + 1
    }
  }
  const badges = tables.find((t) => t.table === 'badge_definitions')!
  const oldBadges = existingByTable.get('badge_definitions')!
  for (const row of badges.rows)
    if (oldBadges.some((old) => old.id !== row[0] && old.code === row[1]))
      conflicts.badge_definitions = (conflicts.badge_definitions ?? 0) + 1
  for (const [table, natural] of [
    [users, 'email'],
    [profiles, 'username'],
    [badges, 'code'],
  ] as const) {
    const columnIndex = table.columns.indexOf(natural)
    const seen = new Set<string>()
    for (const row of table.rows) {
      if (row[columnIndex] == null) continue
      const value = String(row[columnIndex]).toLowerCase()
      if (seen.has(value)) conflicts[table.table] = (conflicts[table.table] ?? 0) + 1
      seen.add(value)
    }
  }
  if (Object.keys(conflicts).length)
    throw new Error(`Import conflicts before writes: ${JSON.stringify(conflicts)}`)
  return prepared
}

export async function inspectSnapshotImport(
  db: D1Database,
  snapshotDir = SNAPSHOT_DIR,
): Promise<{
  manifest: ImportManifest
  prepared: PreparedTable[]
}> {
  const authUsers = readSnapshot<AuthUserRow>('auth_users', snapshotDir)
  const profiles = readSnapshot<ProfileRow>('profiles', snapshotDir)
  const flights = readSnapshot<FlightRow>('flights', snapshotDir)
  const claims = readSnapshot<CountryClaimRow>('country_claims', snapshotDir)
  const ground = readSnapshot<GroundVisitRow>('ground_visits', snapshotDir)
  await runAsserts(authUsers, profiles, flights, claims, ground)
  const { tables, manifest } = buildImportTables(snapshotDir)
  const targetUsers = (await db.prepare('SELECT id FROM users').all<{ id: string }>()).results.map(
    (row) => row.id,
  )
  const targetBadges = (
    await db.prepare('SELECT id FROM badge_definitions').all<{ id: number }>()
  ).results.map((row) => row.id)
  assertSourceForeignKeyClosure(
    tables,
    readSnapshot<VisitRow>('visits', snapshotDir),
    targetUsers,
    targetBadges,
  )
  const fkBefore = await db.prepare('PRAGMA foreign_key_check').all()
  if ((fkBefore.results ?? []).length)
    throw new Error('Target foreign-key violations before writes')
  const prepared = await prepareImport(db, tables)
  manifest.expectedUnionCounts = Object.fromEntries(
    prepared.map((t) => [t.table, t.before + t.missing.length]),
  )
  return { manifest, prepared }
}

export async function importSnapshot(
  db: D1Database,
  snapshotDir = SNAPSHOT_DIR,
  apply = false,
  stopAfterTable?: string,
): Promise<ImportManifest> {
  const { manifest, prepared } = await inspectSnapshotImport(db, snapshotDir)
  if (!apply) return manifest
  const sourceUserIds = prepared
    .find((table) => table.table === 'users')!
    .rows.map((row) => String(row[0]))
  const stateRows = await db
    .prepare('SELECT user_id FROM user_derived_state')
    .all<{ user_id: string }>()
  const stateIds = new Set(stateRows.results.map((row) => row.user_id))
  const sourceChanged = prepared.some((table) => table.missing.length > 0)
  const dirtyIds = sourceChanged ? sourceUserIds : sourceUserIds.filter((id) => !stateIds.has(id))
  const dirtyStatements: D1PreparedStatement[] = []
  for (let i = 0; i < dirtyIds.length; i += 80) {
    const ids = dirtyIds.slice(i, i + 80)
    dirtyStatements.push(
      db
        .prepare(
          `INSERT INTO user_derived_state (user_id, revision, published_revision)
       SELECT id, 1, 0 FROM users WHERE id IN (${ids.map(() => '?').join(', ')})
       ON CONFLICT(user_id) DO UPDATE SET revision = user_derived_state.revision + 1,
         last_error = NULL, updated_at = excluded.updated_at`,
        )
        .bind(...ids),
    )
  }
  for (const table of prepared) {
    const statements = buildInserts(db, table.table, table.columns, table.missing)
    // D1 batches are atomic individually. A crash between batches is safe: rerun plans
    // against the already-inserted rows and adds only what remains missing.
    for (let i = 0; i < statements.length; i += 50) {
      const chunk = statements.slice(i, i + 50)
      if (table.table === 'users' && i + 50 >= statements.length) chunk.push(...dirtyStatements)
      await db.batch(chunk)
    }
    if (table.table === 'users' && statements.length === 0 && dirtyStatements.length) {
      await db.batch(dirtyStatements)
    }
    const after = Number(
      (await db.prepare(`SELECT COUNT(*) AS n FROM ${table.table}`).first<{ n: number }>())?.n ??
        -1,
    )
    if (after !== table.before + table.missing.length)
      throw new Error(`Post-import count mismatch in ${table.table}`)
    if (stopAfterTable === table.table) throw new Error('Intentional import interruption')
  }
  const fk = await db.prepare('PRAGMA foreign_key_check').all()
  if ((fk.results ?? []).length)
    throw new Error(`Post-import foreign-key violations: ${fk.results.length}`)
  return manifest
}

export async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const options = parseLocalTarget(argv)
  const snapshotArg = argv.indexOf('--snapshot-dir')
  const snapshotDir = snapshotArg === -1 ? SNAPSHOT_DIR : resolve(argv[snapshotArg + 1])
  const apply = argv.includes('--apply')
  const target = await openLocalTarget(options)
  try {
    const manifest = await importSnapshot(target.db, snapshotDir, apply)
    const manifestPath = join(snapshotDir, '_migration-manifest.json')
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          ...manifest,
          target: options.target,
          databaseId: options.databaseId,
          schemaSha256: target.schemaSha256,
        },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    )
    console.log(
      JSON.stringify(
        {
          mode: apply ? 'local-applied' : 'local-plan',
          databaseId: options.databaseId,
          schemaSha256: target.schemaSha256,
          sourceSnapshotSha256: manifest.sourceSnapshotSha256,
          tableRows: manifest.tableRows,
          visitEvidence: manifest.visitEvidence,
          aircraftCorrections: manifest.aircraftCorrections,
        },
        null,
        2,
      ),
    )
  } finally {
    await target.dispose()
  }
}

// Only run the import when invoked directly (npx tsx scripts/sb-to-d1.ts), not on import.
const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    const message = (err as Error).message
    console.error(
      message.startsWith('Import conflicts before writes:') ||
        message.startsWith('Target schema mismatch:')
        ? message
        : 'Import refused; source identifiers and secrets suppressed',
    )
    process.exit(1)
  })
}

// Exported for the import-smoke harness (typecheck/import without running the import).
export {
  USERS_COLUMNS,
  PROFILES_COLUMNS,
  FLIGHTS_COLUMNS,
  COUNTRY_CLAIMS_COLUMNS,
  GROUND_VISITS_COLUMNS,
  PASSWORD_PLACEHOLDER,
  rowsPerInsert,
  buildUserRows,
  buildFlightRows,
  runAsserts,
}
