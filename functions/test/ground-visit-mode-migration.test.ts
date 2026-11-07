import { afterEach, expect, it } from 'vitest'
import { applyMigrationAtomically, databaseThrough } from './lifecycle-fixture'

let dispose: (() => Promise<void>) | undefined
afterEach(async () => {
  await dispose?.()
})

it('0018 keeps legacy visits and only lets a land visit name rail or road', async () => {
  const fixture = await databaseThrough('0017')
  dispose = fixture.dispose
  const { db } = fixture
  await db.batch([
    db.prepare(
      "INSERT INTO users (id,email,password_hash) VALUES ('mode-owner','m@example.test','x')",
    ),
    db.prepare(
      "INSERT INTO ground_visits (id,user_id,country_code,entry_method) VALUES ('legacy','mode-owner','AT','land')",
    ),
  ])
  await applyMigrationAtomically(db, '0018_ground_visit_mode.sql')

  expect(await db.prepare("SELECT mode FROM ground_visits WHERE id = 'legacy'").first()).toEqual({
    mode: null,
  })
  const insert = (id: string, entry: string | null, mode: string | null) =>
    db
      .prepare(
        "INSERT INTO ground_visits (id,user_id,country_code,entry_method,mode) VALUES (?,'mode-owner','CH',?,?)",
      )
      .bind(id, entry, mode)
      .run()
  await expect(insert('rail', 'land', 'rail')).resolves.toBeTruthy()
  await expect(insert('sea-unknown', 'sea', null)).resolves.toBeTruthy()
  await expect(insert('sea-road', 'sea', 'road')).rejects.toThrow(/CHECK/)
  // `entry_method = 'land'` is NULL here, which a CHECK would let through.
  await expect(insert('no-entry', null, 'rail')).rejects.toThrow(/CHECK/)
  await expect(insert('plane', 'land', 'plane')).rejects.toThrow(/CHECK/)
})
