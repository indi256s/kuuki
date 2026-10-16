import { expect, it } from 'vitest'
import { createApiDatabase } from './harness'
import { refreshLeaderboards } from '../api/_services/leaderboard'
import { readLeaderboardBoard, readPublicLeaderboard } from '../api/_services/publicLeaderboard'
import { onRequestGet as totalUsers } from '../api/leaderboard/total-users'

const NOW = new Date('2026-06-15T12:00:00.000Z')

interface Member {
  id: string
  flights?: number
  distance?: number
  countries?: number
  isPublic?: boolean
  publication?: 'flights' | 'all'
  createdAt?: string
}

function member(db: D1Database, m: Member) {
  return [
    db
      .prepare('INSERT INTO users(id,email,password_hash) VALUES (?,?,?)')
      .bind(m.id, `${m.id}@example.test`, 'h'),
    db
      .prepare(
        'INSERT INTO profiles(id,username,display_name,is_public,show_on_leaderboards,passport_publication,created_at) VALUES (?,?,?,?,1,?,?)',
      )
      .bind(
        m.id,
        m.id,
        m.id.toUpperCase(),
        m.isPublic === false ? 0 : 1,
        m.publication ?? 'flights',
        m.createdAt ?? '2026-01-01T00:00:00.000Z',
      ),
    db
      .prepare(
        'INSERT INTO user_stats(user_id,total_flights,total_distance_km,countries_count,airports_count,airlines_count) VALUES (?,?,?,?,?,?)',
      )
      .bind(m.id, m.flights ?? 0, m.distance ?? 0, m.countries ?? 0, 0, 0),
  ]
}

let journeyId = 0
function journey(
  db: D1Database,
  userId: string,
  mode: 'rail' | 'road',
  status: 'planned' | 'completed' | 'cancelled',
  startDate: string,
  countries: string[] = [],
  // Places in order, [lat, lon] or null for one without coordinates: rail legs join neighbours, road points list them.
  stops: Array<[number, number] | null> = [],
) {
  const id = `j${++journeyId}`
  const place = (i: number) =>
    JSON.stringify({
      source: 'geonames',
      id: String(i + 1),
      name: `Place ${i + 1}`,
      countryCode: 'DE',
      lat: stops[i]?.[0] ?? null,
      lon: stops[i]?.[1] ?? null,
    })
  const at = '2026-01-01T00:00:00.000Z'
  return [
    db
      .prepare(
        `INSERT INTO ground_journeys (id,user_id,mode,status,version,start_date,end_date,created_at,updated_at,confirmed_at)
         VALUES (?,?,?,?,1,?,?,?,?,?)`,
      )
      .bind(
        id,
        userId,
        mode,
        status,
        startDate,
        startDate,
        at,
        at,
        status === 'completed' ? at : null,
      ),
    ...countries.map((cc) =>
      db
        .prepare(
          'INSERT INTO ground_journey_countries(journey_id,user_id,country_code) VALUES (?,?,?)',
        )
        .bind(id, userId, cc),
    ),
    ...stops
      .map((_, i) =>
        mode === 'road'
          ? db
              .prepare(
                'INSERT INTO ground_road_points (id,journey_id,user_id,ordinal,place) VALUES (?,?,?,?,?)',
              )
              .bind(`${id}-p${i}`, id, userId, i, place(i))
          : db
              .prepare(
                'INSERT INTO ground_rail_legs (id,journey_id,user_id,ordinal,from_place,to_place) VALUES (?,?,?,?,?,?)',
              )
              .bind(`${id}-l${i}`, id, userId, i - 1, place(i - 1), place(i)),
      )
      .slice(mode === 'road' ? 0 : 1),
  ]
}

const board = async (db: D1Database, category: string, period = 'all') =>
  (
    await db
      .prepare(
        'SELECT user_id, value, rank, percentile FROM leaderboard_cache WHERE category = ? AND period = ? ORDER BY rank, id',
      )
      .bind(category, period)
      .all<{ user_id: string; value: number; rank: number; percentile: number }>()
  ).results

it('ranks public members only, shares a place on equal values and skips the next', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      ...member(db, { id: 'lead', flights: 20 }),
      ...member(db, { id: 'hidden', flights: 15, isPublic: false }),
      ...member(db, { id: 'tie-late', flights: 10, createdAt: '2026-03-01T00:00:00.000Z' }),
      ...member(db, { id: 'tie-early', flights: 10, createdAt: '2026-02-01T00:00:00.000Z' }),
      ...member(db, { id: 'last', flights: 5 }),
      ...member(db, { id: 'few', flights: 4 }),
    ])
    await refreshLeaderboards(db, NOW)
    expect(await board(db, 'flights')).toEqual([
      { user_id: 'lead', value: 20, rank: 1, percentile: 75 },
      { user_id: 'tie-early', value: 10, rank: 2, percentile: 50 },
      { user_id: 'tie-late', value: 10, rank: 2, percentile: 50 },
      { user_id: 'last', value: 5, rank: 4, percentile: 0 },
    ])
    // The public read agrees with the cache: no gap where the hidden member used to sit.
    const read = await readPublicLeaderboard(db, 'flights')
    expect(read.entries.map((e) => e.rank)).toEqual([1, 2, 2, 4])
    expect(read.total).toBe(4)
  } finally {
    await dispose()
  }
})

it('ranks ground categories only for members who publish all countries with three completed journeys', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      ...member(db, { id: 'all', publication: 'all' }),
      ...member(db, { id: 'roadie', publication: 'all' }),
      ...member(db, { id: 'flights-only', publication: 'flights' }),
      ...member(db, { id: 'two', publication: 'all' }),
      ...journey(db, 'all', 'rail', 'completed', '2026-02-01', ['DE', 'AT']),
      ...journey(db, 'all', 'rail', 'completed', '2025-05-01', ['DE']),
      ...journey(db, 'all', 'road', 'completed', '2024-05-01', ['FR']),
      ...journey(db, 'all', 'rail', 'planned', '2026-09-01', ['IT']),
      ...journey(db, 'all', 'rail', 'cancelled', '2026-03-01', ['CH']),
      ...journey(db, 'roadie', 'road', 'completed', '2026-01-10', ['GE']),
      ...journey(db, 'roadie', 'road', 'completed', '2026-02-10', ['AM']),
      ...journey(db, 'roadie', 'road', 'completed', '2026-03-10', ['GE']),
      ...journey(db, 'flights-only', 'rail', 'completed', '2026-01-01'),
      ...journey(db, 'flights-only', 'rail', 'completed', '2026-01-02'),
      ...journey(db, 'flights-only', 'rail', 'completed', '2026-01-03'),
      ...journey(db, 'two', 'rail', 'completed', '2026-01-01'),
      ...journey(db, 'two', 'road', 'completed', '2026-01-02'),
      ...journey(db, 'two', 'road', 'planned', '2026-01-03'),
    ])
    await refreshLeaderboards(db, NOW)
    expect(await board(db, 'rail')).toEqual([{ user_id: 'all', value: 2, rank: 1, percentile: 0 }])
    expect((await board(db, 'road')).map((r) => [r.user_id, r.value, r.rank])).toEqual([
      ['roadie', 3, 1],
      ['all', 1, 2],
    ])
    expect((await board(db, 'ground_countries')).map((r) => [r.user_id, r.value])).toEqual([
      ['all', 3],
      ['roadie', 2],
    ])
    // The year counts journeys starting in 2026 only; thresholds stay all-time.
    expect((await board(db, 'rail', '2026')).map((r) => [r.user_id, r.value])).toEqual([['all', 1]])
    expect((await board(db, 'road', '2026')).map((r) => [r.user_id, r.value])).toEqual([
      ['roadie', 3],
    ])
    expect((await board(db, 'ground_countries', '2026')).map((r) => [r.user_id, r.value])).toEqual([
      ['all', 2],
      ['roadie', 2],
    ])
    // Ground members without flights never reach the sky boards.
    expect(await board(db, 'flights')).toEqual([])
    // Eligibility is live: cancelling a journey after the rebuild drops the member below three before the next pass.
    await db
      .prepare(
        "UPDATE ground_journeys SET status = 'cancelled', confirmed_at = NULL WHERE user_id = 'roadie' AND start_date = '2026-03-10'",
      )
      .run()
    expect((await readPublicLeaderboard(db, 'road')).entries.map((e) => e.user_id)).toEqual(['all'])
  } finally {
    await dispose()
  }
})

it('counts only public members in the ranked total', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      ...member(db, { id: 'shown', flights: 9 }),
      ...member(db, { id: 'later-private', flights: 7 }),
    ])
    await refreshLeaderboards(db, NOW)
    // Turning private after the rebuild removes the member from the count straight away.
    await db.prepare("UPDATE profiles SET is_public = 0 WHERE id = 'later-private'").run()
    const response = await totalUsers({ env: { DB: db } } as never)
    expect(await response.json()).toEqual({ total: 1 })
  } finally {
    await dispose()
  }
})

it('counts only the current year in year rows, from that year flights and airport countries', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      db.prepare(
        "INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('QAA','A','A','Alpha','AA')",
      ),
      db.prepare(
        "INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('QBB','B','B','Beta','BB')",
      ),
      db.prepare(
        "INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES ('QCC','C','C','Beta','BB')",
      ),
      ...member(db, { id: 'flyer', flights: 6, distance: 999 }),
      ...member(db, { id: 'idle', flights: 9 }),
    ])
    const flight = (
      userId: string,
      date: string,
      from: string,
      to: string,
      km: number,
      airline: string | null,
    ) =>
      db
        .prepare(
          "INSERT INTO flights (user_id,date,origin,destination,distance_km,airline_iata,is_upcoming,enrichment_status) VALUES (?,?,?,?,?,?,0,'skipped')",
        )
        .bind(userId, date, from, to, km, airline)
    await db.batch([
      flight('flyer', '2026-01-05', 'QAA', 'QBB', 100.4, 'XA'),
      flight('flyer', '2026-02-05', 'QBB', 'QCC', 50.4, null),
      flight('flyer', '2025-12-31', 'QAA', 'QCC', 700, 'XB'),
      flight('idle', '2024-06-01', 'QAA', 'QBB', 300, 'XA'),
    ])
    await refreshLeaderboards(db, NOW)
    const year = await db
      .prepare(
        "SELECT category, user_id, value, rank FROM leaderboard_cache WHERE period = '2026' ORDER BY category",
      )
      .all()
    expect(year.results).toEqual([
      { category: 'airlines', user_id: 'flyer', value: 1, rank: 1 },
      { category: 'cities', user_id: 'flyer', value: 3, rank: 1 },
      { category: 'countries', user_id: 'flyer', value: 2, rank: 1 },
      { category: 'distance', user_id: 'flyer', value: 151, rank: 1 },
      { category: 'flights', user_id: 'flyer', value: 2, rank: 1 },
    ])
    // All-time sky rows keep the parity rule: every eligible member ranks, from user_stats.
    expect((await board(db, 'flights')).map((r) => [r.user_id, r.value])).toEqual([
      ['idle', 9],
      ['flyer', 6],
    ])
  } finally {
    await dispose()
  }
})

it('keeps every insert under the 100-variable limit and writes every row', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch(
      Array.from({ length: 30 }, (_, i) =>
        member(db, {
          id: `m${String(i).padStart(2, '0')}`,
          flights: 5 + i,
          distance: 100 * i,
          countries: i,
        }),
      ).flat(),
    )
    const binds: number[] = []
    const spy = new Proxy(db, {
      get(target, prop) {
        if (prop !== 'prepare')
          return Reflect.get(target, prop).bind?.(target) ?? Reflect.get(target, prop)
        return (sql: string) => {
          if (sql.startsWith('INSERT INTO leaderboard_cache')) binds.push(sql.split('?').length - 1)
          return target.prepare(sql)
        }
      },
    })
    await refreshLeaderboards(spy, NOW)
    expect(Math.max(...binds)).toBeLessThanOrEqual(100)
    expect(binds.length).toBeGreaterThan(1)
    const count = await db
      .prepare("SELECT COUNT(*) AS n FROM leaderboard_cache WHERE period = 'all'")
      .first<{ n: number }>()
    expect(count?.n).toBe(30 * 5)
  } finally {
    await dispose()
  }
})

it('reads the whole page at once: top rows for a guest, the neighbourhood and gap for a viewer', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    // 25 members, flights 54 down to 30; m14 sits at place 15, outside the top ten.
    await db.batch(
      Array.from({ length: 25 }, (_, i) =>
        member(db, { id: `m${String(i).padStart(2, '0')}`, flights: 54 - i, publication: 'all' }),
      ).flat(),
    )
    await db.batch([...member(db, { id: 'newbie', flights: 2 })])
    await refreshLeaderboards(db, NOW)

    const guest = await readLeaderboardBoard(db, null, NOW)
    expect(guest.year).toBe('2026')
    expect(guest.viewer).toBeNull()
    expect(guest.boards.flights.all.total).toBe(25)
    expect(guest.boards.flights.all.top.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(guest.boards.rail.all).toEqual({ top: [], total: 0 })

    const viewer = await readLeaderboardBoard(db, 'm14', NOW)
    const place = viewer.viewer?.places.flights.all
    expect(place).toMatchObject({ state: 'ranked', entry: { rank: 15, value: 40 } })
    if (place?.state !== 'ranked') throw new Error('expected a ranked place')
    expect(place.neighbours.map((e) => e.rank)).toEqual([13, 14, 15, 16, 17])
    expect(place.next).toMatchObject({ entry: { username: 'm13', rank: 14 }, gap: 1 })
    expect(viewer.viewer?.places.rail.all).toEqual({ state: 'progress', have: 0, need: 3 })

    const leader = await readLeaderboardBoard(db, 'm00', NOW)
    expect(leader.viewer?.places.flights.all).toMatchObject({ state: 'ranked', next: null })

    const newbie = await readLeaderboardBoard(db, 'newbie', NOW)
    expect(newbie.viewer?.places.flights.all).toEqual({ state: 'progress', have: 2, need: 5 })
    expect(newbie.viewer?.places.rail['2026']).toEqual({ state: 'progress', have: 0, need: 3 })
  } finally {
    await dispose()
  }
})

it('keeps the top of a board whose cached leaders have since left it', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    // 31 members ranked 1–31; the first ten turn private after the rebuild, leaving 21 with cached ranks 11–31.
    await db.batch(
      Array.from({ length: 31 }, (_, i) =>
        member(db, { id: `m${String(i).padStart(2, '0')}`, flights: 60 - i }),
      ).flat(),
    )
    await refreshLeaderboards(db, NOW)
    await db.prepare("UPDATE profiles SET is_public = 0 WHERE id < 'm10'").run()

    const guest = await readLeaderboardBoard(db, null, NOW)
    expect(guest.boards.flights.all.total).toBe(21)
    expect(guest.boards.flights.all.top.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(guest.boards.flights.all.top.map((e) => e.username)).toEqual([
      'm10',
      'm11',
      'm12',
      'm13',
      'm14',
      'm15',
      'm16',
      'm17',
      'm18',
      'm19',
    ])
  } finally {
    await dispose()
  }
})

it('tells a viewer with enough journeys that only publication blocks the ground boards', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      ...member(db, { id: 'walker', flights: 6, publication: 'flights' }),
      ...journey(db, 'walker', 'rail', 'completed', '2026-01-01'),
      ...journey(db, 'walker', 'rail', 'completed', '2026-01-02'),
      ...journey(db, 'walker', 'road', 'completed', '2026-01-03'),
    ])
    await refreshLeaderboards(db, NOW)
    const read = await readLeaderboardBoard(db, 'walker', NOW)
    expect(read.viewer?.places.rail.all).toEqual({ state: 'blocked' })
    expect(read.viewer?.places.flights.all).toMatchObject({ state: 'ranked', entry: { rank: 1 } })

    await db
      .prepare(
        "INSERT INTO user_derived_state(user_id,revision,published_revision) VALUES ('walker',2,1)",
      )
      .run()
    const pending = await readLeaderboardBoard(db, 'walker', NOW)
    expect(pending.viewer?.places.flights.all).toMatchObject({
      state: 'pending',
      entry: { rank: 1 },
    })
    expect(pending.boards.flights.all.total).toBe(0)
  } finally {
    await dispose()
  }
})

it('gives each sky row the most-flown drawn aircraft type of its period, else the generic one', async () => {
  const { db, dispose } = await createApiDatabase()
  const flight = (userId: string, date: string, icao: string | null) =>
    db
      .prepare(
        "INSERT INTO flights (user_id,date,origin,destination,aircraft_icao,is_upcoming,lifecycle_state,confirmation_source) VALUES (?,?,?,?,?,0,'logged','legacy')",
      )
      .bind(userId, date, 'JFK', 'LHR', icao)
  try {
    await db.batch([
      ...member(db, { id: 'typed', flights: 6, publication: 'all' }),
      ...member(db, { id: 'odd', flights: 5 }),
      ...member(db, { id: 'untyped', flights: 5 }),
      // All time: two B738 beat one A320. This year: only the A320.
      flight('typed', '2024-05-01', 'b738'),
      flight('typed', '2025-05-01', 'B738'),
      flight('typed', '2026-02-01', 'A320'),
      // A type the lanes do not draw.
      flight('odd', '2026-04-01', 'B739'),
      flight('untyped', '2026-04-01', null),
      ...journey(db, 'typed', 'rail', 'completed', '2026-05-01'),
      ...journey(db, 'typed', 'rail', 'completed', '2026-05-02'),
      ...journey(db, 'typed', 'road', 'completed', '2026-05-03'),
    ])
    await refreshLeaderboards(db, NOW)
    const read = await readLeaderboardBoard(db, null, NOW)
    const aircraft = (period: string) =>
      Object.fromEntries(
        read.boards.flights[period].top.map((entry) => [entry.user_id, entry.aircraft]),
      )
    expect(aircraft('all')).toEqual({ typed: 'B738', odd: 'GENERIC', untyped: 'GENERIC' })
    expect(aircraft('2026')).toMatchObject({ typed: 'A320', odd: 'GENERIC' })
    // Ground rows never carry a type, even for a member who has one in the sky.
    expect(read.boards.rail.all.top).toEqual([
      expect.objectContaining({ user_id: 'typed', aircraft: null }),
    ])
  } finally {
    await dispose()
  }
})

it('runs each ground Countries lane on the mode its member covered more kilometres by, not more journeys', async () => {
  const { db, dispose } = await createApiDatabase()
  const BERLIN: [number, number] = [52.52, 13.405]
  const POTSDAM: [number, number] = [52.39, 13.065]
  const MUNICH: [number, number] = [48.137, 11.575]
  try {
    await db.batch([
      ...member(db, { id: 'trains', publication: 'all' }),
      ...member(db, { id: 'cars', publication: 'all' }),
      ...member(db, { id: 'blank', publication: 'all' }),
      // Two short drives lose to one long train all time; this year only the drives count.
      ...journey(db, 'trains', 'road', 'completed', '2026-03-01', ['DE'], [BERLIN, POTSDAM]),
      ...journey(db, 'trains', 'road', 'completed', '2026-03-02', ['DE'], [POTSDAM, BERLIN]),
      ...journey(db, 'trains', 'rail', 'completed', '2025-03-03', ['DE'], [BERLIN, MUNICH]),
      ...journey(db, 'cars', 'rail', 'completed', '2026-04-01', ['DE'], [BERLIN, POTSDAM]),
      ...journey(db, 'cars', 'rail', 'completed', '2026-04-02', ['DE'], [POTSDAM, BERLIN]),
      ...journey(db, 'cars', 'road', 'completed', '2026-04-03', ['DE'], [BERLIN, MUNICH]),
      // No coordinates anywhere: the car, whatever the journeys.
      ...journey(db, 'blank', 'rail', 'completed', '2026-05-01', ['DE'], [null, BERLIN]),
      ...journey(db, 'blank', 'rail', 'completed', '2026-05-02', ['DE']),
      ...journey(db, 'blank', 'rail', 'completed', '2026-05-03', ['DE']),
    ])
    await refreshLeaderboards(db, NOW)
    const read = await readLeaderboardBoard(db, null, NOW)
    const vehicles = (category: 'ground_countries' | 'rail', period: string) =>
      Object.fromEntries(
        read.boards[category][period].top.map((entry) => [entry.user_id, entry.vehicle]),
      )
    expect(vehicles('ground_countries', 'all')).toEqual({
      trains: 'rail',
      cars: 'road',
      blank: 'road',
    })
    expect(vehicles('ground_countries', '2026')).toMatchObject({ trains: 'road', cars: 'road' })
    // Only ground Countries carries the choice; Trains and Cars draw their own vehicle.
    expect(Object.values(vehicles('rail', 'all'))).toEqual([null, null, null])
  } finally {
    await dispose()
  }
})
