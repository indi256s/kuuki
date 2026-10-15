import { expect, it } from 'vitest'
import { readCountryDetail } from '../api/_services/passport'
import { accountWith, USER, type FixtureFlight } from './country-fixture'

const flight = (
  id: number,
  date: string,
  origin: string,
  destination: string,
  extra: Partial<FixtureFlight> = {},
): FixtureFlight => ({ id, date, origin, destination, state: 'logged', ...extra })

it.each([
  {
    name: 'arrival, domestic flight and departure are one stay despite an archived counter and duplicate rows',
    flights: [
      flight(1, '2025-06-15', 'TBS', 'IST'),
      flight(2, '2025-06-15', 'TBS', 'IST'),
      flight(3, '2025-06-18', 'IST', 'ADB'),
      flight(4, '2025-06-22', 'ADB', 'TBS'),
      flight(5, '2025-06-22', 'ADB', 'TBS'),
    ],
    visits: 1,
  },
  {
    name: 'a departure without its arrival and a later return are separate stays',
    flights: [
      flight(1, '2024-06-22', 'IST', 'TBS'),
      flight(2, '2025-06-15', 'TBS', 'IST'),
      flight(3, '2025-06-22', 'IST', 'TBS'),
      flight(4, '2026-08-16', 'TBS', 'IST'),
      flight(5, '2026-08-16', 'IST', 'TBS'),
    ],
    visits: 3,
  },
  {
    name: 'explicit transit and future flights do not create stays',
    flights: [
      flight(1, '2025-06-15', 'TBS', 'IST', { transit: 1, leg: 2 }),
      flight(2, '2025-06-15', 'IST', 'JFK'),
      flight(3, '2027-06-15', 'TBS', 'IST', { state: 'upcoming' }),
    ],
    visits: 0,
  },
  {
    name: 'an enriched copy of a date-only arrival does not add a stay',
    flights: [
      flight(1, '2025-06-15', 'TBS', 'IST'),
      flight(2, '2025-06-15', 'TBS', 'IST', {
        dep: '2025-06-15T07:00:00.000Z',
        arr: '2025-06-15T10:00:00.000Z',
      }),
    ],
    visits: 1,
  },
  {
    name: 'a second entry after a recorded exit on the same day starts another stay',
    flights: [
      flight(1, '2025-06-15', 'TBS', 'IST'),
      flight(2, '2025-06-15', 'IST', 'TBS'),
      flight(3, '2025-06-15', 'TBS', 'IST'),
    ],
    visits: 2,
  },
  {
    name: 'unknown airports do not establish a departure to another country',
    flights: [flight(1, '2025-06-15', 'IST', 'ZZZ'), flight(2, '2025-06-16', 'ZZZ', 'IST')],
    visits: 1,
  },
  {
    name: 'a non-transit duplicate still establishes a stay',
    flights: [
      flight(1, '2025-06-15', 'TBS', 'IST', { transit: 1, leg: 3 }),
      flight(2, '2025-06-15', 'TBS', 'IST', { transit: 0 }),
      flight(3, '2025-06-15', 'IST', 'JFK'),
    ],
    visits: 1,
  },
  {
    name: 'actual times order same-day visits independently of row ids',
    flights: [
      flight(1, '2025-06-15', 'IST', 'TBS', {
        dep: '2025-06-15T15:00:00.000Z',
        arr: '2025-06-15T18:00:00.000Z',
      }),
      flight(2, '2025-06-15', 'TBS', 'IST', {
        dep: '2025-06-15T07:00:00.000Z',
        arr: '2025-06-15T10:00:00.000Z',
      }),
    ],
    visits: 1,
  },
])('$name', async ({ flights, visits }) => {
  const { db, dispose } = await accountWith(flights, (db) => [
    db
      .prepare(`INSERT INTO legacy_visit_evidence
      (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
      VALUES ('old',?,'IST','TR','2024-06-22','2026-08-16',18,'digest','archive',1,'{}')`)
      .bind(USER.id),
  ])
  try {
    const detail = await readCountryDetail(db, USER.id, 'TR')
    expect(detail.totalVisits).toBe(visits)
    expect(detail.entries).toContainEqual(
      expect.objectContaining({ kind: 'legacy', visitCount: 18 }),
    )
    expect(detail.airports).toContainEqual(expect.objectContaining({ iata: 'IST', visitCount: 18 }))
  } finally {
    await dispose()
  }
})
