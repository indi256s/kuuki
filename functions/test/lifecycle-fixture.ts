// Shared fixtures for lifecycle migration and API tests (ADR 0001 A1/A2).
import { Miniflare } from 'miniflare'
import { applyMigrations, migrationStatements } from '../../scripts/_migrations'

export const LIFECYCLE_MIGRATION = '0006_flight_lifecycle.sql'

/** A private D1 database migrated through `through` (inclusive numeric prefix). */
export async function databaseThrough(through?: string) {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: { DB: 'kuuki-lifecycle-test' },
  })
  const db = await mf.getD1Database('DB')
  await applyMigrations(db, through === undefined ? {} : { through })
  return { db, dispose: () => mf.dispose() }
}

/** Apply one migration file atomically in one D1 batch, as a single transaction. */
export async function applyMigrationAtomically(db: D1Database, file: string): Promise<void> {
  await db.batch(migrationStatements(file).map(statement => db.prepare(statement)))
}

// ---------------------------------------------------------------------------
// Pre-lifecycle writers, verbatim from abe1d80 (the build below the rollback floor).
// ---------------------------------------------------------------------------

export const OLD_CREATE_LEDGER =
  'INSERT INTO flight_idempotency (user_id, key, payload_digest, flight_id, created_at) VALUES (?, ?, ?, NULL, ?) ON CONFLICT (user_id, key) DO NOTHING'
export const OLD_CREATE_FLIGHT = `INSERT INTO flights (
       date, origin, destination, airline_iata, aircraft_icao, flight_number,
       departure_time, arrival_time, departure_utc, arrival_utc, origin_tz, dest_tz,
       distance_km, duration_minutes, source, is_upcoming, enrichment_status, user_id
     ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`
export const OLD_CREATE_LINK =
  'UPDATE flight_idempotency SET flight_id = last_insert_rowid() WHERE user_id = ? AND key = ? AND flight_id IS NULL AND changes() = 1'
export const OLD_EDIT = `UPDATE flights SET
         date = ?, origin = ?, destination = ?, airline_iata = ?, aircraft_icao = ?, flight_number = ?,
         departure_time = ?, arrival_time = ?, departure_utc = ?, arrival_utc = ?, origin_tz = ?, dest_tz = ?,
         distance_km = ?, duration_minutes = ?, source = ?, is_upcoming = ?, enrichment_status = ?
       WHERE id = ? AND user_id = ?`
export const OLD_SYNC = 'UPDATE flights SET is_upcoming = 0 WHERE user_id = ? AND is_upcoming = 1 AND date <= ?'
export const OLD_CRON = `UPDATE flights SET is_upcoming = 0 WHERE user_id = ? AND is_upcoming = 1
             AND date <= ? AND id IN (SELECT value FROM json_each(?))`

/** The old create chain for one flight; returns the batch results. */
export function oldCreate(db: D1Database, userId: string, key: string, flight: { date: string; origin: string; destination: string }, isUpcoming: 0 | 1) {
  return db.batch([
    db.prepare(OLD_CREATE_LEDGER).bind(userId, key, `digest-${key}`, new Date().toISOString()),
    db.prepare(OLD_CREATE_FLIGHT).bind(flight.date, flight.origin, flight.destination, null, null, null, null, null, null, null,
      null, null, null, null, 'manual', isUpcoming, 'skipped', userId),
    db.prepare(OLD_CREATE_LINK).bind(userId, key),
  ])
}

type OldRow = {
  id: number; user_id: string; date: string; origin: string; destination: string; airline_iata: string | null
  aircraft_icao: string | null; flight_number: string | null; departure_time: string | null; arrival_time: string | null
  departure_utc: string | null; arrival_utc: string | null; origin_tz: string | null; dest_tz: string | null
  distance_km: number | null; duration_minutes: number | null; source: string; is_upcoming: number; enrichment_status: string
}

/** The old PATCH: rewrites every pre-lifecycle column; is_upcoming from the old UTC rule only when the date is patched. */
export async function oldEdit(db: D1Database, id: number, patch: Partial<Pick<OldRow, 'date' | 'origin' | 'destination' | 'flight_number'>>, utcToday: string) {
  const row = await db.prepare('SELECT * FROM flights WHERE id = ?').bind(id).first<OldRow>()
  if (!row) throw new Error(`flight ${id} missing`)
  const next = { ...row, ...patch }
  const isUpcoming = patch.date ? (next.date > utcToday ? 1 : 0) : row.is_upcoming
  return db.prepare(OLD_EDIT).bind(next.date, next.origin, next.destination, next.airline_iata, next.aircraft_icao, next.flight_number,
    next.departure_time, next.arrival_time, next.departure_utc, next.arrival_utc, next.origin_tz, next.dest_tz,
    next.distance_km, next.duration_minutes, next.source, isUpcoming, next.enrichment_status, id, row.user_id).run()
}

// ---------------------------------------------------------------------------
// Trigger manipulation (test-only).
// ---------------------------------------------------------------------------

export const ADAPTERS = ['flights_lifecycle_adapt_insert', 'flights_lifecycle_adapt_flag', 'flights_lifecycle_adapt_redate'] as const

/** The 0006 CREATE TRIGGER statements in creation order. */
export function lifecycleTriggerStatements(): Array<{ name: string; sql: string }> {
  return migrationStatements(LIFECYCLE_MIGRATION)
    .filter(statement => /^\s*CREATE\s+TRIGGER/i.test(statement.replace(/^(\s*--[^\n]*\n)+/, '')))
    .map(sql => ({ name: /CREATE\s+TRIGGER\s+(\w+)/i.exec(sql)![1], sql }))
}

/** Recreate the lifecycle triggers so SQLite fires them in the opposite order to 0006. */
export async function reverseTriggerOrder(db: D1Database): Promise<void> {
  const triggers = lifecycleTriggerStatements()
  await db.batch([
    ...triggers.map(trigger => db.prepare(`DROP TRIGGER ${trigger.name}`)),
    ...[...triggers].reverse().map(trigger => db.prepare(trigger.sql)),
  ])
}

/** Recreate adapters 1–3 with an extra first statement that records each firing. */
export async function countAdapterFirings(db: D1Database): Promise<() => Promise<Record<string, number>>> {
  const adapters = lifecycleTriggerStatements().filter(trigger => (ADAPTERS as readonly string[]).includes(trigger.name))
  if (adapters.length !== ADAPTERS.length) throw new Error('Adapter triggers not found in 0006')
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS _adapter_hits (name TEXT NOT NULL)'),
    ...adapters.map(trigger => db.prepare(`DROP TRIGGER ${trigger.name}`)),
    ...adapters.map(trigger => db.prepare(trigger.sql.replace(/\bBEGIN\b/, `BEGIN INSERT INTO _adapter_hits (name) VALUES ('${trigger.name}');`))),
  ])
  return async () => {
    const rows = await db.prepare('SELECT name, COUNT(*) AS n FROM _adapter_hits GROUP BY name').all<{ name: string; n: number }>()
    return Object.fromEntries(rows.results.map(row => [row.name, row.n]))
  }
}

export type LifecycleRow = {
  id: number; date: string; is_upcoming: number; lifecycle_state: string | null; confirmation_source: string | null
  confirmed_at: string | null; lifecycle_timezone: string | null; awaiting_after: string | null; auto_confirm_after: string | null
  arrival_transit: number | null; arrival_transit_leg_id: number | null; created_at: string; origin: string; destination: string
}

export function lifecycleOf(db: D1Database, id: number): Promise<LifecycleRow | null> {
  return db.prepare(`SELECT id, date, origin, destination, is_upcoming, lifecycle_state, confirmation_source, confirmed_at,
    lifecycle_timezone, awaiting_after, auto_confirm_after, arrival_transit, arrival_transit_leg_id, created_at
    FROM flights WHERE id = ?`).bind(id).first<LifecycleRow>()
}
