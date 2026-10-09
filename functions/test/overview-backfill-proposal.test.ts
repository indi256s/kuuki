import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it, vi } from 'vitest'
import { main } from '../../scripts/overview-backfill-proposal'
import { ROOT, SCHEMA_SQL } from '../../scripts/_cli'
import {
  createLocalSchemaFixture,
  expectedSchemaRows,
  openLocalTarget,
  schemaRowsSha256,
} from '../../scripts/migration-target'
import { findAirport } from '../../packages/data/src/airport-lookup'
import * as remoteReader from '../../scripts/migration-remote-reader'

afterEach(() => vi.restoreAllMocks())

it('writes private hashed proposals and manifests without changing canonical or derived rows', async () => {
  const fixture = await createLocalSchemaFixture()
  try {
    const target = await openLocalTarget(fixture.options)
    let before: unknown
    try {
      await target.db.batch([
        target.db.prepare(
          "INSERT INTO users (id,email,password_hash) VALUES ('proposal-owner','private-email@synthetic.test','synthetic')",
        ),
        ...['TBS', 'JFK'].map((iata) => {
          const a = findAirport(iata)!
          return target.db
            .prepare(
              'INSERT INTO airports_reference (iata,name,city,country,country_code,latitude,longitude) VALUES (?,?,?,?,?,?,?)',
            )
            .bind(iata, a.name, a.city, a.country, a.countryCode, a.latitude, a.longitude)
        }),
        target.db.prepare(
          "INSERT INTO flights (user_id,date,origin,destination,distance_km,duration_minutes,is_upcoming) VALUES ('proposal-owner','2025-01-01','TBS','JFK',9878,611,0)",
        ),
      ])
      before = (await target.db.prepare('SELECT * FROM flights').all()).results
    } finally {
      await target.dispose()
    }
    const output = join(fixture.options.persistPath, 'backfill.sql')
    const args = [
      '--target',
      'local',
      '--database-id',
      fixture.options.databaseId,
      '--persist',
      fixture.options.persistPath,
      '--output-sql',
      output,
    ]
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await main(args)
    const sql = readFileSync(output, 'utf8')
    const manifest = JSON.parse(readFileSync(output + '.manifest.json', 'utf8'))
    expect(manifest).toMatchObject({
      accountId: 'local',
      databaseId: fixture.options.databaseId,
      changeCount: 1,
      sqlSha256: createHash('sha256').update(sql).digest('hex'),
      classCounts: { kept_unexplained: 1, distance_changed: 1 },
      users: [
        {
          userId: 'proposal-owner',
          flightsChanged: 1,
          distanceKm: { before: 9878, after: 8980 },
          durationMinutes: { before: 611, after: 611 },
        },
      ],
    })
    expect(manifest.schemaSha256).toMatch(/^[a-f0-9]{64}$/)
    for (const path of [output, output + '.manifest.json'])
      expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(JSON.stringify(log.mock.calls) + sql + JSON.stringify(manifest)).not.toContain(
      'private-email',
    )
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      artifactWritten: true,
      changeCount: 1,
    })
    await expect(main(args)).rejects.toThrow(/exist/i)
    expect(readFileSync(output, 'utf8')).toBe(sql)
    const after = await openLocalTarget(fixture.options)
    try {
      expect((await after.db.prepare('SELECT * FROM flights').all()).results).toEqual(before)
      expect((await after.db.prepare('SELECT * FROM user_derived_state').all()).results).toEqual([])
    } finally {
      await after.dispose()
    }
  } finally {
    fixture.cleanup()
  }
})

it('prints refusal without SQL for an unreviewed schema and accepts a pinned private review', async () => {
  const fixture = await createLocalSchemaFixture()
  try {
    const target = await openLocalTarget(fixture.options)
    let observed: Record<string, unknown>[]
    try {
      await target.db.prepare('DROP INDEX idx_flights_route_times').run()
      await target.db
        .prepare(
          "CREATE INDEX idx_flights_route_times ON flights (origin, destination, duration_minutes) WHERE duration_source = 'times'",
        )
        .run()
      observed = (await target.db.prepare(SCHEMA_SQL).all()).results
    } finally {
      await target.dispose()
    }
    const output = join(fixture.options.persistPath, 'backfill.sql')
    const args = [
      '--target',
      'local',
      '--database-id',
      fixture.options.databaseId,
      '--persist',
      fixture.options.persistPath,
      '--output-sql',
      output,
    ]
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await main(args)
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      schemaReady: false,
      artifactWritten: false,
      schemaAdmissionReason: 'unreviewed-schema-variant',
    })
    expect(existsSync(output)).toBe(false)
    const admission = join(fixture.options.persistPath, 'admission.json')
    writeFileSync(
      admission,
      JSON.stringify({
        accountId: 'a'.repeat(32),
        databaseId: fixture.options.databaseId,
        observedApplicationSchemaSha256: schemaRowsSha256(observed),
        expectedFreshSchemaSha256: schemaRowsSha256(await expectedSchemaRows()),
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
    await main([...args, '--schema-admission', admission])
    expect(JSON.parse(log.mock.calls[1][0])).toMatchObject({
      schemaReady: true,
      artifactWritten: true,
      changeCount: 0,
    })
  } finally {
    fixture.cleanup()
  }
})

it('refuses shared local targets and cleans up a new SQL artifact if its manifest already exists', async () => {
  await expect(
    main([
      '--target',
      'local',
      '--database-id',
      'local-synthetic-d1',
      '--persist',
      join(ROOT, '.wrangler'),
      '--output-sql',
      join(tmpdir(), 'refused-backfill.sql'),
    ]),
  ).rejects.toThrow(/shared project state/)
  const fixture = await createLocalSchemaFixture()
  try {
    const output = join(fixture.options.persistPath, 'collision.sql')
    writeFileSync(output + '.manifest.json', 'existing-private-artifact', { mode: 0o600 })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await expect(
      main([
        '--target',
        'local',
        '--database-id',
        fixture.options.databaseId,
        '--persist',
        fixture.options.persistPath,
        '--output-sql',
        output,
      ]),
    ).rejects.toThrow(/exist/i)
    expect(existsSync(output)).toBe(false)
    expect(readFileSync(output + '.manifest.json', 'utf8')).toBe('existing-private-artifact')
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      artifactWritten: false,
      artifactRefusedReason: 'artifact-write-failed',
    })
  } finally {
    fixture.cleanup()
  }
})

it('binds explicit remote IDs and gates private reads behind schema admission with a fake remote reader', async () => {
  const fixture = await createLocalSchemaFixture()
  try {
    const dispose = vi.fn()
    const read = vi.fn(async (sql: string) => {
      if (sql === SCHEMA_SQL) return []
      throw new Error('Private read before schema admission')
    })
    const open = vi.spyOn(remoteReader, 'openRemoteReader').mockReturnValue({ read, dispose })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const accountId = 'a'.repeat(32),
      databaseId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const args = [
      '--target',
      'remote',
      '--account-id',
      accountId,
      '--database-id',
      databaseId,
      '--output-sql',
      join(fixture.options.persistPath, 'remote.sql'),
    ]
    await main(args)
    expect(open).toHaveBeenCalledWith(accountId, databaseId)
    expect(read).toHaveBeenCalledTimes(1)
    expect(dispose).toHaveBeenCalledOnce()
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      accountId,
      databaseId,
      schemaReady: false,
      artifactWritten: false,
    })
    open.mockClear()
    await expect(
      main(args.map((value) => (value === accountId ? 'bad-account' : value))),
    ).rejects.toThrow(/malformed/)
    expect(open).not.toHaveBeenCalled()
  } finally {
    fixture.cleanup()
  }
})
