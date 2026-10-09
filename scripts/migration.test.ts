import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unstable_splitSqlQuery } from 'wrangler'
import {
  assessSchemaAdmission,
  createLocalSchemaFixture,
  openLocalTarget,
  schemaRowsSha256,
} from './migration-target'
import { buildImportTables, importSnapshot } from './sb-to-d1'
import { repairUserDerivedState } from '../functions/api/_services/derivedState'
import { refreshLeaderboards } from '../functions/api/_services/leaderboard'
import { TABLES } from './ship-oracle'
import { renderMissingSql } from './remote-migration-proposal'
import { validateTarget } from './validate'

const LEGACY = 'legacy-source-user'
const CURRENT = 'current-app-user'
const TS = '2026-02-01T00:00:00+00:00'
const dirs: string[] = []

function syntheticSnapshot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kuuki-source-fixture-'))
  dirs.push(dir)
  const write = (name: string, rows: unknown[]) =>
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(rows))
  write('auth_users', [{ id: LEGACY, email: 'legacy@example.test', created_at: TS }])
  write('profiles', [
    {
      id: LEGACY,
      username: 'legacy',
      display_name: null,
      avatar_url: null,
      bio: null,
      home_airport: null,
      is_public: true,
      show_on_leaderboards: true,
      gemini_api_key: null,
      locale: 'en',
      created_at: TS,
      updated_at: TS,
      theme_color: null,
    },
  ])
  const flight = (id: number, date: string, origin: string, destination: string) => ({
    id,
    user_id: LEGACY,
    flight_number: null,
    date,
    departure_time: null,
    arrival_time: null,
    origin,
    destination,
    airline_iata: null,
    aircraft_icao: 'A380',
    distance_km: null,
    duration_minutes: null,
    source: 'manual',
    created_at: TS,
    is_upcoming: false,
    origin_tz: null,
    dest_tz: null,
    departure_utc: null,
    arrival_utc: null,
    enrichment_status: 'pending',
  })
  write('flights', [
    flight(495, '2026-02-01', 'LHR', 'JFK'),
    flight(496, '2026-02-02', 'JFK', 'LHR'),
  ])
  write('country_claims', [])
  write('ground_visits', [
    {
      id: 'ground-1',
      user_id: LEGACY,
      country_code: 'FR',
      visit_year: 2025,
      entry_method: 'land',
      note: 'A retained private note',
      created_at: TS,
    },
  ])
  write('visits', [
    {
      id: 1,
      user_id: LEGACY,
      airport_iata: 'LHR',
      country_code: 'GB',
      city: 'London',
      first_visit: '2025-01-01',
      last_visit: '2026-02-02',
      visit_count: 5,
    },
    {
      id: 2,
      user_id: LEGACY,
      airport_iata: 'MOW',
      country_code: 'RU',
      city: 'Moscow',
      first_visit: '2020-01-01',
      last_visit: '2020-01-01',
      visit_count: 1,
    },
  ])
  write('badge_definitions', [
    {
      id: 63,
      code: 'founding-user',
      name: 'Founding user',
      description: null,
      category: null,
      tier: null,
      icon: null,
      points: 0,
      criteria: { beta_invite: true },
    },
  ])
  write('code_adjectives', [])
  write('code_nouns', [])
  for (const table of TABLES.filter((t) => t.table !== 'visits')) {
    if (table.table === 'leaderboard_cache') {
      write(table.table, [])
      continue
    }
    const row: Record<string, unknown> = {}
    for (const spec of table.specs) {
      if (spec.col === 'user_id') row[spec.col] = LEGACY
      else if (spec.col === 'id') row[spec.col] = 43
      else if (spec.col === 'badge_id') row[spec.col] = 63
      else if (spec.kind === 'timestamp') row[spec.col] = TS
      else if (!spec.notNull) row[spec.col] = null
      else if (spec.kind === 'bool') row[spec.col] = false
      else if (spec.kind === 'int' || spec.kind === 'real') row[spec.col] = 0
      else row[spec.col] = ''
    }
    write(table.table, [row])
  }
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('isolated D1 migration', () => {
  it('changes the reference content hash when a supplement row drifts without provenance change', () => {
    const source = syntheticSnapshot()
    const original = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'reference-supplements.json'),
        'utf8',
      ),
    ) as {
      source: { sha256: string }
      airports: Array<{ name: string }>
    }
    const supplementPath = join(source, 'reference-supplement.json')
    writeFileSync(supplementPath, JSON.stringify(original))
    const before = buildImportTables(source, supplementPath).manifest
    original.airports[0].name += ' changed'
    writeFileSync(supplementPath, JSON.stringify(original))
    const after = buildImportTables(source, supplementPath).manifest
    expect(after.referenceDatasetSha256).toBe(before.referenceDatasetSha256)
    expect(after.referenceSourceSha256).not.toBe(before.referenceSourceSha256)
  })

  it('refuses changed whitespace inside schema default and CHECK literals', () => {
    const expected = [
      {
        type: 'table',
        name: 'settings',
        tbl_name: 'settings',
        sql: "CREATE TABLE settings (value TEXT DEFAULT 'a  b' CHECK(value != 'x  y'))",
      },
    ]
    const observed = [
      {
        ...expected[0],
        sql: "CREATE TABLE settings (value TEXT DEFAULT 'a b' CHECK(value != 'x y'))",
      },
    ]
    expect(schemaRowsSha256(observed)).not.toBe(schemaRowsSha256(expected))
    expect(
      assessSchemaAdmission(observed, expected, {
        accountId: 'a'.repeat(32),
        databaseId: 'b'.repeat(36),
      }),
    ).toMatchObject({
      admitted: false,
      reason: 'unreviewed-schema-variant',
    })
  })

  it('admits only a pinned, recent and complete alternate schema review', () => {
    const expected = [
      { type: 'table', name: 'users', tbl_name: 'users', sql: 'CREATE TABLE users(id TEXT)' },
    ]
    const observed = [{ ...expected[0], sql: 'CREATE TABLE users (id TEXT)' }]
    const target = { accountId: 'a'.repeat(32), databaseId: 'b'.repeat(36) }
    expect(assessSchemaAdmission(observed, expected, target).admitted).toBe(false)
    expect(
      assessSchemaAdmission(
        [
          ...observed,
          {
            type: 'table',
            name: 'unexpected',
            tbl_name: 'unexpected',
            sql: 'CREATE TABLE unexpected(id)',
          },
        ],
        expected,
        target,
      ).reason,
    ).toBe('application-object-inventory-mismatch')
    expect(
      assessSchemaAdmission(
        observed,
        [
          ...expected,
          {
            type: 'table',
            name: '_cf_METADATA',
            tbl_name: '_cf_METADATA',
            sql: 'CREATE TABLE _cf_METADATA(key)',
          },
        ],
        target,
      ).reason,
    ).toBe('unreviewed-schema-variant')
    const dir = mkdtempSync(join(tmpdir(), 'kuuki-schema-review-'))
    dirs.push(dir)
    const path = join(dir, 'review.json')
    writeFileSync(
      path,
      JSON.stringify({
        ...target,
        observedApplicationSchemaSha256: schemaRowsSha256(observed),
        expectedFreshSchemaSha256: schemaRowsSha256(expected),
        reviewedAt: new Date().toISOString(),
        semanticReview: true,
        reviewedDimensions: [
          'columns',
          'defaults',
          'primaryKeys',
          'foreignKeys',
          'uniqueIndexes',
          'indexes',
          'checks',
        ],
      }),
      { mode: 0o600 },
    )
    expect(assessSchemaAdmission(observed, expected, target, path).admitted).toBe(true)
  })

  it('renders only explicit missing-row INSERTs with safe SQL literals', () => {
    const sql = renderMissingSql(
      [
        {
          table: 'profiles',
          columns: ['id', 'display_name', 'bio'],
          rows: [[LEGACY, "O'Brien", "'); DELETE FROM users; --"]],
        },
      ],
      {
        accountId: 'a'.repeat(32),
        databaseId: 'b'.repeat(36),
        observedSchemaSha256: 'c'.repeat(64),
        manifest: {
          sourceSnapshotSha256: 'd'.repeat(64),
          referenceSourceSha256: 'e'.repeat(64),
          referenceDatasetSha256: 'f'.repeat(64),
          sourceFiles: {},
          tableRows: {},
          visitEvidence: { raw: 0, contributing: 0, derivedKeys: 0, expectedUnionKeys: 0 },
          aircraftCorrections: { count: 0, ids: [], from: 'A380', to: 'A388' },
        },
      },
    )
    expect(sql).toContain(
      "VALUES ('legacy-source-user', 'O''Brien', '''); DELETE FROM users; --');",
    )
    expect(sql.match(/^INSERT INTO /gm)).toHaveLength(1)
    expect(sql).not.toMatch(/INSERT OR (?:REPLACE|IGNORE)/)
  })

  it('includes source-scoped dirty markers in an executable remote import batch', async () => {
    const source = syntheticSnapshot()
    const fixture = await createLocalSchemaFixture()
    try {
      const target = await openLocalTarget(fixture.options)
      try {
        await target.db
          .prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)')
          .bind(CURRENT, 'current@example.test', 'current-private-hash', '2026-02-01T00:00:00.000Z')
          .run()
        const sql = renderMissingSql(
          [
            {
              table: 'users',
              columns: ['id', 'email', 'password_hash', 'created_at'],
              rows: [[LEGACY, 'legacy@example.test', 'RESET_REQUIRED', '2026-02-01T00:00:00.000Z']],
            },
          ],
          {
            accountId: 'a'.repeat(32),
            databaseId: 'b'.repeat(36),
            observedSchemaSha256: 'c'.repeat(64),
            manifest: buildImportTables(source).manifest,
            dirtyUserIds: [LEGACY],
          },
        )
        await target.db.batch(
          unstable_splitSqlQuery(sql).map((statement) => target.db.prepare(statement)),
        )
        expect(
          await target.db
            .prepare(
              'SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?',
            )
            .bind(LEGACY)
            .first(),
        ).toMatchObject({ revision: 1, published_revision: 0 })
        expect(
          await target.db
            .prepare('SELECT user_id FROM user_derived_state WHERE user_id = ?')
            .bind(CURRENT)
            .first(),
        ).toBeNull()
      } finally {
        await target.dispose()
      }
    } finally {
      fixture.cleanup()
    }
  })

  it('refuses a natural identity collision before any import write', async () => {
    const source = syntheticSnapshot()
    const fixture = await createLocalSchemaFixture()
    try {
      const target = await openLocalTarget(fixture.options)
      try {
        await target.db
          .prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)')
          .bind(CURRENT, 'LEGACY@example.test', 'existing-private-hash', '2026-02-01T00:00:00.000Z')
          .run()
        await expect(importSnapshot(target.db, source, true)).rejects.toThrow(
          'Import conflicts before writes',
        )
        const refs = await target.db
          .prepare('SELECT COUNT(*) AS n FROM aircraft_reference')
          .first<{ n: number }>()
        expect(refs?.n).toBe(0)
        const user = await target.db
          .prepare('SELECT password_hash FROM users WHERE id = ?')
          .bind(CURRENT)
          .first<{ password_hash: string }>()
        expect(user?.password_hash).toBe('existing-private-hash')
      } finally {
        await target.dispose()
      }
    } finally {
      fixture.cleanup()
    }
  })

  for (const orphan of ['visits', 'user_badges'] as const) {
    it(`refuses an orphan ${orphan} before writing reference rows`, async () => {
      const source = syntheticSnapshot()
      const path = join(source, `${orphan}.json`)
      const rows = JSON.parse(readFileSync(path, 'utf8')) as Array<Record<string, unknown>>
      rows[0][orphan === 'visits' ? 'user_id' : 'badge_id'] =
        orphan === 'visits' ? 'orphan-user' : 9999
      writeFileSync(path, JSON.stringify(rows))
      const fixture = await createLocalSchemaFixture()
      try {
        const target = await openLocalTarget(fixture.options)
        try {
          await expect(importSnapshot(target.db, source, true)).rejects.toThrow(
            'Source FK closure failed',
          )
          const refs = await target.db
            .prepare('SELECT COUNT(*) AS n FROM aircraft_reference')
            .first<{ n: number }>()
          expect(refs?.n).toBe(0)
        } finally {
          await target.dispose()
        }
      } finally {
        fixture.cleanup()
      }
    })
  }

  it('resumes missing-only imports and publishes wider archived visit evidence', async () => {
    const source = syntheticSnapshot()
    const fixture = await createLocalSchemaFixture()
    try {
      const target = await openLocalTarget(fixture.options)
      try {
        await target.db
          .prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)')
          .bind(CURRENT, 'current@example.test', 'current-private-hash', '2026-02-01T00:00:00.000Z')
          .run()
        await target.db
          .prepare(
            'INSERT INTO sessions(id,user_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)',
          )
          .bind(
            'session-1',
            CURRENT,
            'token-digest',
            '2026-02-01T00:00:00.000Z',
            '2027-02-01T00:00:00.000Z',
          )
          .run()
        await expect(importSnapshot(target.db, source, true, 'users')).rejects.toThrow(
          'Intentional import interruption',
        )
        const manifest = await importSnapshot(target.db, source, true)
        expect(manifest.visitEvidence).toEqual({
          raw: 2,
          contributing: 2,
          derivedKeys: 2,
          expectedUnionKeys: 3,
        })
        const pending = await target.db
          .prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?')
          .bind(LEGACY)
          .first<{ revision: number; published_revision: number }>()
        expect(pending?.revision).toBeGreaterThan(0)
        expect(pending?.published_revision).toBe(0)
        expect(
          await target.db
            .prepare('SELECT user_id FROM user_derived_state WHERE user_id = ?')
            .bind(CURRENT)
            .first(),
        ).toBeNull()
        await importSnapshot(target.db, source, true)
        const notes = await target.db
          .prepare('SELECT note FROM ground_visits WHERE id = ?')
          .bind('ground-1')
          .first<{ note: string }>()
        expect(notes?.note).toBe('A retained private note')
        const corrected = await target.db
          .prepare('SELECT COUNT(*) AS n FROM flights WHERE aircraft_icao = ?')
          .bind('A388')
          .first<{ n: number }>()
        expect(corrected?.n).toBe(2)
        const evidence = await target.db
          .prepare('SELECT COUNT(*) AS n FROM legacy_visit_evidence WHERE contributes = 1')
          .first<{ n: number }>()
        expect(evidence?.n).toBe(2)
        const repair = await repairUserDerivedState(target.db, LEGACY)
        expect(repair.derived_state).toBe('ready')
        const lhr = await target.db
          .prepare(
            'SELECT first_visit,last_visit,visit_count FROM visits WHERE user_id = ? AND airport_iata = ?',
          )
          .bind(LEGACY, 'LHR')
          .first<{ first_visit: string; last_visit: string; visit_count: number }>()
        expect(lhr).toMatchObject({
          first_visit: '2025-01-01',
          last_visit: '2026-02-02',
          visit_count: 5,
        })
        const mow = await target.db
          .prepare('SELECT visit_count FROM visits WHERE user_id = ? AND airport_iata = ?')
          .bind(LEGACY, 'MOW')
          .first<{ visit_count: number }>()
        expect(mow?.visit_count).toBe(1)
        const current = await target.db
          .prepare('SELECT password_hash FROM users WHERE id = ?')
          .bind(CURRENT)
          .first<{ password_hash: string }>()
        expect(current?.password_hash).toBe('current-private-hash')
        const session = await target.db
          .prepare('SELECT id FROM sessions WHERE user_id = ?')
          .bind(CURRENT)
          .first<{ id: string }>()
        expect(session?.id).toBe('session-1')
        await validateTarget(
          {
            read: async (sql) =>
              (await target.db.prepare(sql).all<Record<string, unknown>>()).results,
          },
          source,
          {
            ...manifest,
            target: 'local',
            databaseId: fixture.options.databaseId,
            expectedUnionCounts: manifest.expectedUnionCounts!,
            schemaSha256: target.schemaSha256,
          },
        )
        const published = await target.db
          .prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?')
          .bind(LEGACY)
          .first()
        await importSnapshot(target.db, source, true) // ready derived rows are compatible on replay
        expect(
          await target.db
            .prepare(
              'SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?',
            )
            .bind(LEGACY)
            .first(),
        ).toEqual(published)
      } finally {
        await target.dispose()
      }
    } finally {
      fixture.cleanup()
    }
  })

  it('replays after leaderboard refresh changes cache IDs without importing stale cache rows', async () => {
    const source = syntheticSnapshot()
    const flightsPath = join(source, 'flights.json')
    const flights = JSON.parse(readFileSync(flightsPath, 'utf8')) as Array<Record<string, unknown>>
    for (const id of [497, 498, 499]) flights.push({ ...flights[1], id, aircraft_icao: null })
    writeFileSync(flightsPath, JSON.stringify(flights))
    writeFileSync(
      join(source, 'leaderboard_cache.json'),
      JSON.stringify([
        {
          id: 1545,
          user_id: LEGACY,
          category: 'flights',
          value: 5,
          rank: 1,
          percentile: 100,
          metadata: null,
          updated_at: TS,
        },
      ]),
    )
    const fixture = await createLocalSchemaFixture()
    try {
      const target = await openLocalTarget(fixture.options)
      try {
        await importSnapshot(target.db, source, true)
        expect(
          (
            await target.db
              .prepare('SELECT COUNT(*) AS n FROM leaderboard_cache')
              .first<{ n: number }>()
          )?.n,
        ).toBe(0)
        expect((await repairUserDerivedState(target.db, LEGACY)).derived_state).toBe('ready')
        await refreshLeaderboards(target.db)
        const refreshed = await target.db
          .prepare('SELECT id FROM leaderboard_cache WHERE user_id = ? AND category = ?')
          .bind(LEGACY, 'flights')
          .first<{ id: number }>()
        expect(refreshed?.id).not.toBe(1545)
        await importSnapshot(target.db, source, true)
        expect(
          await target.db
            .prepare('SELECT id FROM leaderboard_cache WHERE user_id = ? AND category = ?')
            .bind(LEGACY, 'flights')
            .first(),
        ).toMatchObject({ id: refreshed!.id })
      } finally {
        await target.dispose()
      }
    } finally {
      fixture.cleanup()
    }
  })
})
