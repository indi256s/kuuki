import { expect, it } from 'vitest'
import { overviewParity, parityTable } from '../../scripts/overview-parity'
import { overviewAccount, USER } from './overview-fixture'
import { instrumentDb } from './db-hooks'

it('compares the actual legacy and new readers without writing or hiding approved semantic deltas', async () => {
  const { db, dispose } = await overviewAccount([
    { id: 1, date: '2025-01-01', origin: 'TBS', destination: 'IST', state: 'logged', airline: 'TK', aircraft: 'A320', km: 100, minutes: 10 },
    { id: 2, date: '2025-01-02', origin: 'IST', destination: 'TBS', state: 'awaiting', airline: 'TK', aircraft: 'A320', km: 150, minutes: 30 },
    { id: 3, date: '2025-01-03', origin: 'TBS', destination: 'IST', state: 'logged', airline: 'BA', aircraft: 'B738', km: 200, minutes: 40 },
    { id: 4, date: '2025-01-04', origin: 'TBS', destination: 'JFK', state: 'logged', airline: 'BA', aircraft: 'B738', km: 400, minutes: 50 },
    { id: 5, date: '2025-01-05', origin: 'JFK', destination: 'TBS', state: 'logged', airline: 'TK', aircraft: 'A320', km: 500, minutes: 60 },
    { id: 6, date: '2027-01-01', origin: 'JFK', destination: 'LHR', state: 'upcoming', airline: 'TK', aircraft: 'A359', km: 9000, minutes: 999 },
  ], d => [d.prepare("UPDATE flights SET duration_source=CASE WHEN id=1 THEN 'estimate' ELSE 'times' END")])
  try {
    const tracked = instrumentDb(db)
    const rows = await overviewParity(tracked.db, USER.id)
    const byMetric = Object.fromEntries(rows.map(row => [row.metric, row]))
    expect(byMetric.flights).toEqual({ metric: 'flights', legacy: 5, current: 5, delta: 0 })
    expect(byMetric['distance km']).toMatchObject({ legacy: 1350, current: 1350, delta: 0 })
    expect(byMetric['duration minutes']).toMatchObject({ legacy: 190, current: 190, delta: 0 })
    expect(byMetric['aircraft types (ICAO)']).toMatchObject({ legacy: 2, current: 2, delta: 0 })
    expect(byMetric.manufacturers).toMatchObject({ legacy: 2, current: 2, delta: 0 })
    expect(byMetric['shortest duration minutes']).toMatchObject({ legacy: 10, current: 30, delta: 20 })
    expect(byMetric['top route']).toMatchObject({ legacy: 'TBS→IST (2)', current: 'IST-TBS (3)', delta: 'changed' })
    expect(tracked.hooks.sql.every(sql => /^(SELECT|WITH)\b/i.test(sql.trim()))).toBe(true)
    const table = parityTable(rows)
    expect(table).toContain('| metric | legacy | new | delta |')
    expect(table).toContain('| duration minutes | 190 | 190 | 0 |')
  } finally { await dispose() }
})

it('refuses an unknown owner before reading their flight data', async () => {
  const { db, dispose } = await overviewAccount([])
  try {
    const tracked = instrumentDb(db)
    await expect(overviewParity(tracked.db, 'unknown')).rejects.toThrow('Owner profile not found')
    expect(tracked.hooks.sql).toHaveLength(1)
  } finally { await dispose() }
})

it('refuses stale derived state instead of comparing mixed projections', async () => {
  const { db, dispose } = await overviewAccount([])
  try {
    await db.prepare('UPDATE user_derived_state SET revision=revision+1 WHERE user_id=?').bind(USER.id).run()
    await expect(overviewParity(db, USER.id)).rejects.toThrow('Derived state must be ready')
  } finally { await dispose() }
})
