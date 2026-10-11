import { afterEach, beforeEach, expect, it } from 'vitest'
import { createUserWithProfile } from '../api/_lib/users'
import { applyMigrationAtomically, databaseThrough } from './lifecycle-fixture'

let db: D1Database
let dispose: () => Promise<void>

beforeEach(async () => {
  const fixture = await databaseThrough('0009_schedule_time_provenance.sql')
  db = fixture.db
  dispose = fixture.dispose
})

afterEach(async () => {
  await dispose()
})

it('0010 marks every existing profile onboarded and leaves new profiles to onboard', async () => {
  const insertUser = (id: string) =>
    db
      .prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
      .bind(id, `${id}@example.test`, 'synthetic')
  await db.batch([
    insertUser('named'),
    insertUser('nameless'),
    db
      .prepare('INSERT INTO profiles (id, username, updated_at) VALUES (?, ?, ?)')
      .bind('named', 'named', '2026-01-02T03:04:05.000Z'),
    db.prepare('INSERT INTO profiles (id) VALUES (?)').bind('nameless'),
  ])
  await applyMigrationAtomically(db, '0010_onboarding_state.sql')
  const rows = (
    await db.prepare('SELECT id, onboarded_at, updated_at FROM profiles ORDER BY id').all<{
      id: string
      onboarded_at: string | null
      updated_at: string
    }>()
  ).results
  expect(rows).toHaveLength(2)
  for (const row of rows) expect(row.onboarded_at).toBe(row.updated_at)
  expect(rows.find((row) => row.id === 'named')?.onboarded_at).toBe('2026-01-02T03:04:05.000Z')

  await createUserWithProfile(
    db,
    { email: 'fresh@example.test', password: 'long-enough-1' },
    'migration-test-secret',
  )
  expect(
    await db
      .prepare(
        'SELECT p.onboarded_at FROM profiles p JOIN users u ON u.id = p.id WHERE u.email = ?',
      )
      .bind('fresh@example.test')
      .first(),
  ).toEqual({ onboarded_at: null })
})
