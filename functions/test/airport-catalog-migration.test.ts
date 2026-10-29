import { afterEach, describe, expect, it } from 'vitest'
import { parseFlightBody } from '../api/_lib/flightValidation'
import { migrationStatements } from '../../scripts/_migrations'
import { applyMigrationAtomically, databaseThrough } from './lifecycle-fixture'

const migration = '0017_airport_catalog_coverage.sql'
let dispose: (() => Promise<void>) | undefined
afterEach(async () => {
  await dispose?.()
})

describe('airport catalog expansion', () => {
  it('admits GPA and DBB without changing existing airports or historical flights, including on replay', async () => {
    const fixture = await databaseThrough('0016')
    dispose = fixture.dispose
    const { db } = fixture
    await db.batch([
      db.prepare(
        "INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('ZZZ','Manual airport','Manual city','Georgia','GE')",
      ),
      db.prepare(
        "INSERT INTO users (id,email,password_hash) VALUES ('airport-owner','airports@example.test','synthetic')",
      ),
      db.prepare(
        "INSERT INTO flights (user_id,date,origin,destination) VALUES ('airport-owner','2025-01-01','ZZZ','ZZZ')",
      ),
    ])
    const airportsBefore = (
      await db.prepare('SELECT * FROM airports_reference ORDER BY iata').all()
    ).results
    const flightsBefore = (await db.prepare('SELECT * FROM flights').all()).results
    const body = { date: '2025-01-01', origin: 'GPA', destination: 'DBB' }
    await expect(parseFlightBody(db, body, 'create')).rejects.toMatchObject({
      code: 'UNKNOWN_AIRPORT',
    })

    // D1's hosted statement limit also applies inside a batch (platform/limits).
    for (const statement of migrationStatements(migration)) {
      expect(Buffer.byteLength(statement, 'utf8')).toBeLessThanOrEqual(100_000)
    }
    await applyMigrationAtomically(db, migration)
    await expect(parseFlightBody(db, body, 'create')).resolves.toMatchObject(body)
    expect(
      (
        await db
          .prepare(
            "SELECT iata, icao, country_code FROM airports_reference WHERE iata IN ('DBB','GPA') ORDER BY iata",
          )
          .all()
      ).results,
    ).toEqual([
      { iata: 'DBB', icao: 'HEAL', country_code: 'EG' },
      { iata: 'GPA', icao: 'LGRX', country_code: 'GR' },
    ])
    const airportsAfter = (await db.prepare('SELECT * FROM airports_reference ORDER BY iata').all())
      .results
    expect(airportsAfter).toEqual(expect.arrayContaining(airportsBefore))
    expect((await db.prepare('SELECT * FROM flights').all()).results).toEqual(flightsBefore)
    await applyMigrationAtomically(db, migration)
    expect(
      (await db.prepare('SELECT * FROM airports_reference ORDER BY iata').all()).results,
    ).toEqual(airportsAfter)
  })

  it('rejects conflicting IATA metadata atomically instead of replacing it', async () => {
    const fixture = await databaseThrough('0016')
    dispose = fixture.dispose
    const { db } = fixture
    await db
      .prepare(
        "INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('DBB','Manual airport','Manual city','Egypt','EG')",
      )
      .run()
    const before = (await db.prepare('SELECT * FROM airports_reference ORDER BY iata').all())
      .results
    await expect(applyMigrationAtomically(db, migration)).rejects.toThrow(
      /UNIQUE constraint failed/,
    )
    expect(
      (await db.prepare('SELECT * FROM airports_reference ORDER BY iata').all()).results,
    ).toEqual(before)
  })
})
