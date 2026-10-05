import { expect, it } from 'vitest'
import { apiContext, createApiDatabase } from './harness'
import { onRequestGet as getOverview } from '../api/me/overview'
import { onRequestGet as getAllFlights } from '../api/flights/all'
import { onRequestGet as getRoutes } from '../api/flights/routes'
import type { OverviewSummary } from '../../packages/shared/src/overview'

const user = { id: 'overview-user', email: 'overview@example.test' }

async function read(db: D1Database, period: string): Promise<OverviewSummary> {
  const request = new Request(`https://kuuki.test/api/me/overview?period=${period}`)
  const response = await getOverview({ ...apiContext(db, request), data: { user } } as never)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  return response.json() as Promise<OverviewSummary>
}

it('keeps flight-period totals and country IDs coherent while derived publication is pending', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(user.id, user.email, 'hash'),
      db.prepare("INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('AAA','A','Tbilisi','Georgia','GE')"),
      db.prepare("INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('BBB','B','Paris','France','FR')"),
      db.prepare("INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('CCC','C','New York','United States','US')"),
      db.prepare("INSERT INTO flights (user_id,date,origin,destination,distance_km,is_upcoming) VALUES (?,?,?,?,?,0)").bind(user.id, '2024-03-01', 'AAA', 'BBB', 100),
      db.prepare("INSERT INTO flights (user_id,date,origin,destination,distance_km,is_upcoming) VALUES (?,?,?,?,?,0)").bind(user.id, '2025-04-01', 'BBB', 'CCC', 200),
      db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,1)").bind(user.id, '2030-01-01', 'AAA', 'CCC'),
      db.prepare('INSERT INTO country_claims (id,user_id,country_code) VALUES (?,?,?)').bind('claim', user.id, 'JP'),
      db.prepare('INSERT INTO ground_visits (id,user_id,country_code) VALUES (?,?,?)').bind('ground', user.id, 'DE'),
      db.prepare(`INSERT INTO legacy_visit_evidence
        (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind('legacy', user.id, 'DDD', 'RU', '2024-01-01', '2024-01-01', 1, 'digest', 'test', 1, '{}'),
      db.prepare('INSERT INTO user_derived_state (user_id,revision,published_revision) VALUES (?,?,?)').bind(user.id, 3, 2),
    ])

    const year = await read(db, '2024')
    expect(year).toMatchObject({ revision: 3, publishedRevision: 2, derivedState: 'pending', countryState: 'updating', period: '2024' })
    // Country figures are never mixed with a pending repair (ADR 0001 §4); flight figures stay live.
    expect(year.totals).toMatchObject({ flights: 1, distanceKm: 100, countries: null, continents: null, upcomingFlights: 1 })
    expect(year.countryIds).toEqual([])
    expect(year.months).toHaveLength(12)
    expect(year.months[2]).toEqual({ month: '2024-03', flights: 1 })
    expect(year.nextFlight?.date).toBe('2030-01-01')
    expect(year.topLists.countries).toEqual([])
    expect(JSON.stringify(year)).not.toContain('completedFlights')

    const all = await read(db, 'all')
    expect(all.totals).toMatchObject({ flights: 2, distanceKm: 300, countries: null })
    expect(all.countryIds).toEqual([])
    const filtered = await read(db, 'all&origin=BBB&destinationCodes=CCC,AAA')
    expect(filtered.totals).toMatchObject({ flights: 1, distanceKm: 200, countries: null })
    expect(filtered.countryIds).toEqual([])
    // Publication catches up: the same snapshot now yields country figures from the published evidence.
    await db.prepare('UPDATE user_derived_state SET published_revision = 3, evidence_revision = 3 WHERE user_id = ?').bind(user.id).run()
    expect((await read(db, '2024')).countryIds).toEqual(['FR', 'GE'])
    expect((await read(db, 'all&origin=BBB&destinationCodes=CCC,AAA')).countryIds).toEqual(['FR', 'US'])
    const routes = await getRoutes({ ...apiContext(db, new Request('https://kuuki.test/api/flights/routes?origin=BBB&destinationCodes=CCC,AAA')), data: { user } } as never)
    expect(routes.status).toBe(200)
    expect(await routes.json()).toEqual([expect.objectContaining({ origin: 'BBB', destination: 'CCC' })])
    expect((await read(db, 'all&isUpcoming=true')).totals.flights).toBe(0)
    // Three maximum-length code filters must not double bindings for endpoints.
    const codes = Array.from({ length: 25 }, (_, i) => `X${String(i).padStart(2, '0')}`).join(',')
    expect((await read(db, `all&originCodes=${codes}&destinationCodes=${codes}&airlineIataCodes=${codes}`)).totals.flights).toBe(0)
  } finally { await dispose() }
})

it('keeps response bytes bounded from empty through 5,000 flights', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(user.id, user.email, 'hash'),
      db.prepare("INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('AAA','A','Tbilisi','Georgia','GE')"),
      db.prepare("INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('BBB','B','Paris','France','FR')"),
    ])
    const bytes: number[] = []
    let prior = 0
    for (const count of [0, 1, 10, 500, 5000]) {
      const additional = count - prior
      if (additional) {
        await db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < ?)
          INSERT INTO flights (user_id,date,origin,destination,distance_km)
          SELECT ?, date('2020-01-01', '+' || x || ' days'), 'AAA', 'BBB', 100 FROM n`)
          .bind(additional, user.id).run()
      }
      const response = await getOverview({ ...apiContext(db, new Request('https://kuuki.test/api/me/overview')), data: { user } } as never)
      expect(response.status).toBe(200)
      const body = await response.text()
      const summary = JSON.parse(body) as OverviewSummary
      expect(summary.totals.flights).toBe(count)
      expect(summary.months).toHaveLength(12)
      expect(summary.countryIds.length).toBeLessThanOrEqual(512)
      for (const list of Object.values(summary.topLists)) expect(list.length).toBeLessThanOrEqual(5)
      bytes.push(new TextEncoder().encode(body).length)
      prior = count
    }
    const all = await getAllFlights({ ...apiContext(db, new Request('https://kuuki.test/api/flights/all')), data: { user } } as never)
    expect(all.status).toBe(200)
    const fullHistoryBytes = new TextEncoder().encode(await all.text()).length
    expect(Math.max(...bytes) - Math.min(...bytes)).toBeLessThan(500)
    expect(fullHistoryBytes).toBeGreaterThan(bytes[4] * 10)
  } finally { await dispose() }
})
