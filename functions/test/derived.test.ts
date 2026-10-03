import { afterEach, describe, expect, it } from 'vitest'
import { createApiDatabase } from './harness'
import { dirtyUserStatement, repairUserDerivedState } from '../api/_services/derivedState'

let dispose: (() => Promise<void>) | undefined
afterEach(async () => { await dispose?.(); dispose = undefined })

async function fixture() {
  const setup = await createApiDatabase()
  dispose = setup.dispose
  const db = setup.db
  await db.batch([
    db.prepare("INSERT INTO users (id,email,password_hash) VALUES ('u1','one@example.test','test')"),
    db.prepare("INSERT INTO profiles (id,created_at) VALUES ('u1','2020-01-01T00:00:00.000Z')"),
    db.prepare("INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('AAA','A','A city','Alpha','AA')"),
    db.prepare("INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('BBB','B','B city','Beta','BB')"),
    db.prepare("INSERT INTO flights (id,user_id,date,origin,destination,distance_km,is_upcoming) VALUES (1,'u1','2020-01-02','AAA','BBB',100,0)"),
    db.prepare("INSERT INTO badge_definitions (id,code,name,criteria) VALUES (1,'first','First','{\"flights\":1}')"),
    db.prepare("INSERT INTO badge_definitions (id,code,name,criteria) VALUES (2,'founder','Founding','{\"beta_invite\":true}')"),
  ])
  return db
}

describe('durable derived repair', () => {
  it('publishes flight and independent legacy evidence once, preserving historical badges', async () => {
    const db = await fixture()
    await db.batch([
      db.prepare(
        "INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,city,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json) VALUES ('17','u1','MOW','RU','Moscow','2019-01-01','2019-01-01',2,'digest','archive',1,'{}')",
      ),
      db.prepare(
        "INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,city,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json) VALUES ('18','u1','AAA','AA','A city','2018-01-01','2020-01-02',3,'digest','archive',1,'{}')",
      ),
      db.prepare("INSERT INTO user_badges (user_id,badge_id,earned_at) VALUES ('u1',2,'2019-01-01')"),
      dirtyUserStatement(db, 'u1'),
    ])
    expect(await repairUserDerivedState(db, 'u1')).toEqual({ derived_state: 'ready', revision: 1 })
    const visits = await db.prepare(
      'SELECT airport_iata,visit_count,first_visit,last_visit FROM visits WHERE user_id = ? ORDER BY airport_iata',
    ).bind('u1').all()
    expect(visits.results).toEqual([
      { airport_iata: 'AAA', visit_count: 3, first_visit: '2018-01-01', last_visit: '2020-01-02' },
      { airport_iata: 'BBB', visit_count: 1, first_visit: '2020-01-02', last_visit: '2020-01-02' },
      { airport_iata: 'MOW', visit_count: 2, first_visit: '2019-01-01', last_visit: '2019-01-01' },
    ])
    const stats = await db.prepare('SELECT total_flights, airports_count,countries_count FROM user_stats WHERE user_id = ?')
      .bind('u1').first()
    expect(stats).toEqual({ total_flights: 1, airports_count: 3, countries_count: 3 })
    const badges = await db.prepare('SELECT badge_id FROM user_badges WHERE user_id = ? ORDER BY badge_id').bind('u1').all()
    expect(badges.results).toEqual([{ badge_id: 1 }, { badge_id: 2 }])
  })

  it('rolls back late publication failure, then rejects a stale revision', async () => {
    const db = await fixture()
    await db.batch([dirtyUserStatement(db, 'u1')])
    await db.prepare(
      "CREATE TRIGGER fail_advanced BEFORE INSERT ON user_advanced_stats BEGIN SELECT RAISE(FAIL, 'late failure'); END",
    ).run()
    expect(await repairUserDerivedState(db, 'u1')).toEqual({ derived_state: 'pending', revision: 1 })
    expect((await db.prepare("SELECT COUNT(*) AS n FROM visits WHERE user_id='u1'").first<{n:number}>())?.n).toBe(0)
    expect((await db.prepare("SELECT COUNT(*) AS n FROM user_stats WHERE user_id='u1'").first<{n:number}>())?.n).toBe(0)
    expect((await db.prepare("SELECT published_revision,last_error FROM user_derived_state WHERE user_id='u1'")
      .first())).toEqual({ published_revision: 0, last_error: 'DERIVED_REPAIR_FAILED' })
    await db.prepare('DROP TRIGGER fail_advanced').run()

    // Interleave a newer canonical commit immediately before the old repair batch.
    let intercepted = false
    const interleaved = new Proxy(db, {
      get(target, property) {
        if (property === 'batch') return async (statements: D1PreparedStatement[]) => {
          if (!intercepted) {
            intercepted = true
            await target.batch([
              target.prepare("UPDATE flights SET distance_km = 200 WHERE id = 1 AND user_id = 'u1'"),
              dirtyUserStatement(target, 'u1'),
            ])
          }
          return target.batch(statements)
        }
        const value = Reflect.get(target, property, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    }) as D1Database
    expect(await repairUserDerivedState(interleaved, 'u1')).toEqual({ derived_state: 'pending', revision: 2 })
    expect((await db.prepare("SELECT COUNT(*) AS n FROM visits WHERE user_id='u1'").first<{n:number}>())?.n).toBe(0)
    expect((await db.prepare("SELECT published_revision FROM user_derived_state WHERE user_id='u1'")
      .first<{published_revision:number}>())?.published_revision).toBe(0)
    expect(await repairUserDerivedState(db, 'u1')).toEqual({ derived_state: 'ready', revision: 2 })
    expect((await db.prepare("SELECT total_distance_km FROM user_stats WHERE user_id='u1'")
      .first<{total_distance_km:number}>())?.total_distance_km).toBe(200)
  })
})
