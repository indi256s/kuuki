import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { main } from '../../scripts/fit-block-time'
import { ROOT, SCHEMA_SQL } from '../../scripts/_cli'
import { createLocalSchemaFixture, expectedSchemaRows, openLocalTarget, schemaRowsSha256 } from '../../scripts/migration-target'

afterEach(() => { vi.restoreAllMocks() })

describe('local block time fit CLI', () => {
  it('fills package time zones, samples awaiting/logged flights and leaves canonical rows untouched', async () => {
    const fixture = await createLocalSchemaFixture()
    try {
      const target = await openLocalTarget(fixture.options)
      let before: unknown
      try {
        await target.db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('fit-owner', 'fit@example.test', 'synthetic')").run()
        await target.db.prepare(`INSERT INTO flights (user_id, date, origin, destination, departure_time, arrival_time, origin_tz, dest_tz, is_upcoming)
          VALUES ('fit-owner', '2026-06-01', 'TBS', 'KUT', '10:00', '11:00', NULL, NULL, 0),
            ('fit-owner', '2050-06-01', 'TBS', 'KUT', '10:00', '11:00', NULL, NULL, 1),
            ('fit-owner', '2026-06-01', 'TBS', 'KUT', NULL, NULL, NULL, NULL, 0),
            ('fit-owner', '2026-06-01', 'TBS', 'KUT', '10:00', '11:00', 'Not/AZone', NULL, 0),
            ('fit-owner', '2026-06-01', 'TBS', 'MOW', '10:00', '11:00', NULL, NULL, 0),
            ('fit-owner', '2026-06-01', 'TBS', 'KUT', '25:00', '11:00', NULL, NULL, 0)`).run()
        await target.db.prepare(`INSERT INTO flights (user_id, date, origin, destination, departure_time, arrival_time,
          lifecycle_state, lifecycle_timezone, awaiting_after, auto_confirm_after)
          VALUES ('fit-owner', '2026-03-28', 'LHR', 'JFK', '23:30', '02:30', 'awaiting', 'UTC',
            '2026-03-29T00:00:00.000Z', '2026-04-05T00:00:00.000Z')`).run()
        before = (await target.db.prepare('SELECT * FROM flights ORDER BY id').all()).results
      } finally { await target.dispose() }
      const generatedBefore = readFileSync(join(ROOT, 'packages/shared/src/blockTimeModel.generated.ts'), 'utf8')
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      await main(['--database-id', fixture.options.databaseId, '--persist', fixture.options.persistPath])
      expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ samples: 2, skipped: 3, rmse: null, model: { samples: 0, fittedAt: null } })
      expect(JSON.stringify(log.mock.calls)).not.toContain('fit-owner')
      expect(readFileSync(join(ROOT, 'packages/shared/src/blockTimeModel.generated.ts'), 'utf8')).toBe(generatedBefore)
      const after = await openLocalTarget(fixture.options)
      try { expect((await after.db.prepare('SELECT * FROM flights ORDER BY id').all()).results).toEqual(before) }
      finally { await after.dispose() }
    } finally { fixture.cleanup() }
  })

  it('requires a private pinned review for a schema variant before reading samples', async () => {
    const fixture = await createLocalSchemaFixture()
    try {
      const target = await openLocalTarget(fixture.options)
      let observed: Array<Record<string, unknown>>
      try {
        await target.db.prepare('DROP INDEX idx_flights_route_times').run()
        await target.db.prepare("CREATE INDEX idx_flights_route_times ON flights (origin, destination, duration_minutes) WHERE duration_source = 'times'").run()
        observed = (await target.db.prepare(SCHEMA_SQL).all()).results
      } finally { await target.dispose() }
      const args = ['--database-id', fixture.options.databaseId, '--persist', fixture.options.persistPath]
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      await expect(main(args)).rejects.toThrow(/schema mismatch/i)
      expect(log).not.toHaveBeenCalled()
      const admission = join(fixture.options.persistPath, 'review.json')
      writeFileSync(admission, JSON.stringify({ accountId: 'a'.repeat(32), databaseId: fixture.options.databaseId,
        observedApplicationSchemaSha256: schemaRowsSha256(observed), expectedFreshSchemaSha256: schemaRowsSha256(await expectedSchemaRows()),
        reviewedAt: new Date().toISOString(), semanticReview: true,
        reviewedDimensions: ['columns', 'defaults', 'primaryKeys', 'foreignKeys', 'uniqueIndexes', 'indexes', 'checks'],
      }), { mode: 0o600 })
      await main([...args, '--schema-admission', admission])
      expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ samples: 0 })
    } finally { fixture.cleanup() }
  })

  it('refuses remote mode and shared local state', async () => {
    const args = ['--database-id', 'local-synthetic-d1', '--persist', join(ROOT, '.wrangler')]
    await expect(main(args)).rejects.toThrow(/shared project state/)
    await expect(main(['--target', 'remote', ...args])).rejects.toThrow(/only supports --target local/)
  })
})
