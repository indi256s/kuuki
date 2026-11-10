import { afterEach, expect, it } from 'vitest'
import { applyMigrationAtomically, databaseThrough } from './lifecycle-fixture'

let dispose: (() => Promise<void>) | undefined
afterEach(async () => {
  await dispose?.()
})

it('0019 preserves all manual visit evidence and admits air without a land mode', async () => {
  const fixture = await databaseThrough('0018')
  dispose = fixture.dispose
  const { db } = fixture
  await db
    .prepare(
      "INSERT INTO users (id,email,password_hash) VALUES ('air-owner','air@example.test','x')",
    )
    .run()
  for (const [id, year, note, entry, mode] of [
    ['rail', 2019, 'Night train', 'land', 'rail'],
    ['road', 2020, 'Border crossing', 'land', 'road'],
    ['land', 1800, '', 'land', null],
    ['sea', 2200, 'Ferry', 'sea', null],
    ['unknown', null, null, null, null],
  ]) {
    await db
      .prepare(`INSERT INTO ground_visits
      (id,user_id,country_code,visit_year,note,entry_method,created_at,mode)
      VALUES (?,'air-owner','GE',?,?,?,'2020-01-02T03:04:05.678Z',?)`)
      .bind(id, year, note, entry, mode)
      .run()
  }
  const before = await db.prepare('SELECT * FROM ground_visits ORDER BY id').all()
  await applyMigrationAtomically(db, '0019_manual_air_visits.sql')
  expect((await db.prepare('SELECT * FROM ground_visits ORDER BY id').all()).results).toEqual(
    before.results.map((row) => ({ ...row, linked_flight_id: null })),
  )
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])

  const insert = (id: string, entry: string | null, mode: string | null, owner = 'air-owner') =>
    db
      .prepare(
        "INSERT INTO ground_visits (id,user_id,country_code,entry_method,mode) VALUES (?, ?, 'AT', ?, ?)",
      )
      .bind(id, owner, entry, mode)
      .run()
  await expect(insert('air', 'air', null)).resolves.toBeTruthy()
  expect(await db.prepare("SELECT created_at FROM ground_visits WHERE id = 'air'").first()).toEqual(
    { created_at: expect.any(String) },
  )
  for (const [entry, mode] of [
    ['air', 'rail'],
    ['air', 'road'],
    ['sea', 'road'],
    [null, 'rail'],
    ['land', 'plane'],
    ['plane', null],
  ])
    await expect(insert('invalid', entry, mode)).rejects.toThrow(/CHECK/)
  await expect(insert('missing-owner', 'air', null, 'missing')).rejects.toThrow(/FOREIGN KEY/)
  const indexes = await db
    .prepare('PRAGMA index_info(idx_ground_visits_user_country)')
    .all<{ name: string }>()
  expect(indexes.results.map((column) => column.name)).toEqual(['user_id', 'country_code'])
  await db
    .prepare(
      "INSERT INTO flights (id,user_id,date,origin,destination) VALUES (1,'air-owner','2020-01-01','TBS','VIE')",
    )
    .run()
  await db.prepare("UPDATE ground_visits SET linked_flight_id = 1 WHERE id = 'air'").run()
  await expect(
    db.prepare("UPDATE ground_visits SET linked_flight_id = 999 WHERE id = 'air'").run(),
  ).rejects.toThrow(/FOREIGN KEY/)
  const linked = await db.prepare("SELECT * FROM ground_visits WHERE id = 'air'").first()
  await db.prepare('DELETE FROM flights WHERE id = 1').run()
  expect(await db.prepare("SELECT * FROM ground_visits WHERE id = 'air'").first()).toEqual({
    ...linked,
    linked_flight_id: null,
  })
  await db.prepare("DELETE FROM users WHERE id = 'air-owner'").run()
  expect((await db.prepare('SELECT * FROM ground_visits').all()).results).toEqual([])
})
