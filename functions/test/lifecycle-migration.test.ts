// ADR 0001 A1/A2 (T07): the additive lifecycle migration, its adapters and invariant checks.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrationStatements } from '../../scripts/_migrations'
import { repairUserDerivedState } from '../api/_services/derivedState'
import {
  LIFECYCLE_MIGRATION,
  OLD_CRON,
  OLD_SYNC,
  applyMigrationAtomically,
  databaseThrough,
  lifecycleOf,
  lifecycleTriggerStatements,
  oldCreate,
  oldEdit,
  reverseTriggerOrder,
} from './lifecycle-fixture'

const U1 = 'user-one'
const U2 = 'user-two'
const AIRPORTS: Array<[string, string, string]> = [
  ['TBS', 'GE', 'Tbilisi'],
  ['IST', 'TR', 'Istanbul'],
  ['JFK', 'US', 'New York'],
  ['LHR', 'GB', 'London'],
  ['CDG', 'FR', 'Paris'],
]

/** Old-shape rows written at 0005: flights, consistent published visits, stats, badges and passport evidence. */
async function seedPreLifecycle(db: D1Database) {
  const flight = (
    id: number,
    user: string,
    date: string,
    origin: string,
    destination: string,
    upcoming: 0 | 1,
  ) =>
    db
      .prepare(`INSERT INTO flights (id,user_id,date,origin,destination,is_upcoming,enrichment_status,created_at)
      VALUES (?,?,?,?,?,?,'skipped','2024-01-01T00:00:00.000Z')`)
      .bind(id, user, date, origin, destination, upcoming)
  const visit = (
    user: string,
    iata: string,
    country: string,
    city: string,
    first: string,
    last: string,
    n: number,
  ) =>
    db
      .prepare(
        'INSERT INTO visits (user_id,country_code,airport_iata,city,first_visit,last_visit,visit_count) VALUES (?,?,?,?,?,?,?)',
      )
      .bind(user, country, iata, city, first, last, n)
  await db.batch([
    ...[U1, U2].map((id) =>
      db
        .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
        .bind(id, `${id}@example.test`, 'hash'),
    ),
    ...AIRPORTS.map(([iata, cc, city]) =>
      db
        .prepare(
          'INSERT INTO airports_reference (iata,name,city,country,country_code,latitude,longitude) VALUES (?,?,?,?,?,?,?)',
        )
        .bind(iata, iata, city, cc, cc, 41, 41),
    ),
    flight(10, U1, '2024-01-01', 'TBS', 'IST', 0),
    flight(11, U1, '2024-01-02', 'IST', 'JFK', 0),
    flight(12, U1, '2024-06-01', 'JFK', 'LHR', 0),
    flight(13, U1, '2025-01-01', 'LHR', 'TBS', 1), // overdue upcoming
    flight(14, U1, '2030-01-01', 'TBS', 'CDG', 1), // future upcoming
    flight(20, U2, '2024-03-03', 'CDG', 'LHR', 0),
    flight(25, U1, '2024-02-02', 'TBS', 'IST', 0),
    db.prepare('DELETE FROM flights WHERE id = 25'), // sqlite_sequence stays at 25
    visit(U1, 'TBS', 'GE', 'Tbilisi', '2024-01-01', '2024-01-01', 1),
    visit(U1, 'IST', 'TR', 'Istanbul', '2024-01-01', '2024-01-02', 2),
    visit(U1, 'JFK', 'US', 'New York', '2024-01-02', '2024-06-01', 2),
    visit(U1, 'LHR', 'GB', 'London', '2024-06-01', '2024-06-01', 1),
    visit(U1, 'CDG', 'FR', 'Paris', '2019-05-01', '2019-06-01', 2), // legacy-only airport
    visit(U2, 'CDG', 'FR', 'Paris', '2024-03-03', '2024-03-03', 1),
    visit(U2, 'LHR', 'GB', 'London', '2024-03-03', '2024-03-03', 1),
    db
      .prepare(`INSERT INTO legacy_visit_evidence
      (source_id,user_id,airport_iata,country_code,city,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
      VALUES ('legacy-cdg',?,'CDG','FR','Paris','2019-05-01','2019-06-01',2,'d','archive',1,'{}')`)
      .bind(U1),
    db
      .prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('claim-jp',?,'JP')")
      .bind(U1),
    db
      .prepare(
        "INSERT INTO ground_visits (id,user_id,country_code) VALUES ('g1',?,'DE'),('g2',?,'DE'),('g3',?,'GE')",
      )
      .bind(U1, U1, U1),
    db.prepare(
      "INSERT INTO badge_definitions (id,code,name) VALUES (63,'founding-user','Founding user')",
    ),
    db
      .prepare(
        "INSERT INTO user_badges (user_id,badge_id,earned_at) VALUES (?,63,'2024-01-01T00:00:00.000Z')",
      )
      .bind(U1),
    db
      .prepare(
        'INSERT INTO user_stats (user_id,total_flights,countries_count,airports_count) VALUES (?,3,5,5),(?,1,2,2)',
      )
      .bind(U1, U2),
    db
      .prepare(
        "INSERT INTO flight_idempotency (user_id,key,payload_digest,flight_id,created_at) VALUES (?,'receipt-10','d',10,'2024-01-01T00:00:00.000Z')",
      )
      .bind(U1),
    db
      .prepare(
        'INSERT INTO user_derived_state (user_id,revision,published_revision) VALUES (?,4,4),(?,2,2)',
      )
      .bind(U1, U2),
  ])
}

const PRESERVED: Record<string, string> = {
  flights: `SELECT id,user_id,date,origin,destination,airline_iata,aircraft_icao,flight_number,departure_time,arrival_time,
    departure_utc,arrival_utc,origin_tz,dest_tz,distance_km,duration_minutes,source,is_upcoming,enrichment_status,
    aircraft_lookup_attempts,created_at FROM flights ORDER BY id`,
  visits: 'SELECT * FROM visits ORDER BY id',
  user_stats: 'SELECT * FROM user_stats ORDER BY user_id',
  user_badges: 'SELECT * FROM user_badges ORDER BY id',
  country_claims: 'SELECT * FROM country_claims ORDER BY id',
  ground_visits: 'SELECT * FROM ground_visits ORDER BY id',
  legacy_visit_evidence: 'SELECT * FROM legacy_visit_evidence ORDER BY source_id',
  flight_idempotency: 'SELECT * FROM flight_idempotency ORDER BY user_id, key',
  derived: 'SELECT user_id, revision, published_revision FROM user_derived_state ORDER BY user_id',
  sequence: "SELECT seq FROM sqlite_sequence WHERE name = 'flights'",
}

async function snapshot(db: D1Database) {
  const out: Record<string, unknown[]> = {}
  for (const [name, sql] of Object.entries(PRESERVED))
    out[name] = (await db.prepare(sql).all()).results
  return out
}

function evidence(db: D1Database) {
  return db
    .prepare(`SELECT user_id,country_code,status,logged_visit_count,awaiting_visit_count,claimed,ground_visit_count,
    first_visit,last_visit,policy_version FROM country_visit_evidence ORDER BY user_id, country_code`)
    .all()
    .then((r) => r.results)
}

describe('0006 upgrade from 0005 with historical rows (A2)', () => {
  it('preserves identities, published evidence and counts, and backfills lifecycle without a dirty mark', async () => {
    const { db, dispose } = await databaseThrough('0005')
    try {
      await seedPreLifecycle(db)
      const before = await snapshot(db)
      await applyMigrationAtomically(db, LIFECYCLE_MIGRATION)
      expect(await snapshot(db)).toEqual(before)

      const rows = await db
        .prepare(`SELECT id, lifecycle_state, confirmation_source, confirmed_at, lifecycle_timezone,
        awaiting_after, auto_confirm_after, arrival_transit, arrival_transit_leg_id FROM flights ORDER BY id`)
        .all()
      const legacy = {
        lifecycle_state: 'logged',
        confirmation_source: 'legacy',
        confirmed_at: null,
        lifecycle_timezone: null,
        awaiting_after: null,
        auto_confirm_after: null,
        arrival_transit: null,
        arrival_transit_leg_id: null,
      }
      expect(rows.results).toEqual([
        { id: 10, ...legacy },
        { id: 11, ...legacy },
        { id: 12, ...legacy },
        {
          id: 13,
          lifecycle_state: 'upcoming',
          confirmation_source: null,
          confirmed_at: null,
          lifecycle_timezone: 'UTC',
          awaiting_after: '2025-01-02T00:00:00.000Z',
          auto_confirm_after: '2025-01-09T00:00:00.000Z',
          arrival_transit: null,
          arrival_transit_leg_id: null,
        },
        {
          id: 14,
          lifecycle_state: 'upcoming',
          confirmation_source: null,
          confirmed_at: null,
          lifecycle_timezone: 'UTC',
          awaiting_after: '2030-01-02T00:00:00.000Z',
          auto_confirm_after: '2030-01-09T00:00:00.000Z',
          arrival_transit: null,
          arrival_transit_leg_id: null,
        },
        { id: 20, ...legacy },
      ])
      expect(await evidence(db)).toEqual([
        {
          user_id: U1,
          country_code: 'DE',
          status: 'pressed',
          logged_visit_count: 0,
          awaiting_visit_count: 0,
          claimed: 0,
          ground_visit_count: 2,
          first_visit: null,
          last_visit: null,
          policy_version: 1,
        },
        {
          user_id: U1,
          country_code: 'FR',
          status: 'pressed',
          logged_visit_count: 2,
          awaiting_visit_count: 0,
          claimed: 0,
          ground_visit_count: 0,
          first_visit: '2019-05-01',
          last_visit: '2019-06-01',
          policy_version: 1,
        },
        {
          user_id: U1,
          country_code: 'GB',
          status: 'pressed',
          logged_visit_count: 1,
          awaiting_visit_count: 0,
          claimed: 0,
          ground_visit_count: 0,
          first_visit: '2024-06-01',
          last_visit: '2024-06-01',
          policy_version: 1,
        },
        {
          user_id: U1,
          country_code: 'GE',
          status: 'pressed',
          logged_visit_count: 1,
          awaiting_visit_count: 0,
          claimed: 0,
          ground_visit_count: 1,
          first_visit: '2024-01-01',
          last_visit: '2024-01-01',
          policy_version: 1,
        },
        {
          user_id: U1,
          country_code: 'JP',
          status: 'pressed',
          logged_visit_count: 0,
          awaiting_visit_count: 0,
          claimed: 1,
          ground_visit_count: 0,
          first_visit: null,
          last_visit: null,
          policy_version: 1,
        },
        {
          user_id: U1,
          country_code: 'TR',
          status: 'pressed',
          logged_visit_count: 2,
          awaiting_visit_count: 0,
          claimed: 0,
          ground_visit_count: 0,
          first_visit: '2024-01-01',
          last_visit: '2024-01-02',
          policy_version: 1,
        },
        {
          user_id: U1,
          country_code: 'US',
          status: 'pressed',
          logged_visit_count: 2,
          awaiting_visit_count: 0,
          claimed: 0,
          ground_visit_count: 0,
          first_visit: '2024-01-02',
          last_visit: '2024-06-01',
          policy_version: 1,
        },
        {
          user_id: U2,
          country_code: 'FR',
          status: 'pressed',
          logged_visit_count: 1,
          awaiting_visit_count: 0,
          claimed: 0,
          ground_visit_count: 0,
          first_visit: '2024-03-03',
          last_visit: '2024-03-03',
          policy_version: 1,
        },
        {
          user_id: U2,
          country_code: 'GB',
          status: 'pressed',
          logged_visit_count: 1,
          awaiting_visit_count: 0,
          claimed: 0,
          ground_visit_count: 0,
          first_visit: '2024-03-03',
          last_visit: '2024-03-03',
          policy_version: 1,
        },
      ])
      expect(
        (
          await db
            .prepare('SELECT user_id, evidence_revision FROM user_derived_state ORDER BY user_id')
            .all()
        ).results,
      ).toEqual([
        { user_id: U1, evidence_revision: 4 },
        { user_id: U2, evidence_revision: 2 },
      ])
      for (const table of [
        'country_evidence_suppressions',
        'lifecycle_operation_receipts',
        'transit_cleanup_markers',
      ]) {
        expect(
          (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n,
        ).toBe(0)
      }
      expect(
        await db.prepare("SELECT name FROM sqlite_master WHERE name = '_m0006_assert'").first(),
      ).toBeNull()

      // No table rebuild: a new row continues the AUTOINCREMENT sequence, never reusing deleted id 25.
      const [, inserted] = await oldCreate(
        db,
        U1,
        'after-upgrade',
        { date: '2024-05-05', origin: 'TBS', destination: 'IST' },
        0,
      )
      expect(inserted.meta.last_row_id).toBe(26)
    } finally {
      await dispose()
    }
  })

  it('seeds exactly what the first lifecycle-aware repair publishes, without moving historical evidence', async () => {
    const { db, dispose } = await databaseThrough('0005')
    try {
      await seedPreLifecycle(db)
      await applyMigrationAtomically(db, LIFECYCLE_MIGRATION)
      const seeded = await evidence(db)
      const visits = (await db.prepare(PRESERVED.visits).all()).results
      const badges = (await db.prepare(PRESERVED.user_badges).all()).results
      await db.prepare('UPDATE user_derived_state SET revision = revision + 1').run()
      for (const user of [U1, U2])
        expect(await repairUserDerivedState(db, user)).toMatchObject({ derived_state: 'ready' })
      expect(await evidence(db)).toEqual(seeded)
      expect((await db.prepare(PRESERVED.visits).all()).results).toEqual(visits)
      expect((await db.prepare(PRESERVED.user_badges).all()).results).toEqual(badges)
      expect(
        (await db.prepare('SELECT user_id, countries_count FROM user_stats ORDER BY user_id').all())
          .results,
      ).toEqual([
        { user_id: U1, countries_count: 5 },
        { user_id: U2, countries_count: 2 },
      ])
      expect(
        (
          await db
            .prepare(
              'SELECT user_id, revision, published_revision, evidence_revision FROM user_derived_state ORDER BY user_id',
            )
            .all()
        ).results,
      ).toEqual([
        { user_id: U1, revision: 5, published_revision: 5, evidence_revision: 5 },
        { user_id: U2, revision: 3, published_revision: 3, evidence_revision: 3 },
      ])
    } finally {
      await dispose()
    }
  })

  it('keeps an empty reference country out of the projection while publishing the airport', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedPreLifecycle(db)
      await db.batch([
        db.prepare(
          "INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('ZZZ','Z','Nowhere','','')",
        ),
        db
          .prepare(
            "INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,'2024-05-05','LHR','ZZZ',0)",
          )
          .bind(U2),
        db
          .prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?')
          .bind(U2),
      ])
      expect(await repairUserDerivedState(db, U2)).toMatchObject({ derived_state: 'ready' })
      expect(
        await db
          .prepare("SELECT country_code FROM visits WHERE user_id = ? AND airport_iata = 'ZZZ'")
          .bind(U2)
          .first(),
      ).toEqual({ country_code: '' })
      expect(
        (
          await db
            .prepare('SELECT country_code FROM country_visit_evidence WHERE user_id = ? ORDER BY 1')
            .bind(U2)
            .all()
        ).results,
      ).toEqual([{ country_code: 'FR' }, { country_code: 'GB' }])
    } finally {
      await dispose()
    }
  })

  it('creates the six lifecycle triggers and the due-work indexes', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      const triggers = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'flights_lifecycle_%' ORDER BY name",
        )
        .all<{ name: string }>()
      expect(triggers.results.map((row) => row.name)).toEqual([
        'flights_lifecycle_adapt_flag',
        'flights_lifecycle_adapt_insert',
        'flights_lifecycle_adapt_redate',
        'flights_lifecycle_adapt_route',
        'flights_lifecycle_check_insert',
        'flights_lifecycle_check_update',
      ])
      expect(lifecycleTriggerStatements().map((trigger) => trigger.name)).toEqual([
        'flights_lifecycle_adapt_insert',
        'flights_lifecycle_adapt_flag',
        'flights_lifecycle_adapt_redate',
        'flights_lifecycle_adapt_route',
        'flights_lifecycle_check_insert',
        'flights_lifecycle_check_update',
      ])
      const indexes = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_flights_user_lifecycle','idx_flights_due_upcoming','idx_flights_due_awaiting','idx_country_evidence_user_status','idx_lifecycle_receipts_created','idx_user_derived_stale') ORDER BY name",
        )
        .all<{ name: string }>()
      expect(indexes.results).toHaveLength(6)
    } finally {
      await dispose()
    }
  })

  it('refuses to migrate when published visits carry an empty country code', async () => {
    const { db, dispose } = await databaseThrough('0005')
    try {
      await seedPreLifecycle(db)
      await db
        .prepare(
          "INSERT INTO visits (user_id,country_code,airport_iata,first_visit,last_visit) VALUES (?,'','ZZZ','2020-01-01','2020-01-01')",
        )
        .bind(U2)
        .run()
      await expect(applyMigrationAtomically(db, LIFECYCLE_MIGRATION)).rejects.toThrow()
      const columns = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM pragma_table_info('flights') WHERE name = 'lifecycle_state'",
        )
        .first<{ n: number }>()
      expect(columns?.n).toBe(0)
    } finally {
      await dispose()
    }
  })

  it('refuses to migrate an upcoming flight whose date cannot produce deadlines', async () => {
    const { db, dispose } = await databaseThrough('0005')
    try {
      await seedPreLifecycle(db)
      await db
        .prepare(
          "INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,'2030-13-45','TBS','IST',1)",
        )
        .bind(U2)
        .run()
      await expect(applyMigrationAtomically(db, LIFECYCLE_MIGRATION)).rejects.toThrow()
    } finally {
      await dispose()
    }
  })

  it('ships a read-only pre-check that finds both blocking conditions', async () => {
    const { db, dispose } = await databaseThrough('0005')
    try {
      await seedPreLifecycle(db)
      const sql = readFileSync(resolve('db/prechecks/0006_flight_lifecycle.sql'), 'utf8')
      const run = async () =>
        (await db.prepare(sql).all<{ problem: string }>()).results.map((row) => row.problem)
      expect(await run()).toEqual([])
      await db.batch([
        db
          .prepare(
            "INSERT INTO visits (user_id,country_code,airport_iata,first_visit,last_visit) VALUES (?,'','ZZZ','2020-01-01','2020-01-01')",
          )
          .bind(U2),
        db
          .prepare(
            "INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,'2030-13-45','TBS','IST',1)",
          )
          .bind(U2),
      ])
      expect((await run()).sort()).toEqual(['empty_visit_country', 'malformed_upcoming_date'])
    } finally {
      await dispose()
    }
  })
})

describe('D1 trigger semantics (A1)', () => {
  it('rolls back the whole batch when a lifecycle check raises', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedPreLifecycle(db)
      await expect(
        db.batch([
          db
            .prepare(
              "INSERT INTO country_claims (id,user_id,country_code) VALUES ('claim-x',?,'IT')",
            )
            .bind(U2),
          db.prepare(
            "UPDATE flights SET lifecycle_state = 'logged', is_upcoming = 0 WHERE id = 14",
          ), // no provenance
        ]),
      ).rejects.toThrow(/LIFECYCLE_INVARIANT/)
      expect(
        await db.prepare("SELECT id FROM country_claims WHERE id = 'claim-x'").first(),
      ).toBeNull()
      expect((await lifecycleOf(db, 14))?.lifecycle_state).toBe('upcoming')
    } finally {
      await dispose()
    }
  })

  it('keeps SQL changes()/last_insert_rowid() direct-only; D1 meta.changes also counts adapter writes', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedPreLifecycle(db)
      // Old create chain: the adapter's nested UPDATE neither breaks the changes() chain nor
      // last_insert_rowid(), and the old build's `created` read (statement 0, the ledger) is exact.
      const [ledger, insert, link] = await oldCreate(
        db,
        U2,
        'old-create-1',
        { date: '2031-02-03', origin: 'TBS', destination: 'IST' },
        1,
      )
      expect(ledger.meta.changes).toBe(1)
      expect(link.meta.changes).toBe(1)
      const receipt = await db
        .prepare("SELECT flight_id FROM flight_idempotency WHERE key = 'old-create-1'")
        .first<{ flight_id: number }>()
      expect(receipt?.flight_id).toBe(insert.meta.last_row_id)
      expect((await lifecycleOf(db, receipt!.flight_id))?.lifecycle_state).toBe('upcoming')
      // D1 meta.changes is a total_changes() delta (ADR §1): it includes the adapter's nested write.
      // Old readers only test `> 0`, log it, or read the trigger-free ledger statement.
      expect(insert.meta.changes).toBe(2)

      await oldCreate(
        db,
        U2,
        'old-create-2',
        { date: '2031-02-04', origin: 'TBS', destination: 'IST' },
        1,
      )
      const [sync, direct] = await db.batch([
        db.prepare(OLD_SYNC).bind(U2, '2031-12-31'),
        db.prepare('SELECT changes() AS n'),
      ])
      expect(direct.results).toEqual([{ n: 2 }]) // two direct changes
      expect(sync.meta.changes).toBe(4) // plus two adapter writes

      await oldCreate(
        db,
        U1,
        'old-create-3',
        { date: '2031-02-05', origin: 'TBS', destination: 'IST' },
        1,
      )
      const due = await db
        .prepare(
          "SELECT id FROM flights WHERE user_id = ? AND is_upcoming = 1 AND date <= '2031-12-31'",
        )
        .bind(U1)
        .all<{ id: number }>()
      const [cron, cronDirect] = await db.batch([
        db
          .prepare(OLD_CRON)
          .bind(U1, '2031-12-31', JSON.stringify(due.results.map((row) => row.id))),
        db.prepare('SELECT changes() AS n'),
      ])
      expect(cronDirect.results).toEqual([{ n: 3 }]) // 13, 14 and the new row
      expect(cron.meta.changes).toBe(6)

      // A lifecycle-aware write fires only the check triggers, which never write: meta.changes is exact.
      // The target must match the WHERE set, so assert the precondition first (the cron moved 13 and 14 out of it).
      const [, upcomingInsert] = await oldCreate(
        db,
        U1,
        'old-create-4',
        { date: '2031-12-30', origin: 'TBS', destination: 'IST' },
        1,
      )
      const upcomingId = upcomingInsert.meta.last_row_id as number
      expect((await lifecycleOf(db, 13))?.lifecycle_state).toBe('awaiting')
      expect((await lifecycleOf(db, upcomingId))?.lifecycle_state).toBe('upcoming')
      const aware = await db
        .prepare(
          "UPDATE flights SET lifecycle_state = 'upcoming', is_upcoming = 1, flight_number = 'AW1' WHERE id = ? AND lifecycle_state = 'upcoming'",
        )
        .bind(upcomingId)
        .run()
      expect(aware.meta.changes).toBe(1) // the one direct row; no adapter write is added
      const missed = await db
        .prepare(
          "UPDATE flights SET flight_number = 'AW2' WHERE id = 13 AND lifecycle_state = 'upcoming'",
        )
        .run()
      expect(missed.meta.changes).toBe(0) // a row outside the set matches nothing
      const [flagged, flaggedDirect] = await db.batch([
        db.prepare("UPDATE flights SET flight_number = 'X1' WHERE user_id = ?").bind(U1),
        db.prepare('SELECT changes() AS n'),
      ])
      const flaggedRows = (flaggedDirect.results[0] as { n: number }).n
      expect(flaggedRows).toBe(
        (await db
          .prepare('SELECT COUNT(*) AS n FROM flights WHERE user_id = ?')
          .bind(U1)
          .first<{ n: number }>())!.n,
      )
      expect(flagged.meta.changes).toBe(flaggedRows) // an edit of a column no adapter watches adds no adapter writes
    } finally {
      await dispose()
    }
  })
})

describe('pre-lifecycle writers after 0006 (A2, §1 adapters)', () => {
  const today = '2026-10-05'

  it('adapts old past and future creates', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedPreLifecycle(db)
      const [, past] = await oldCreate(
        db,
        U2,
        'old-past',
        { date: '2026-10-01', origin: 'TBS', destination: 'IST' },
        0,
      )
      const [, future] = await oldCreate(
        db,
        U2,
        'old-future',
        { date: '2026-12-24', origin: 'TBS', destination: 'IST' },
        1,
      )
      const logged = await lifecycleOf(db, past.meta.last_row_id as number)
      expect(logged).toMatchObject({
        lifecycle_state: 'logged',
        confirmation_source: 'save',
        is_upcoming: 0,
        lifecycle_timezone: null,
        awaiting_after: null,
        auto_confirm_after: null,
      })
      expect(logged?.confirmed_at).toBe(logged?.created_at)
      expect(await lifecycleOf(db, future.meta.last_row_id as number)).toMatchObject({
        lifecycle_state: 'upcoming',
        is_upcoming: 1,
        confirmation_source: null,
        confirmed_at: null,
        lifecycle_timezone: 'UTC',
        awaiting_after: '2026-12-25T00:00:00.000Z',
        auto_confirm_after: '2027-01-01T00:00:00.000Z',
      })
    } finally {
      await dispose()
    }
  })

  it('moves flights flipped by the old sync or cron to awaiting, never logged, keeping deadlines', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedPreLifecycle(db)
      await db.prepare(OLD_SYNC).bind(U1, today).run()
      expect(await lifecycleOf(db, 13)).toMatchObject({
        lifecycle_state: 'awaiting',
        is_upcoming: 0,
        confirmation_source: null,
        confirmed_at: null,
        lifecycle_timezone: 'UTC',
        awaiting_after: '2025-01-02T00:00:00.000Z',
        auto_confirm_after: '2025-01-09T00:00:00.000Z',
      })
      expect((await lifecycleOf(db, 14))?.lifecycle_state).toBe('upcoming')
      await db
        .prepare(OLD_CRON)
        .bind(U1, '2030-01-01', JSON.stringify([14]))
        .run()
      expect(await lifecycleOf(db, 14)).toMatchObject({
        lifecycle_state: 'awaiting',
        awaiting_after: '2030-01-02T00:00:00.000Z',
      })
    } finally {
      await dispose()
    }
  })

  it('adapts old edits into the future from logged (UTC deadlines) and awaiting (shifted deadlines)', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedPreLifecycle(db)
      await oldEdit(db, 10, { date: '2026-12-01' }, today)
      expect(await lifecycleOf(db, 10)).toMatchObject({
        lifecycle_state: 'upcoming',
        is_upcoming: 1,
        confirmation_source: null,
        confirmed_at: null,
        lifecycle_timezone: 'UTC',
        awaiting_after: '2026-12-02T00:00:00.000Z',
        auto_confirm_after: '2026-12-09T00:00:00.000Z',
      })

      // An awaiting flight with a captured zone is shifted by the whole-day difference, keeping its zone.
      await db
        .prepare(`UPDATE flights SET lifecycle_state = 'awaiting', is_upcoming = 0, lifecycle_timezone = 'Asia/Tbilisi',
        awaiting_after = '2025-01-01T20:00:00.000Z', auto_confirm_after = '2025-01-08T20:00:00.000Z' WHERE id = 13`)
        .run()
      await oldEdit(db, 13, { date: '2026-11-01' }, today)
      expect(await lifecycleOf(db, 13)).toMatchObject({
        lifecycle_state: 'upcoming',
        is_upcoming: 1,
        lifecycle_timezone: 'Asia/Tbilisi',
        awaiting_after: '2026-11-01T20:00:00.000Z',
        auto_confirm_after: '2026-11-08T20:00:00.000Z',
      })
    } finally {
      await dispose()
    }
  })

  it('shifts deadlines on an old re-date that keeps the flag (upcoming future→future, awaiting past→past)', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedPreLifecycle(db)
      await oldEdit(db, 14, { date: '2030-03-10' }, today)
      expect(await lifecycleOf(db, 14)).toMatchObject({
        lifecycle_state: 'upcoming',
        is_upcoming: 1,
        awaiting_after: '2030-03-11T00:00:00.000Z',
        auto_confirm_after: '2030-03-18T00:00:00.000Z',
      })

      await db.prepare(OLD_SYNC).bind(U1, today).run() // 13 → awaiting
      await oldEdit(db, 13, { date: '2026-09-30' }, today)
      expect(await lifecycleOf(db, 13)).toMatchObject({
        lifecycle_state: 'awaiting',
        is_upcoming: 0,
        awaiting_after: '2026-10-01T00:00:00.000Z',
        auto_confirm_after: '2026-10-08T00:00:00.000Z',
      })
    } finally {
      await dispose()
    }
  })

  it('clears a transit decision on an old route edit and leaves lifecycle alone on other old edits', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedPreLifecycle(db)
      await db
        .prepare(
          'UPDATE flights SET arrival_transit = 1, arrival_transit_leg_id = 12 WHERE id = 11',
        )
        .run()
      const before = await lifecycleOf(db, 11)
      await oldEdit(db, 11, { flight_number: 'TK1' }, today)
      expect(await lifecycleOf(db, 11)).toEqual(before)
      await oldEdit(db, 11, { destination: 'LHR' }, today)
      expect(await lifecycleOf(db, 11)).toMatchObject({
        lifecycle_state: 'logged',
        confirmation_source: 'save',
        arrival_transit: null,
        arrival_transit_leg_id: null,
      })
    } finally {
      await dispose()
    }
  })

  it('F1: an old re-date of a logged flight anchors UTC deadlines to the new date, not stale ones', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedPreLifecycle(db)
      const [, created] = await oldCreate(
        db,
        U2,
        'f1',
        { date: '2026-11-10', origin: 'TBS', destination: 'IST' },
        1,
      ) // D0
      const id = created.meta.last_row_id as number
      await db
        .prepare(`UPDATE flights SET lifecycle_state = 'logged', confirmation_source = 'user', confirmed_at = '2026-11-12T08:00:00.000Z',
        is_upcoming = 0 WHERE id = ?`)
        .bind(id)
        .run() // a confirm (T09) keeps the D0 deadlines
      await db.prepare("UPDATE flights SET date = '2026-09-01' WHERE id = ?").bind(id).run() // lifecycle-aware logged re-date to D1
      await oldEdit(db, id, { date: '2027-02-20' }, today) // old re-date to future D2
      expect(await lifecycleOf(db, id)).toMatchObject({
        lifecycle_state: 'upcoming',
        confirmation_source: null,
        confirmed_at: null,
        lifecycle_timezone: 'UTC',
        awaiting_after: '2027-02-21T00:00:00.000Z',
        auto_confirm_after: '2027-02-28T00:00:00.000Z',
      })
    } finally {
      await dispose()
    }
  })

  for (const order of ['0006 order', 'reversed order'] as const) {
    it(`F3: an old route+date-to-future edit on a logged transit flight ends upcoming with no decision (${order})`, async () => {
      const { db, dispose } = await databaseThrough()
      try {
        await seedPreLifecycle(db)
        if (order === 'reversed order') await reverseTriggerOrder(db)
        await db
          .prepare(
            'UPDATE flights SET arrival_transit = 1, arrival_transit_leg_id = 12 WHERE id = 11',
          )
          .run()
        const edit = await oldEdit(db, 11, { date: '2027-01-15', destination: 'CDG' }, today)
        // Old route+date edit: 1 direct row plus adapter writes (observed 3 in Miniflare; the order only changes who fires first).
        expect(edit.meta.changes).toBeGreaterThan(1)
        expect(edit.meta.changes).toBeLessThanOrEqual(3)
        expect(await lifecycleOf(db, 11)).toMatchObject({
          destination: 'CDG',
          date: '2027-01-15',
          lifecycle_state: 'upcoming',
          is_upcoming: 1,
          confirmation_source: null,
          confirmed_at: null,
          arrival_transit: null,
          arrival_transit_leg_id: null,
          lifecycle_timezone: 'UTC',
          awaiting_after: '2027-01-16T00:00:00.000Z',
          auto_confirm_after: '2027-01-23T00:00:00.000Z',
        })
        // The same adapters run for the other old writers in this order too.
        await db.prepare(OLD_SYNC).bind(U1, today).run()
        expect((await lifecycleOf(db, 13))?.lifecycle_state).toBe('awaiting')
      } finally {
        await dispose()
      }
    })
  }

  it('rejects lifecycle-aware writes that break the invariant', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedPreLifecycle(db)
      const insert = (state: string, extra: string, values: string) =>
        db
          .prepare(
            `INSERT INTO flights (user_id,date,origin,destination,is_upcoming,lifecycle_state${extra}) VALUES (?,'2026-01-01','TBS','IST',${state === 'upcoming' ? 1 : 0},'${state}'${values})`,
          )
          .bind(U2)
          .run()
      await expect(insert('upcoming', '', '')).rejects.toThrow(/LIFECYCLE_INVARIANT/) // no deadlines
      await expect(insert('logged', '', '')).rejects.toThrow(/LIFECYCLE_INVARIANT/) // no provenance
      await expect(insert('logged', ',confirmation_source', ",'save'")).rejects.toThrow(
        /LIFECYCLE_INVARIANT/,
      ) // save without confirmed_at
      await expect(
        insert(
          'logged',
          ',confirmation_source,confirmed_at,arrival_transit_leg_id',
          ",'save','2026-01-01T00:00:00.000Z',12",
        ),
      ).rejects.toThrow(/LIFECYCLE_INVARIANT/) // leg without transit
      await expect(
        insert('logged', ',confirmation_source,confirmed_at', ",'save','2026-01-01T00:00:00.000Z'"),
      ).resolves.toBeTruthy()
      await expect(
        db.prepare("UPDATE flights SET lifecycle_state = 'awaiting' WHERE id = 14").run(),
      ).rejects.toThrow(/LIFECYCLE_INVARIANT/) // flag disagrees
      await expect(
        db.prepare("UPDATE flights SET lifecycle_state = 'draft' WHERE id = 14").run(),
      ).rejects.toThrow()
    } finally {
      await dispose()
    }
  })
})

it('splits every 0006 statement with the wrangler splitter, keeping trigger bodies whole', () => {
  const statements = migrationStatements(LIFECYCLE_MIGRATION)
  const triggers = statements.filter((statement) => /CREATE\s+TRIGGER/i.test(statement))
  expect(triggers).toHaveLength(6)
  for (const trigger of triggers) expect(trigger.trim()).toMatch(/END;?$/)
})
