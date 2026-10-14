import { afterEach, expect, it, vi } from 'vitest'
import { createApiDatabase, apiContext, csrfRequest, count } from './harness'
import { onRequestGet as flightIds } from '../api/flights/ids'
import { onRequestPost, onRequestGet as listFlights } from '../api/flights/index'
import { onRequestGet, onRequestPatch, onRequestDelete } from '../api/flights/[id]'
import { onRequestPost as bulkDelete } from '../api/flights/bulk-delete'
import { onRequestPost as bulkCreate } from '../api/flights/bulk'
import { onRequestPost as syncUpcoming } from '../api/flights/sync-upcoming'
import { onRequestPost as aircraftBatch } from '../api/flights/aircraft-batch'
import { repairUserDerivedState } from '../api/_services/derivedState'

const user = { id: 'u1', email: 'u1@example.test' }
const flight = { date: '2025-04-03', origin: 'TBS', destination: 'IST' }

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function seed(db: D1Database) {
  await db.batch([
    db
      .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
      .bind(user.id, user.email, 'hash'),
    db.prepare('INSERT INTO profiles (id) VALUES (?)').bind(user.id),
    ...(['TBS', 'IST', 'JFK'] as const).map((iata) =>
      db
        .prepare(
          'INSERT INTO airports_reference (iata, name, city, country, country_code, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(iata, iata, iata, 'Test', iata === 'JFK' ? 'US' : 'GE', 40, 40),
    ),
  ])
}

function context(
  db: D1Database,
  path: string,
  method: string,
  body?: unknown,
  key?: string,
  id?: string,
) {
  const request = csrfRequest(path, method, body, key ? { 'Idempotency-Key': key } : {})
  return { ...apiContext(db, request), data: { user }, params: id ? { id } : {} } as never
}

it('searches owned flight fields literally with matching pagination totals', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.batch([
      db
        .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
        .bind('u2', 'other@example.test', 'hash'),
      ...[
        [user.id, '2025-04-03', 'TBS', 'IST', 'Q%99'],
        [user.id, '2025-04-04', 'TBS', 'JFK', 'Q100'],
        ['u2', '2025-04-03', 'TBS', 'IST', 'PRIVATE'],
      ].map((row) =>
        db
          .prepare(
            "INSERT INTO flights (user_id,date,origin,destination,flight_number,source,is_upcoming) VALUES (?,?,?,?,?,'manual',0)",
          )
          .bind(...row),
      ),
    ])
    const searched = await listFlights(context(db, '/api/flights?q=tbs&limit=1', 'GET'))
    expect(searched.status).toBe(200)
    const body = (await searched.json()) as {
      flights: Array<{ flight_number: string }>
      total: number
    }
    expect(body.total).toBe(2)
    expect(body.flights).toHaveLength(1)
    expect(body.flights[0].flight_number).not.toBe('PRIVATE')
    const literal = await listFlights(context(db, '/api/flights?q=%25', 'GET'))
    expect(await literal.json()).toMatchObject({ total: 1, flights: [{ flight_number: 'Q%99' }] })
    const missing = await listFlights(context(db, '/api/flights?q=not-a-route', 'GET'))
    expect(await missing.json()).toMatchObject({ total: 0, flights: [] })
  } finally {
    await dispose()
  }
})

it('shares airport, lifecycle, city/route search and exact filters across list, count and all IDs', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.prepare("UPDATE airports_reference SET city = 'Tbilisi' WHERE iata = 'TBS'").run()
    await db.batch([
      db
        .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
        .bind('u2', 'other@example.test', 'hash'),
      ...[
        [user.id, '2025-04-03', 'TBS', 'IST', 'Q%_99', 'TK'],
        [user.id, '2025-04-04', 'IST', 'TBS', 'Q100', 'TK'],
        [user.id, '2024-04-04', 'TBS', 'JFK', 'Q200', 'DL'],
        [user.id, '2025-04-05', 'JFK', 'IST', 'Q300', 'TK'],
        ['u2', '2025-04-03', 'TBS', 'IST', 'PRIVATE', 'TK'],
      ].map((row) =>
        db
          .prepare(
            "INSERT INTO flights (user_id,date,origin,destination,flight_number,airline_iata,source,is_upcoming) VALUES (?,?,?,?,?,?,'manual',0)",
          )
          .bind(...row),
      ),
    ])
    for (const [query, expected] of [
      ['airport=tbs&year=2025&airline=TK&status=logged', 2],
      ['from=2025-04-03&to=2025-04-04&year=2024&airport=TBS', 2],
      ['from=2025-04-03&to=2025-04-03&status=logged', 1],
      ['from=2025-04-04&to=2025-04-05&airline=TK', 2],
      ['airport=IST&origin=TBS&year=2025', 1],
      ['q=Tbilisi&year=2025', 2],
      ['q=2025-04', 3],
      ['q=TBS%20IST', 2],
      ['q=TBS%E2%86%92IST', 2],
      ['q=%25_', 1],
      ['q=unknown-airport-alias', 0],
      ['airport=ZZZ', 0],
      ['status=awaiting', 0],
      ['airport=TBS&airline=DL', 1],
      ["q=' OR 1=1 --", 0],
    ] as const) {
      const response = await listFlights(context(db, `/api/flights?${query}&limit=1`, 'GET'))
      expect(response.status).toBe(200)
      const body = (await response.json()) as { flights: Array<{ id: number }>; total: number }
      expect(body.total, query).toBe(expected)
      const ids = (await (
        await flightIds(context(db, `/api/flights/ids?${query}`, 'GET'))
      ).json()) as { ids: number[] }
      expect(ids.ids, query).toHaveLength(expected)
      expect(body.flights.every((row) => ids.ids.includes(row.id))).toBe(true)
    }
  } finally {
    await dispose()
  }
})

it('lists upcoming flights nearest first across pages by default, leaving explicit sorts unchanged', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const day = (n: number) => `2099-03-${String(n).padStart(2, '0')}`
    const upcomingDays = Array.from({ length: 25 }, (_, i) => ((i * 7) % 25) + 1) // scrambled insertion order
    const past = ['2024-01-10', '2025-06-02', '2023-05-05']
    await db.batch([
      ...upcomingDays.map((n) =>
        db
          .prepare(
            "INSERT INTO flights (user_id,date,origin,destination,source,is_upcoming) VALUES (?,?,'TBS','IST','manual',1)",
          )
          .bind(user.id, day(n)),
      ),
      ...past.map((date) =>
        db
          .prepare(
            "INSERT INTO flights (user_id,date,origin,destination,source,is_upcoming) VALUES (?,?,'IST','JFK','manual',0)",
          )
          .bind(user.id, date),
      ),
    ])
    type Page = {
      flights: Array<{ id: number; date: string; lifecycle_state: string }>
      total: number
    }
    const page = async (query: string) =>
      (await (await listFlights(context(db, `/api/flights?${query}`, 'GET'))).json()) as Page
    const first = await page('limit=20&offset=0')
    const second = await page('limit=20&offset=20')
    expect(first.total).toBe(28)
    expect(second.total).toBe(28)
    const nearest = Array.from({ length: 25 }, (_, i) => day(i + 1))
    expect(first.flights.map((row) => row.date)).toEqual(nearest.slice(0, 20))
    expect(first.flights.every((row) => row.lifecycle_state === 'upcoming')).toBe(true)
    expect(second.flights.map((row) => row.date)).toEqual([
      ...nearest.slice(20),
      '2025-06-02',
      '2024-01-10',
      '2023-05-05',
    ])
    expect(second.flights.map((row) => row.lifecycle_state)).toEqual([
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'logged',
      'logged',
      'logged',
    ])
    const ids = (await (await flightIds(context(db, '/api/flights/ids', 'GET'))).json()) as {
      ids: number[]
    }
    expect([...ids.ids].sort((a, b) => a - b)).toEqual(
      [...first.flights, ...second.flights].map((row) => row.id).sort((a, b) => a - b),
    )

    const byOriginDesc = await page('sort=origin&order=desc&limit=3')
    expect(byOriginDesc.flights.map((row) => row.date)).toEqual(
      upcomingDays.slice(-3).reverse().map(day),
    ) // origin ties fall back to id descending
    const asc = await page('sort=date&order=asc&limit=4')
    expect(asc.flights.map((row) => row.date)).toEqual([
      '2023-05-05',
      '2024-01-10',
      '2025-06-02',
      '2099-03-01',
    ])
    const byOrigin = await page('sort=origin&order=asc&limit=3')
    expect(byOrigin.flights.map((row) => row.date)).toEqual(past) // origin ties fall back to id ascending (insertion order)
  } finally {
    await dispose()
  }
})

it('matches Russian and native airport aliases with Unicode case folding, across list, count and all IDs', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.batch([
      db
        .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
        .bind('u2', 'other@example.test', 'hash'),
      ...[
        [user.id, '2025-04-03', 'TBS', 'IST', 'Q1'],
        [user.id, '2025-04-04', 'IST', 'TBS', 'Q2'],
        [user.id, '2024-04-04', 'TBS', 'JFK', 'Q3'],
        [user.id, '2025-04-05', 'JFK', 'IST', 'Q4'],
        ['u2', '2025-04-03', 'TBS', 'IST', 'PRIVATE'],
      ].map((row) =>
        db
          .prepare(
            "INSERT INTO flights (user_id,date,origin,destination,flight_number,source,is_upcoming) VALUES (?,?,?,?,?,'manual',0)",
          )
          .bind(...row),
      ),
    ])
    for (const [query, expected] of [
      ['q=' + encodeURIComponent('Тбилиси'), 3],
      ['q=' + encodeURIComponent('тбилиси'), 3],
      ['q=' + encodeURIComponent('ТБИЛИСИ'), 3],
      ['q=' + encodeURIComponent('тБиЛиСи'), 3],
      ['q=' + encodeURIComponent('Стамбул'), 3],
      ['q=' + encodeURIComponent('Стамбул тбилиси'), 2],
      ['q=' + encodeURIComponent('İSTANBUL'), 3],
      ['q=' + encodeURIComponent('თბილისი'), 3],
      ['q=' + encodeURIComponent('Москва'), 0],
      ['q=' + encodeURIComponent('Шереметьево'), 0],
      ['q=' + encodeURIComponent('Тбилиси Москва'), 0],
      ['q=' + encodeURIComponent('Неизвестный'), 0],
    ] as const) {
      const response = await listFlights(context(db, `/api/flights?${query}&limit=1`, 'GET'))
      expect(response.status, query).toBe(200)
      const body = (await response.json()) as {
        flights: Array<{ id: number; flight_number: string }>
        total: number
      }
      expect(body.total, query).toBe(expected)
      const ids = (await (
        await flightIds(context(db, `/api/flights/ids?${query}`, 'GET'))
      ).json()) as { ids: number[] }
      expect(ids.ids, query).toHaveLength(expected)
      expect(
        body.flights.every((row) => row.flight_number !== 'PRIVATE' && ids.ids.includes(row.id)),
      ).toBe(true)
    }
  } finally {
    await dispose()
  }
})

it('requires a key, rejects invalid values, and validates airport references before writing', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    expect((await onRequestPost(context(db, '/api/flights', 'POST', flight))).status).toBe(400)
    expect(
      (
        await onRequestPost(
          context(db, '/api/flights', 'POST', { ...flight, date: '2025-02-30' }, 'date-test-001'),
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await onRequestPost(
          context(db, '/api/flights', 'POST', { ...flight, origin: 'XXX' }, 'airport-test-001'),
        )
      ).status,
    ).toBe(400)
    expect(await count(db, 'flights')).toBe(0)
    expect(await count(db, 'flight_idempotency')).toBe(0)
  } finally {
    await dispose()
  }
})

it('commits one flight and one receipt across concurrent same-key requests, then rejects conflicting reuse', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const responses = await Promise.all([
      onRequestPost(context(db, '/api/flights', 'POST', flight, 'concurrent-001')),
      onRequestPost(context(db, '/api/flights', 'POST', flight, 'concurrent-001')),
    ])
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201])
    const rows = await Promise.all(responses.map((r) => r.json() as Promise<{ id: number }>))
    expect(rows[0].id).toBe(rows[1].id)
    expect(await count(db, 'flights')).toBe(1)
    expect(await count(db, 'flight_idempotency')).toBe(1)
    expect(
      (
        await onRequestPost(
          context(db, '/api/flights', 'POST', { ...flight, destination: 'JFK' }, 'concurrent-001'),
        )
      ).status,
    ).toBe(409)
    expect(await count(db, 'flights')).toBe(1)
    expect(
      (
        await onRequestDelete(
          context(
            db,
            `/api/flights/${rows[0].id}`,
            'DELETE',
            undefined,
            undefined,
            String(rows[0].id),
          ),
        )
      ).status,
    ).toBe(200)
    expect(
      (await onRequestPost(context(db, '/api/flights', 'POST', flight, 'concurrent-001'))).status,
    ).toBe(410)
  } finally {
    await dispose()
  }
})

it('rolls back the key if flight insertion fails, so the same key can retry', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db
      .prepare(
        "CREATE TRIGGER fail_flight BEFORE INSERT ON flights BEGIN SELECT RAISE(ABORT, 'synthetic flight failure'); END",
      )
      .run()
    const failed = await onRequestPost(context(db, '/api/flights', 'POST', flight, 'rollback-001'))
    expect(failed.status).toBe(500)
    expect(await count(db, 'flight_idempotency')).toBe(0)
    expect(await count(db, 'flights')).toBe(0)
    await db.prepare('DROP TRIGGER fail_flight').run()
    expect(
      (await onRequestPost(context(db, '/api/flights', 'POST', flight, 'rollback-001'))).status,
    ).toBe(201)
  } finally {
    await dispose()
  }
})

it('acknowledges a committed flight as pending when derived publishing fails', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db
      .prepare(
        "CREATE TRIGGER fail_visit BEFORE INSERT ON visits BEGIN SELECT RAISE(ABORT, 'synthetic derived failure'); END",
      )
      .run()
    const response = await onRequestPost(
      context(db, '/api/flights', 'POST', flight, 'pending-test-001'),
    )
    expect(response.status).toBe(201)
    const body = (await response.json()) as { id: number; derived_state: string }
    expect(body.derived_state).toBe('pending')
    expect(await count(db, 'flights')).toBe(1)
    expect(await count(db, 'flight_idempotency')).toBe(1)
    const replay = await onRequestPost(
      context(db, '/api/flights', 'POST', flight, 'pending-test-001'),
    )
    expect(replay.status).toBe(200)
    expect(await replay.json()).toMatchObject({ id: body.id, derived_state: 'pending' })
    expect(await count(db, 'flights')).toBe(1)
  } finally {
    await dispose()
  }
})

it('saves the ATR 72-600 selected from the bundled aircraft catalogue', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const created = await onRequestPost(context(db, '/api/flights', 'POST', flight, 'atr-edit-001'))
    const { id } = (await created.json()) as { id: number }
    const saved = await onRequestPatch(
      context(db, `/api/flights/${id}`, 'PATCH', { aircraft_icao: 'AT76' }, undefined, String(id)),
    )
    expect(await saved.json()).toMatchObject({ id, aircraft_icao: 'AT76' })
    expect(saved.status).toBe(200)
    expect(
      await db.prepare('SELECT aircraft_icao FROM flights WHERE id = ?').bind(id).first(),
    ).toEqual({ aircraft_icao: 'AT76' })
  } finally {
    await dispose()
  }
})

it('preserves unchanged historical references but rejects a different unknown code', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const result = await db
      .prepare(
        'INSERT INTO flights (user_id,date,origin,destination,aircraft_icao,source,is_upcoming) VALUES (?,?,?,?,?,?,0)',
      )
      .bind(user.id, '2025-04-03', 'MOW', 'POD', 'ZZZZ', 'manual')
      .run()
    const id = String(result.meta.last_row_id)
    const path = `/api/flights/${id}`
    const unchanged = await onRequestPatch(
      context(
        db,
        path,
        'PATCH',
        { origin: 'mow', destination: 'POD', aircraft_icao: 'ZZZZ', flight_number: 'TEST1' },
        undefined,
        id,
      ),
    )
    expect(unchanged.status).toBe(200)
    expect(((await unchanged.json()) as { origin: string; destination: string }).origin).toBe('MOW')
    expect(
      (await onRequestPatch(context(db, path, 'PATCH', { destination: 'XXX' }, undefined, id)))
        .status,
    ).toBe(400)
  } finally {
    await dispose()
  }
})

it('recalculates route distance and duration while ignoring client overrides, and rejects a malformed date patch', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db
      .prepare('UPDATE airports_reference SET latitude=40.6413, longitude=-73.7781 WHERE iata=?')
      .bind('JFK')
      .run()
    const created = await onRequestPost(
      context(
        db,
        '/api/flights',
        'POST',
        { ...flight, duration_minutes: 999 },
        'route-duration-001',
      ),
    )
    const before = (await created.json()) as {
      id: number
      duration_minutes: number
      distance_km: number
    }
    const id = String(before.id)
    expect(
      (
        await onRequestPatch(
          context(db, `/api/flights/${id}`, 'PATCH', { date: '2025-02-30' }, undefined, id),
        )
      ).status,
    ).toBe(400)
    const unchanged = await onRequestGet(
      context(db, `/api/flights/${id}`, 'GET', undefined, undefined, id),
    )
    expect(await unchanged.json()).toMatchObject({
      date: flight.date,
      destination: 'IST',
      distance_km: before.distance_km,
    })
    const changed = await onRequestPatch(
      context(db, `/api/flights/${id}`, 'PATCH', { destination: 'JFK' }, undefined, id),
    )
    const after = (await changed.json()) as { duration_minutes: number; distance_km: number }
    expect(after.distance_km).toBeGreaterThan(before.distance_km)
    expect(after.duration_minutes).toBeGreaterThan(0)
    expect(after.duration_minutes).not.toBe(999)
    const overridden = await onRequestPatch(
      context(
        db,
        `/api/flights/${id}`,
        'PATCH',
        { destination: 'IST', distance_km: 1234, duration_minutes: 321 },
        undefined,
        id,
      ),
    )
    expect(await overridden.json()).toMatchObject({
      distance_km: before.distance_km,
      duration_minutes: before.duration_minutes,
      duration_source: 'estimate',
    })
  } finally {
    await dispose()
  }
})

it('publishes current stats and visits after bulk delete removes two flights', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const first = await onRequestPost(
      context(db, '/api/flights', 'POST', flight, 'multi-delete-001'),
    )
    const second = await onRequestPost(
      context(db, '/api/flights', 'POST', { ...flight, destination: 'JFK' }, 'multi-delete-002'),
    )
    const ids = [
      ((await first.json()) as { id: number }).id,
      ((await second.json()) as { id: number }).id,
    ]
    expect(
      (
        await db
          .prepare('SELECT total_flights FROM user_stats WHERE user_id = ?')
          .bind(user.id)
          .first<{ total_flights: number }>()
      )?.total_flights,
    ).toBe(2)
    expect(await count(db, 'visits')).toBe(3)

    const response = await bulkDelete(context(db, '/api/flights/bulk-delete', 'POST', { ids }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ deleted: 2, derived_state: 'ready' })
    expect(await count(db, 'flights')).toBe(0)
    expect(
      (
        await db
          .prepare('SELECT total_flights FROM user_stats WHERE user_id = ?')
          .bind(user.id)
          .first<{ total_flights: number }>()
      )?.total_flights,
    ).toBe(0)
    expect(await count(db, 'visits')).toBe(0)
  } finally {
    await dispose()
  }
})

it('publishes two flights that become completed in one sync', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.batch([
      db
        .prepare(
          'INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,1)',
        )
        .bind(user.id, flight.date, 'TBS', 'IST'),
      db
        .prepare(
          'INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,1)',
        )
        .bind(user.id, flight.date, 'TBS', 'JFK'),
    ])
    expect(await repairUserDerivedState(db, user.id)).toMatchObject({ derived_state: 'ready' })
    expect(
      (
        await db
          .prepare('SELECT total_flights FROM user_stats WHERE user_id = ?')
          .bind(user.id)
          .first<{ total_flights: number }>()
      )?.total_flights,
    ).toBe(0)

    const response = await syncUpcoming(context(db, '/api/flights/sync-upcoming', 'POST'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ synced: 2, derived_state: 'ready' })
    expect(
      (
        await db
          .prepare('SELECT total_flights FROM user_stats WHERE user_id = ?')
          .bind(user.id)
          .first<{ total_flights: number }>()
      )?.total_flights,
    ).toBe(2)
    expect(await count(db, 'visits')).toBe(3)
  } finally {
    await dispose()
  }
})

it('accepts valid aircraft changes in a mixed batch and publishes one revision', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db
      .prepare(
        "INSERT INTO aircraft_reference (icao, name, manufacturer, model, type, engine_type, engine_count) VALUES ('A320', 'Airbus A320', 'Airbus', 'A320', 'jet', 'jet', 2)",
      )
      .run()
    const [first, second] = await db.batch([
      db.prepare(
        "INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES ('u1','2025-04-03','TBS','IST',0)",
      ),
      db.prepare(
        "INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES ('u1','2025-04-03','TBS','JFK',0)",
      ),
    ])
    const ids = [first.meta.last_row_id as number, second.meta.last_row_id as number]
    const response = await aircraftBatch(
      context(db, '/api/flights/aircraft-batch', 'POST', {
        items: [
          { id: ids[0], aircraft_icao: 'A320' },
          { id: ids[1], aircraft_icao: 'XXXX' },
          { id: 99999, aircraft_icao: 'A320' },
        ],
      }),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      results: Array<{ status: string; code?: string; flight?: { aircraft_icao: string } }>
      derived_state: string
    }
    expect(body.results.map((result) => [result.status, result.code])).toEqual([
      ['accepted', undefined],
      ['error', 'UNKNOWN_AIRCRAFT'],
      ['error', 'NOT_FOUND'],
    ])
    expect(body.results[0].flight?.aircraft_icao).toBe('A320')
    expect(body.derived_state).toBe('ready')
    expect(
      await db
        .prepare("SELECT revision,published_revision FROM user_derived_state WHERE user_id='u1'")
        .first(),
    ).toEqual({ revision: 1, published_revision: 1 })
    expect(
      await db.prepare('SELECT aircraft_icao FROM flights WHERE id = ?').bind(ids[1]).first(),
    ).toEqual({ aircraft_icao: null })
  } finally {
    await dispose()
  }
})

// Contract: the endpoint sets an absolute aircraft value, so an identical replay is safe (a lost response can be retried).
async function seedAircraftReplay(db: D1Database) {
  await seed(db)
  await db
    .prepare(
      "INSERT INTO aircraft_reference (icao, name, manufacturer, model, type, engine_type, engine_count) VALUES ('A320', 'Airbus A320', 'Airbus', 'A320', 'jet', 'jet', 2)",
    )
    .run()
  const rows = await db.batch([
    db.prepare(
      "INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES ('u1','2025-04-03','TBS','IST',0)",
    ),
    db.prepare(
      "INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES ('u1','2025-04-04','TBS','JFK',0)",
    ),
  ])
  return rows.map((row) => row.meta.last_row_id as number)
}
type AircraftReplayBody = {
  results: Array<{
    id: number | null
    status: string
    code?: string
    flight?: { id: number; aircraft_icao: string }
  }>
  derived_state?: string
}
const snapshotFlights = async (db: D1Database) =>
  (await db.prepare('SELECT * FROM flights ORDER BY id').all()).results
const snapshotDerived = async (db: D1Database) => ({
  stats: await db
    .prepare('SELECT total_flights,aircraft_count FROM user_stats WHERE user_id = ?')
    .bind(user.id)
    .first(),
})

it('replays an identical aircraft batch to the same per-item results and unchanged flight rows', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const ids = await seedAircraftReplay(db)
    const items = ids.map((id) => ({ id, aircraft_icao: 'A320' }))
    const first = await aircraftBatch(context(db, '/api/flights/aircraft-batch', 'POST', { items }))
    expect(first.status).toBe(200)
    const original = (await first.json()) as AircraftReplayBody
    const rowsAfterFirst = await snapshotFlights(db)
    const replay = await aircraftBatch(
      context(db, '/api/flights/aircraft-batch', 'POST', { items }),
    )
    expect(replay.status).toBe(200)
    const replayed = (await replay.json()) as AircraftReplayBody
    expect(
      original.results.map((result) => [result.id, result.status, result.flight?.aircraft_icao]),
    ).toEqual(ids.map((id) => [id, 'accepted', 'A320']))
    expect(replayed.results).toEqual(original.results)
    expect(replayed.derived_state).toBe('ready')
    expect(await snapshotFlights(db)).toEqual(rowsAfterFirst)
  } finally {
    await dispose()
  }
})

it('replays a partial aircraft batch to the same per-item outcome', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const [valid] = await seedAircraftReplay(db)
    const items = [
      { id: valid, aircraft_icao: 'A320' },
      { id: 99999, aircraft_icao: 'A320' },
      { id: valid + 1, aircraft_icao: 'XXXX' },
    ]
    const first = (await (
      await aircraftBatch(context(db, '/api/flights/aircraft-batch', 'POST', { items }))
    ).json()) as AircraftReplayBody
    const rowsAfterFirst = await snapshotFlights(db)
    const replay = (await (
      await aircraftBatch(context(db, '/api/flights/aircraft-batch', 'POST', { items }))
    ).json()) as AircraftReplayBody
    expect(first.results.map((result) => [result.id, result.status, result.code])).toEqual([
      [valid, 'accepted', undefined],
      [99999, 'error', 'NOT_FOUND'],
      [valid + 1, 'error', 'UNKNOWN_AIRCRAFT'],
    ])
    expect(replay.results).toEqual(first.results)
    expect(await snapshotFlights(db)).toEqual(rowsAfterFirst)
    expect(
      await db
        .prepare('SELECT aircraft_icao FROM flights WHERE id = ?')
        .bind(valid + 1)
        .first(),
    ).toEqual({ aircraft_icao: null })
  } finally {
    await dispose()
  }
})

it('keeps derived totals identical after an aircraft batch is replayed', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const ids = await seedAircraftReplay(db)
    const items = ids.map((id) => ({ id, aircraft_icao: 'A320' }))
    await aircraftBatch(context(db, '/api/flights/aircraft-batch', 'POST', { items }))
    const afterFirst = await snapshotDerived(db)
    expect(afterFirst.stats).toEqual({ total_flights: 2, aircraft_count: 1 })
    await aircraftBatch(context(db, '/api/flights/aircraft-batch', 'POST', { items }))
    expect(await snapshotDerived(db)).toEqual(afterFirst)
    // The replay marks the account dirty again and republishes: a later revision, never a pending one.
    expect(
      await db
        .prepare("SELECT revision,published_revision FROM user_derived_state WHERE user_id='u1'")
        .first(),
    ).toEqual({ revision: 2, published_revision: 2 })
  } finally {
    await dispose()
  }
})

it('rolls back aircraft writes when the dirty marker cannot commit', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db
      .prepare(
        "INSERT INTO aircraft_reference (icao, name, manufacturer, model, type, engine_type, engine_count) VALUES ('A320', 'Airbus A320', 'Airbus', 'A320', 'jet', 'jet', 2)",
      )
      .run()
    const inserted = await db
      .prepare(
        "INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES ('u1','2025-04-03','TBS','IST',0)",
      )
      .run()
    const id = inserted.meta.last_row_id as number
    await db
      .prepare(
        "CREATE TRIGGER reject_dirty BEFORE INSERT ON user_derived_state BEGIN SELECT RAISE(ABORT, 'synthetic dirty failure'); END",
      )
      .run()
    const response = await aircraftBatch(
      context(db, '/api/flights/aircraft-batch', 'POST', {
        items: [{ id, aircraft_icao: 'A320' }],
      }),
    )
    expect(response.status).toBe(500)
    expect(
      await db.prepare('SELECT aircraft_icao FROM flights WHERE id = ?').bind(id).first(),
    ).toEqual({ aircraft_icao: null })
  } finally {
    await dispose()
  }
})

type BulkResult = {
  key: string | null
  status: 'created' | 'replayed' | 'error'
  flight?: { id: number }
  http_status?: number
  code?: string
}

async function bulk(db: D1Database, items: unknown[], headers: Record<string, string> = {}) {
  const request = csrfRequest('/api/flights/bulk', 'POST', { items }, headers)
  return bulkCreate({ ...apiContext(db, request), data: { user }, params: {} } as never)
}

async function derivedState(db: D1Database) {
  return db
    .prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?')
    .bind(user.id)
    .first<{ revision: number; published_revision: number }>()
}

it('bulk-creates flights with one dirty mark and one published repair, then replays by per-item key', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const items = [
      { key: 'bulk-item-001', flight },
      { key: 'bulk-item-002', flight: { ...flight, destination: 'JFK' } },
    ]
    const response = await bulk(db, items)
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      results: BulkResult[]
      derived_state: string
      revision: number
    }
    expect(body.results.map((r) => r.status)).toEqual(['created', 'created'])
    expect(body).toMatchObject({ derived_state: 'ready', revision: 1 })
    expect(await derivedState(db)).toEqual({ revision: 1, published_revision: 1 })
    expect(
      (
        await db
          .prepare('SELECT total_flights FROM user_stats WHERE user_id = ?')
          .bind(user.id)
          .first<{ total_flights: number }>()
      )?.total_flights,
    ).toBe(2)
    expect(await count(db, 'visits')).toBe(3)

    const replay = await bulk(db, items)
    const replayed = (await replay.json()) as { results: BulkResult[] }
    expect(replayed.results.map((r) => r.status)).toEqual(['replayed', 'replayed'])
    expect(replayed.results.map((r) => r.flight?.id)).toEqual(body.results.map((r) => r.flight?.id))
    expect(await count(db, 'flights')).toBe(2)
    expect(await count(db, 'flight_idempotency')).toBe(2)
  } finally {
    await dispose()
  }
})

it('shares the single-create ledger: same body replays, another body conflicts, a deleted flight is gone', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const created = (await (
      await onRequestPost(context(db, '/api/flights', 'POST', flight, 'shared-key-001'))
    ).json()) as { id: number }
    const deleted = (await (
      await onRequestPost(context(db, '/api/flights', 'POST', flight, 'shared-key-002'))
    ).json()) as { id: number }
    await db.prepare('DELETE FROM flights WHERE id = ?').bind(deleted.id).run()
    const response = await bulk(db, [
      { key: 'shared-key-001', flight },
      { key: 'shared-key-001', flight: { ...flight, date: '2025-04-04' } },
      { key: 'shared-key-002', flight },
    ])
    const body = (await response.json()) as { results: BulkResult[] }
    expect(body.results.map((r) => [r.status, r.http_status, r.code])).toEqual([
      ['replayed', undefined, undefined],
      ['error', 409, 'IDEMPOTENCY_CONFLICT'],
      ['error', 410, 'IDEMPOTENCY_GONE'],
    ])
    expect(body.results[0].flight?.id).toBe(created.id)
    expect(await count(db, 'flights')).toBe(1)
  } finally {
    await dispose()
  }
})

it('bulk-creates only the valid items of a mixed request and reports each failure in place', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const response = await bulk(db, [
      { key: 'mixed-item-001', flight: { ...flight, origin: 'XXX' } },
      { key: 'short', flight },
      { key: 'mixed-item-003', flight: { ...flight, date: '2025-02-30' } },
      { key: 'mixed-item-004', flight },
      'not an item',
    ])
    expect(response.status).toBe(200)
    const body = (await response.json()) as { results: BulkResult[]; derived_state: string }
    expect(body.results.map((r) => [r.status, r.code])).toEqual([
      ['error', 'UNKNOWN_AIRPORT'],
      ['error', 'IDEMPOTENCY_KEY_REQUIRED'],
      ['error', 'INVALID_FLIGHT'],
      ['created', undefined],
      ['error', 'IDEMPOTENCY_KEY_REQUIRED'],
    ])
    expect(body.derived_state).toBe('ready')
    expect(await count(db, 'flights')).toBe(1)
    expect(await count(db, 'flight_idempotency')).toBe(1)
  } finally {
    await dispose()
  }
})

it('rejects an over-limit or CSRF-less bulk request before writing anything', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const items = Array.from({ length: 51 }, (_, i) => ({
      key: `limit-item-${String(i).padStart(3, '0')}`,
      flight,
    }))
    const tooMany = await bulk(db, items)
    expect(tooMany.status).toBe(413)
    expect(await tooMany.json()).toMatchObject({ code: 'TOO_MANY_FLIGHTS' })
    const forged = await bulk(db, items.slice(0, 1), { 'X-CSRF-Token': 'forged' })
    expect(forged.status).toBe(403)
    expect((await bulk(db, [])).status).toBe(400)
    expect(await count(db, 'flights')).toBe(0)
    expect(await count(db, 'flight_idempotency')).toBe(0)
    expect(await derivedState(db)).toBeNull()
  } finally {
    await dispose()
  }
})

it('list and ids reject invalid ranges with a validation error', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    for (const range of [
      'from=2025-04-03',
      'to=2025-04-03',
      'from=&to=',
      'from=2025-04-04&to=2025-04-03',
      'from=2025-02-29&to=2025-03-01',
      'from=2025-04&to=2025-05',
      'from=2025-04-31&to=2025-05-01',
    ]) {
      for (const [path, handler] of [
        ['/api/flights', listFlights],
        ['/api/flights/ids', flightIds],
      ] as const) {
        const response = await handler(context(db, `${path}?year=2025&${range}`, 'GET'))
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({ code: 'INVALID_DATE_RANGE' })
      }
    }
  } finally {
    await dispose()
  }
})

it('keeps a concurrently assigned aircraft when filling missing values, and replaces it only explicitly', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const [id] = await seedAircraftReplay(db)
    // Another tab filled the null value after the Journal selected its missing-aircraft rows.
    await db.prepare("UPDATE flights SET aircraft_icao = 'B738' WHERE id = ?").bind(id).run()
    const items = [{ id, aircraft_icao: 'A320' }]
    const filled = (await (
      await aircraftBatch(context(db, '/api/flights/aircraft-batch', 'POST', { items }))
    ).json()) as AircraftReplayBody
    expect(filled.results).toMatchObject([{ status: 'error', code: 'STATE_CONFLICT' }])
    expect(
      await db.prepare('SELECT aircraft_icao FROM flights WHERE id = ?').bind(id).first(),
    ).toEqual({ aircraft_icao: 'B738' })
    const replaced = (await (
      await aircraftBatch(
        context(db, '/api/flights/aircraft-batch', 'POST', { items, replaceAll: true }),
      )
    ).json()) as AircraftReplayBody
    expect(replaced.results).toMatchObject([
      { status: 'accepted', flight: { aircraft_icao: 'A320' } },
    ])
  } finally {
    await dispose()
  }
})

const undoContext = (db: D1Database, id: number, body: unknown) =>
  ({
    ...(context(db, `/api/flights/${id}`, 'PATCH', body, undefined, String(id)) as {
      request: Request
      data: { user: typeof user }
      params: { id: string }
    }),
    env: { DB: db, AUTH_SECRET: 'flight-undo-test-secret' },
  }) as never

it('rejects Undo after another tab changes the flight, and rejects tampered, foreign-owner or expired tokens', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const [id] = await seedAircraftReplay(db)
    const saved = await onRequestPatch(
      undoContext(db, id, { aircraft_icao: 'A320', offer_undo: true }),
    )
    expect(saved.status).toBe(200)
    const { undo_token: token } = (await saved.json()) as { undo_token: string }
    expect(typeof token).toBe('string')
    const original = await db
      .prepare('SELECT aircraft_icao FROM flights WHERE id = ?')
      .bind(id)
      .first()
    const tampered = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0')
    expect((await onRequestPatch(undoContext(db, id, { undo_token: tampered }))).status).toBe(409)
    const foreign = {
      ...(undoContext(db, id, { undo_token: token }) as {
        request: Request
        env: Env
        params: { id: string }
      }),
      data: { user: { id: 'u2', email: 'other@example.test' } },
    } as never
    expect((await onRequestPatch(foreign)).status).toBe(404)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60_000)
    expect((await onRequestPatch(undoContext(db, id, { undo_token: token }))).status).toBe(409)
    vi.restoreAllMocks()
    expect(
      await db.prepare('SELECT aircraft_icao FROM flights WHERE id = ?').bind(id).first(),
    ).toEqual(original)
    await db.prepare("UPDATE flights SET aircraft_icao = 'B738' WHERE id = ?").bind(id).run()
    expect((await onRequestPatch(undoContext(db, id, { undo_token: token }))).status).toBe(409)
    expect(
      await db.prepare('SELECT aircraft_icao FROM flights WHERE id = ?').bind(id).first(),
    ).toEqual({ aircraft_icao: 'B738' })
  } finally {
    await dispose()
  }
})

it.each([{ destination: 'JFK' }, { date: '2099-04-03' }])(
  'Undo restores the complete confirmation, transit and metrics snapshot after %j',
  async (patch) => {
    const { db, dispose } = await createApiDatabase()
    try {
      const [id, leg] = await seedAircraftReplay(db)
      await db
        .prepare(
          "UPDATE flights SET lifecycle_state = 'logged', is_upcoming = 0, confirmation_source = 'user', confirmed_at = '2025-04-03T12:00:00.000Z', lifecycle_timezone = 'Asia/Tbilisi', arrival_transit = 1, arrival_transit_leg_id = ?, duration_minutes = 111, duration_source = 'estimate', distance_km = 123 WHERE id = ?",
        )
        .bind(leg, id)
        .run()
      const before = await db.prepare('SELECT * FROM flights WHERE id = ?').bind(id).first()
      const saved = await onRequestPatch(undoContext(db, id, { ...patch, offer_undo: true }))
      expect(saved.status).toBe(200)
      const { undo_token: token } = (await saved.json()) as { undo_token: string }
      const undone = await onRequestPatch(undoContext(db, id, { undo_token: token }))
      expect(undone.status).toBe(200)
      expect(await undone.json()).toMatchObject({
        confirmation_source: 'user',
        confirmed_at: '2025-04-03T12:00:00.000Z',
        arrival_transit: true,
        arrival_transit_leg_id: leg,
        duration_minutes: 111,
      })
      expect(await db.prepare('SELECT * FROM flights WHERE id = ?').bind(id).first()).toEqual(
        before,
      )
    } finally {
      await dispose()
    }
  },
)
