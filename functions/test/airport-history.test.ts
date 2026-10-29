import { expect, it, vi } from 'vitest'
import { encodeAirportScope, type AirportHistory } from '../../packages/shared/src/airportHistory'
import type { OverviewFilter } from '../../packages/shared/src/overview/model'
import { onRequestGet } from '../api/me/airports/[iata]/history'
import { dirtyUserStatement, repairUserDerivedState } from '../api/_services/derivedState'
import { readOverviewData } from '../api/_services/overviewData'
import { apiContext } from './harness'
import { bulkFlights, overviewAccount, USER } from './overview-fixture'

function request(
  db: D1Database,
  options: {
    filter?: OverviewFilter
    cursor?: string
    owner?: string
    iata?: string
    rawScope?: string
    user?: typeof USER | null
  } = {},
) {
  const query = new URLSearchParams({ owner: options.owner ?? USER.id })
  if (options.filter) query.set('scope', encodeAirportScope(options.filter))
  if (options.rawScope !== undefined) query.set('scope', options.rawScope)
  if (options.cursor !== undefined) query.set('cursor', options.cursor)
  return onRequestGet({
    ...apiContext(db, new Request(`https://kuuki.test/api/me/airports/TBS/history?${query}`)),
    params: { iata: options.iata ?? 'TBS' },
    data: options.user === null ? {} : { user: options.user ?? USER },
  } as never)
}
async function history(db: D1Database, options: Parameters<typeof request>[1] = {}) {
  const response = await request(db, options)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  return response.json() as Promise<AirportHistory>
}

it.each([
  { user: null, owner: USER.id, status: 401, code: 'UNAUTHORIZED' },
  { owner: 'another', status: 409, code: 'OWNER_CHANGED' },
  { owner: '', status: 400, code: 'OWNER_REQUIRED' },
])('refuses private reads before database access: $code', async ({ status, code, ...options }) => {
  const prepare = vi.fn()
  const batch = vi.fn()
  const response = await request({ prepare, batch } as unknown as D1Database, options)
  expect(response.status).toBe(status)
  if (status !== 401) expect(await response.json()).toMatchObject({ code })
  expect(prepare).not.toHaveBeenCalled()
  expect(batch).not.toHaveBeenCalled()
})

it.each([
  { rawScope: '', code: 'INVALID_SCOPE' },
  { rawScope: btoa('{"v":1,"filter":{"unknown":true}}'), code: 'INVALID_SCOPE' },
  { rawScope: 'a'.repeat(12000), code: 'INVALID_SCOPE' },
  { cursor: 'garbage', code: 'INVALID_CURSOR' },
  { iata: 'TBS OR 1=1', code: 'INVALID_AIRPORT' },
])('rejects malformed history input before reading: $code', async ({ code, ...options }) => {
  const prepare = vi.fn()
  const response = await request({ prepare } as unknown as D1Database, options)
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ code })
  expect(prepare).not.toHaveBeenCalled()
})

it('keeps exact IDs and all inherited facets above the Overview aggregation threshold', async () => {
  const { db, dispose } = await overviewAccount(
    [
      {
        id: 6001,
        date: '2025-03-01',
        origin: 'TBS',
        destination: 'LHR',
        state: 'awaiting',
        airline: 'TK',
        aircraft: 'A320',
        km: 3000,
        minutes: 240,
      },
      {
        id: 6002,
        date: '2025-03-01',
        origin: 'TBS',
        destination: 'LHR',
        state: 'logged',
        airline: 'TK',
        aircraft: 'A320',
        km: 3000,
        minutes: 240,
        transit: 1,
        leg: 6003,
      },
      {
        id: 6003,
        date: '2025-03-01',
        origin: 'LHR',
        destination: 'JFK',
        state: 'logged',
        airline: 'TK',
        aircraft: 'A320',
        km: 3000,
      },
      {
        id: 6004,
        date: '2025-03-01',
        origin: 'TBS',
        destination: 'LHR',
        state: 'logged',
        airline: 'BA',
        aircraft: 'B738',
        km: 3000,
        minutes: 240,
      },
    ],
    (d) => [
      bulkFlights(d, 5010),
      d.prepare(
        "UPDATE flights SET departure_time = '07:15', arrival_time = NULL, departure_utc = '2025-03-01T07:15:00Z', dest_tz = 'Europe/London', duration_source = 'times', flight_number = 'TK123' WHERE id > 6000",
      ),
      d.prepare("UPDATE aircraft_reference SET type = 'narrowbody' WHERE icao = 'A320'"),
    ],
  )
  try {
    expect((await readOverviewData(db, USER.id)).mode).toBe('aggregate')
    const filter: OverviewFilter = {
      period: { years: [2025] },
      countries: ['GB'],
      regions: ['europe'],
      airlines: ['TK'],
      aircraft: ['A320'],
      families: ['A320'],
      alliances: ['star'],
      makers: ['airbus'],
      bodies: ['narrow'],
      depHours: [7],
      arrHours: [11],
      months: [3],
      haul: ['medium'],
      domestic: ['international'],
      departureBands: ['morning'],
      routes: ['LHR-TBS'],
      airports: ['LHR'],
    }
    const payload = await history(db, { filter })
    expect(payload.total).toBe(1)
    expect(payload.items).toEqual([
      {
        id: 6001,
        date: '2025-03-01',
        origin: 'TBS',
        destination: 'LHR',
        airline: 'TK',
        flightNumber: 'TK123',
        state: 'awaiting',
      },
    ])
    expect(payload.nextCursor).toBeNull()
    let transferred = 0
    const bounded = {
      prepare: db.prepare.bind(db),
      batch: async (statements: D1PreparedStatement[]) => {
        const results = await db.batch(statements)
        transferred = results.reduce((sum, result) => sum + result.results.length, 0)
        return results
      },
    } as unknown as D1Database
    expect((await history(bounded)).total).toBe(5013)
    expect(transferred).toBeLessThanOrEqual(64)
  } finally {
    await dispose()
  }
})

it('counts self-endpoints once, excludes upcoming and foreign flights, and preserves awaiting', async () => {
  const { db, dispose } = await overviewAccount(
    [
      { id: 1, date: '2025-01-01', origin: 'TBS', destination: 'TBS', state: 'logged' },
      { id: 2, date: '2025-02-01', origin: 'TBS', destination: 'IST', state: 'awaiting' },
      { id: 3, date: '2099-01-01', origin: 'TBS', destination: 'IST', state: 'upcoming' },
    ],
    (d) => [
      d.prepare("INSERT INTO users (id,email,password_hash) VALUES ('other','other@test','hash')"),
      d.prepare(
        "INSERT INTO flights (id,user_id,date,origin,destination) VALUES (4,'other','2025-01-01','TBS','IST')",
      ),
      d.prepare(
        "INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json) VALUES ('archive','u1','TBS','GE','2000-01-01','2000-01-01',99,'d','archive',1,'{}')",
      ),
    ],
  )
  try {
    const batch = vi.fn(db.batch.bind(db))
    const payload = await history({ prepare: db.prepare.bind(db), batch } as unknown as D1Database)
    expect(batch).toHaveBeenCalledTimes(1)
    expect(payload.total).toBe(2)
    expect(payload.items.map(({ id, state }) => [id, state])).toEqual([
      [2, 'awaiting'],
      [1, 'logged'],
    ])
    const other = await history(db, { owner: 'other', user: { id: 'other', email: 'other@test' } })
    expect(other.items.map(({ id }) => id)).toEqual([4])
    expect(other.ownerId).toBe('other')
  } finally {
    await dispose()
  }
})

it.each(['absent', 'planned', 'completed', 'cancelled', 'deleted', 'foreign'] as const)(
  'applies saved ground scope using global noncancelled owner presence: %s',
  async (kind) => {
    const { db, dispose } = await overviewAccount([
      { id: 1, date: '2025-01-01', origin: 'TBS', destination: 'IST', state: 'logged' },
    ])
    try {
      if (kind !== 'absent') {
        await db
          .prepare(
            "INSERT INTO users (id,email,password_hash) VALUES ('other','other@test','hash')",
          )
          .run()
        await db
          .prepare(`INSERT INTO ground_journeys (id,user_id,mode,status,version,start_date,confirmed_at,created_at,updated_at,deleted_at)
          VALUES ('ground',?,'road',?,1,?,?,?,?,?)`)
          .bind(
            kind === 'foreign' ? 'other' : USER.id,
            kind === 'deleted'
              ? null
              : kind === 'completed'
                ? 'completed'
                : kind === 'cancelled'
                  ? 'cancelled'
                  : 'planned',
            kind === 'deleted' ? null : '1999-01-01',
            kind === 'completed' ? '1999-01-02' : null,
            kind === 'deleted' ? null : '1999-01-01',
            kind === 'deleted' ? null : '1999-01-01',
            kind === 'deleted' ? '2000-01-01' : null,
          )
          .run()
      }
      const payload = await history(db, { filter: { scope: 'ground', period: { years: [2025] } } })
      expect(payload.total).toBe(kind === 'planned' || kind === 'completed' ? 0 : 1)
    } finally {
      await dispose()
    }
  },
)

it.each([
  { name: 'unfiltered SQL page', filter: undefined },
  { name: 'canonical predicate', filter: { airports: ['TBS'] } },
])(
  'paginates raw date/id across legacy labels with bound revision cursors: $name',
  async ({ filter }) => {
    const { db, dispose } = await overviewAccount([], (d) => [
      bulkFlights(d, 103),
      d.prepare("UPDATE flights SET date = CASE WHEN id > 60 THEN '2025-01-01' ELSE '2024-03' END"),
    ])
    try {
      const first = await history(db, { filter })
      expect(first.total).toBe(103)
      expect(first.items.map(({ id }) => id)).toEqual(Array.from({ length: 50 }, (_, i) => 103 - i))
      expect(first.items.at(-1)?.date).toBe('2024-03')
      const second = await history(db, { filter, cursor: first.nextCursor! })
      const third = await history(db, { filter, cursor: second.nextCursor! })
      expect([...second.items, ...third.items].map(({ id }) => id)).toEqual(
        Array.from({ length: 53 }, (_, i) => 53 - i),
      )
      expect(third.nextCursor).toBeNull()
      for (const options of [{ iata: 'JFK' }, { filter: { airlines: ['TK'] } }]) {
        expect((await request(db, { filter, ...options, cursor: first.nextCursor! })).status).toBe(
          400,
        )
      }
      await db
        .prepare("INSERT INTO users (id,email,password_hash) VALUES ('other','other@test','hash')")
        .run()
      expect(
        (
          await request(db, {
            filter,
            owner: 'other',
            user: { id: 'other', email: 'other@test' },
            cursor: first.nextCursor!,
          })
        ).status,
      ).toBe(400)
      await db.prepare('UPDATE user_derived_state SET evidence_revision = 0').run()
      const unpublished = await request(db, { filter, cursor: first.nextCursor! })
      expect(unpublished.status).toBe(409)
      expect(await unpublished.json()).toMatchObject({ code: 'STALE_CURSOR' })
      await repairUserDerivedState(db, USER.id)
      await dirtyUserStatement(db, USER.id).run()
      const stale = await request(db, { filter, cursor: first.nextCursor! })
      expect(stale.status).toBe(409)
      expect(await stale.json()).toMatchObject({ code: 'STALE_CURSOR' })
      expect((await history(db, { filter })).items).toHaveLength(50)
    } finally {
      await dispose()
    }
  },
)

it.each(['pending', 'error', 'stale-evidence'] as const)(
  'keeps ordinary history readable but withholds evidence-dependent results: %s',
  async (kind) => {
    const { db, dispose } = await overviewAccount([
      { id: 1, date: '2025-01-01', origin: 'TBS', destination: 'IST', state: 'logged' },
    ])
    try {
      if (kind === 'stale-evidence')
        await db.prepare('UPDATE user_derived_state SET evidence_revision = 0').run()
      else {
        await dirtyUserStatement(db, USER.id).run()
        if (kind === 'error')
          await db.prepare("UPDATE user_derived_state SET last_error = 'FAILED'").run()
      }
      expect(await history(db)).toMatchObject({
        status: 'ready',
        total: 1,
        derivedState: kind === 'error' ? 'error' : 'pending',
      })
      for (const filter of [{ countries: ['GE'] }, { regions: ['asia'] }]) {
        expect(await history(db, { filter })).toMatchObject({
          status: 'scope-updating',
          total: null,
          items: [],
          nextCursor: null,
        })
      }
      await repairUserDerivedState(db, USER.id)
      expect(await history(db, { filter: { countries: ['GE'] } })).toMatchObject({
        status: 'ready',
        total: 1,
      })
    } finally {
      await dispose()
    }
  },
)

it('reports a failed database read as an error instead of an empty history', async () => {
  const { db, dispose } = await overviewAccount([])
  try {
    const failed = {
      prepare: db.prepare.bind(db),
      batch: async () => [{ success: false, results: [] }],
    } as unknown as D1Database
    const response = await request(failed)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error', code: 'INTERNAL' })
  } finally {
    await dispose()
  }
})
