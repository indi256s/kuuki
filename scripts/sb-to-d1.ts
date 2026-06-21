// Phase 5: Supabase -> LOCAL Cloudflare D1 migration.
//
// Transforms the md5-verified snapshot at db/_snapshot/*.json and RAW-imports it into
// the LOCAL D1 database via getPlatformProxy() (.wrangler/state/v3). NOTHING is written
// until EVERY integrity assert below has passed — correctness over speed, fail loud.
//
// Run:   npx tsx scripts/sb-to-d1.ts
//
// SAFETY: LOCAL D1 ONLY. Never run against remote D1. This snapshot is the only copy of
// real user data; the import preserves explicit integer PKs and resets sqlite_sequence.
//
// Column lists are driven from db/_snapshot/_schema.json (the LIVE information_schema),
// NOT apps/web/src/lib/database.types.ts (stale). The live `flights` table has 20 columns
// and NO `aircraft_lookup_attempts`; that column exists ONLY in the D1 target schema
// (db/migrations/0001_init.sql, INTEGER NOT NULL DEFAULT 0). The flights INSERT OMITS it
// and relies on the D1 DEFAULT 0.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPlatformProxy } from 'wrangler'

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

function readSnapshot<T>(name: string): T[] {
  const path = join(SNAPSHOT_DIR, `${name}.json`)
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

  // A1: counts match VERIFIED FACTS.
  if (authUsers.length !== 26) fail(`auth_users count ${authUsers.length} != 26`)
  if (profiles.length !== 26) fail(`profiles count ${profiles.length} != 26`)

  // A2: every profiles.id is present in auth_users.id (and == 26 join coverage).
  const authIds = new Set(authUsers.map((u) => u.id))
  if (authIds.size !== 26) fail(`auth_users has ${authIds.size} distinct ids, expected 26`)
  let profileJoinCount = 0
  for (const p of profiles) {
    if (!authIds.has(p.id)) fail(`profile id ${p.id} not found in auth_users`)
    profileJoinCount++
  }
  if (profileJoinCount !== 26) fail(`profile->auth join coverage ${profileJoinCount} != 26`)

  // A3: every flights.user_id references a profiles.id (no orphan flights).
  const profileIds = new Set(profiles.map((p) => p.id))
  for (const f of flights) {
    if (!profileIds.has(f.user_id)) fail(`flight id ${f.id} user_id ${f.user_id} has no profile`)
  }

  // A3b: every country_claims.user_id and ground_visits.user_id references a profile.
  for (const c of countryClaims) {
    if (!profileIds.has(c.user_id)) fail(`country_claim ${c.id} user_id ${c.user_id} has no profile`)
  }
  for (const g of groundVisits) {
    if (!profileIds.has(g.user_id)) fail(`ground_visit ${g.id} user_id ${g.user_id} has no profile`)
  }

  // A4: every timestamptz string contains '+00' (UTC offset present pre-normalization).
  const assertTz = (value: string | null | undefined, ctx: string) => {
    if (value === null || value === undefined) return
    if (!value.includes('+00')) fail(`timestamp ${ctx} missing '+00' offset: ${JSON.stringify(value)}`)
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
    if (!auth) throw new Error(`No auth_users row for profile ${p.id} (should be caught by asserts)`)
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

function buildFlightRows(flights: FlightRow[]): Bind[][] {
  if (FLIGHTS_COLUMNS.length !== 20) {
    throw new Error(`flights column list must be 20 (omitting aircraft_lookup_attempts), got ${FLIGHTS_COLUMNS.length}`)
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

export async function main(): Promise<void> {
  // Load snapshot.
  const authUsers = readSnapshot<AuthUserRow>('auth_users')
  const profiles = readSnapshot<ProfileRow>('profiles')
  const flights = readSnapshot<FlightRow>('flights')
  const countryClaims = readSnapshot<CountryClaimRow>('country_claims')
  const groundVisits = readSnapshot<GroundVisitRow>('ground_visits')

  // ALL integrity asserts BEFORE any DB write.
  await runAsserts(authUsers, profiles, flights, countryClaims, groundVisits)

  // Build all bind tuples (transform happens here; can also throw before any write).
  const userRows = buildUserRows(authUsers, profiles)
  const profileRows = buildProfileRows(profiles)
  const flightRows = buildFlightRows(flights)
  const countryClaimRows = buildCountryClaimRows(countryClaims)
  const groundVisitRows = buildGroundVisitRows(groundVisits)

  const maxFlightId = flights.reduce((m, f) => (f.id > m ? f.id : m), 0)

  const proxy = await getPlatformProxy<{ DB: D1Database }>()
  try {
    const db = proxy.env.DB

    // FK order: users -> profiles -> flights -> country_claims -> ground_visits.
    await db.batch(buildInserts(db, 'users', USERS_COLUMNS, userRows))
    await db.batch(buildInserts(db, 'profiles', PROFILES_COLUMNS, profileRows))
    await db.batch(buildInserts(db, 'flights', FLIGHTS_COLUMNS, flightRows))

    // Re-seed AUTOINCREMENT cursor for flights so new local inserts continue past the
    // largest imported id (snapshot max id 509). Inserting flights with explicit ids has
    // already created the sqlite_sequence row and set it to MAX(id); we UPDATE it
    // explicitly to be safe. (sqlite_sequence has no UNIQUE/PK, so ON CONFLICT is invalid.)
    await db
      .prepare(
        `UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id), 0) FROM flights) WHERE name = 'flights'`,
      )
      .run()

    await db.batch(buildInserts(db, 'country_claims', COUNTRY_CLAIMS_COLUMNS, countryClaimRows))
    await db.batch(buildInserts(db, 'ground_visits', GROUND_VISITS_COLUMNS, groundVisitRows))

    // eslint-disable-next-line no-console
    console.log(
      `Imported: users=${userRows.length} profiles=${profileRows.length} flights=${flightRows.length} ` +
        `(max id ${maxFlightId}) country_claims=${countryClaimRows.length} ground_visits=${groundVisitRows.length}`,
    )
  } finally {
    await proxy.dispose()
  }
}

// Only run the import when invoked directly (npx tsx scripts/sb-to-d1.ts), not on import.
const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
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
