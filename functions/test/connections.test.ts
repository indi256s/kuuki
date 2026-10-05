// ADR 0001 §4 connection chains (T08): a deterministic, table-driven calculation with no trips entity.
import { describe, expect, it } from 'vitest'
import { connectionChains, MAX_CONNECTION_GAP_MS, type ConnectionLeg } from '../api/_services/connections'

const COUNTRY: Record<string, string> = {
  TBS: 'GE', KUT: 'GE', IST: 'TR', ADB: 'TR', DXB: 'AE', BKK: 'TH', JFK: 'US', LHR: 'GB',
}

/** `dep`/`arr` are ISO instants; omitted means the time is unknown (date-only estimate). */
function leg(id: number, date: string, origin: string, destination: string, dep?: string, arr?: string): ConnectionLeg {
  return {
    id, date, origin, destination, departure_utc: dep ?? null, arrival_utc: arr ?? null,
    origin_country: COUNTRY[origin] ?? null, destination_country: COUNTRY[destination] ?? null,
  }
}

const HOUR = 3_600_000
const at = (base: string, hours: number) => new Date(Date.parse(base) + hours * HOUR).toISOString()
const T0 = '2026-03-01T22:00:00.000Z'

type Expected = 'none' | { ambiguous: number[] } | { to: number; label: 'precise' | 'estimated'; third: boolean }

const CASES: Array<{ name: string; legs: ConnectionLeg[]; expected: Record<number, Expected> }> = [
  {
    name: 'overnight precise connection: label dates differ, UTC gap is 10.5h',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', '2026-03-01T18:00:00.000Z', '2026-03-01T23:30:00.000Z'),
      leg(2, '2026-03-02', 'IST', 'JFK', '2026-03-02T10:00:00.000Z', '2026-03-02T22:00:00.000Z')],
    expected: { 1: { to: 2, label: 'precise', third: true }, 2: 'none' },
  },
  {
    name: 'UTC gap: the departure label precedes the arrival label, but the instants are 4h apart',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', '2026-03-01T22:00:00.000Z', '2026-03-02T01:00:00.000Z'),
      leg(2, '2026-03-01', 'IST', 'JFK', '2026-03-02T05:00:00.000Z', '2026-03-02T16:00:00.000Z')],
    expected: { 1: { to: 2, label: 'precise', third: true }, 2: 'none' },
  },
  {
    name: 'a gap of exactly 24 hours is a connection',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0), leg(2, '2026-03-02', 'IST', 'JFK', at(T0, 24), at(T0, 34))],
    expected: { 1: { to: 2, label: 'precise', third: true }, 2: 'none' },
  },
  {
    name: 'a gap of 24 hours and one millisecond is not',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0),
      leg(2, '2026-03-02', 'IST', 'JFK', new Date(Date.parse(T0) + MAX_CONNECTION_GAP_MS + 1).toISOString(), at(T0, 34))],
    expected: { 1: 'none', 2: 'none' },
  },
  {
    name: 'a longer gap is not a connection',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0), leg(2, '2026-03-03', 'IST', 'JFK', at(T0, 36), at(T0, 46))],
    expected: { 1: 'none', 2: 'none' },
  },
  {
    name: 'departing before arrival is not a connection',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0), leg(2, '2026-03-01', 'IST', 'JFK', at(T0, -1), at(T0, 8))],
    expected: { 1: 'none', 2: 'none' },
  },
  {
    name: 'two precise onward legs are ambiguous for the incoming leg',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0),
      leg(2, '2026-03-02', 'IST', 'JFK', at(T0, 3), at(T0, 12)), leg(3, '2026-03-02', 'IST', 'LHR', at(T0, 5), at(T0, 9))],
    expected: { 1: { ambiguous: [2, 3] }, 2: 'none', 3: 'none' },
  },
  {
    name: 'two incoming legs competing for one onward leg are both ambiguous',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0), leg(2, '2026-03-01', 'KUT', 'IST', at(T0, -3), at(T0, 1)),
      leg(3, '2026-03-02', 'IST', 'JFK', at(T0, 5), at(T0, 14))],
    expected: { 1: { ambiguous: [3] }, 2: { ambiguous: [3] }, 3: 'none' },
  },
  {
    name: 'a precise candidate outranks an estimated one',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0), leg(2, '2026-03-02', 'IST', 'JFK', at(T0, 4), at(T0, 13)),
      leg(3, '2026-03-02', 'IST', 'LHR')],
    expected: { 1: { to: 2, label: 'precise', third: true }, 2: 'none', 3: 'none' },
  },
  {
    name: 'date-only same-day match is an estimated link',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST'), leg(2, '2026-03-01', 'IST', 'JFK')],
    expected: { 1: { to: 2, label: 'estimated', third: true }, 2: 'none' },
  },
  {
    name: 'date-only next-day match is an estimated link, a missing single instant still estimates',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0), leg(2, '2026-03-02', 'IST', 'JFK')],
    expected: { 1: { to: 2, label: 'estimated', third: true }, 2: 'none' },
  },
  {
    name: 'date-only two days apart is not a link',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST'), leg(2, '2026-03-03', 'IST', 'JFK')],
    expected: { 1: 'none', 2: 'none' },
  },
  {
    name: 'ambiguous legs on the same date are review-only',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST'), leg(2, '2026-03-01', 'IST', 'JFK'), leg(3, '2026-03-01', 'IST', 'LHR')],
    expected: { 1: { ambiguous: [2, 3] }, 2: 'none', 3: 'none' },
  },
  {
    name: 'an opposite date-only pair on one date cannot be ordered, so it is ambiguous both ways',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST'), leg(2, '2026-03-01', 'IST', 'TBS')],
    expected: { 1: { ambiguous: [2] }, 2: { ambiguous: [1] } },
  },
  {
    name: 'repeated airports form one chain whose hubs equal its endpoints',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0), leg(2, '2026-03-02', 'IST', 'TBS', at(T0, 3), at(T0, 8)),
      leg(3, '2026-03-02', 'TBS', 'IST', at(T0, 10), at(T0, 14))],
    expected: { 1: { to: 2, label: 'precise', third: false }, 2: { to: 3, label: 'precise', third: false }, 3: 'none' },
  },
  {
    name: 'a round trip through a third country suppresses that hub',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0), leg(2, '2026-03-02', 'IST', 'TBS', at(T0, 5), at(T0, 10))],
    expected: { 1: { to: 2, label: 'precise', third: true }, 2: 'none' },
  },
  {
    name: 'a hub in the start country is not a third-country candidate',
    legs: [leg(1, '2026-03-01', 'TBS', 'KUT', at(T0, -4), T0), leg(2, '2026-03-02', 'KUT', 'IST', at(T0, 3), at(T0, 8))],
    expected: { 1: { to: 2, label: 'precise', third: false }, 2: 'none' },
  },
  {
    name: 'a hub in the final country is not a third-country candidate',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0), leg(2, '2026-03-02', 'IST', 'ADB', at(T0, 3), at(T0, 5))],
    expected: { 1: { to: 2, label: 'precise', third: false }, 2: 'none' },
  },
  {
    name: 'a three-leg chain evaluates every hub against the chain endpoints',
    legs: [leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0), leg(2, '2026-03-02', 'IST', 'DXB', at(T0, 3), at(T0, 8)),
      leg(3, '2026-03-02', 'DXB', 'BKK', at(T0, 12), at(T0, 20))],
    expected: { 1: { to: 2, label: 'precise', third: true }, 2: { to: 3, label: 'precise', third: true }, 3: 'none' },
  },
]

describe('connectionChains', () => {
  for (const { name, legs, expected } of CASES) {
    it(name, () => {
      const decisions = connectionChains(legs)
      for (const [id, want] of Object.entries(expected)) {
        const got = decisions.get(Number(id))
        if (want === 'none') expect(got, `leg ${id}`).toEqual({ kind: 'none' })
        else if ('ambiguous' in want) expect(got, `leg ${id}`).toEqual({ kind: 'ambiguous', candidateIds: want.ambiguous })
        else expect(got, `leg ${id}`).toMatchObject({ kind: 'link', toId: want.to, label: want.label, thirdCountry: want.third })
      }
    })

    it(`${name}: is independent of input order`, () => {
      const forward = connectionChains(legs)
      const reversed = connectionChains([...legs].reverse())
      expect([...reversed.entries()].sort(([a], [b]) => a - b)).toEqual([...forward.entries()].sort(([a], [b]) => a - b))
    })
  }

  it('reports the chain endpoints and members on each link', () => {
    const decisions = connectionChains([
      leg(1, '2026-03-01', 'TBS', 'IST', at(T0, -4), T0), leg(2, '2026-03-02', 'IST', 'DXB', at(T0, 3), at(T0, 8)),
      leg(3, '2026-03-02', 'DXB', 'BKK', at(T0, 12), at(T0, 20)),
    ])
    expect(decisions.get(2)).toMatchObject({ kind: 'link', hubCountry: 'AE', startCountry: 'GE', finalCountry: 'TH', chainIds: [1, 2, 3] })
  })

  it('treats an unparseable instant as missing and never reads a date label as an instant', () => {
    const decisions = connectionChains([
      leg(1, '2026-03-01', 'TBS', 'IST', 'garbage', 'also garbage'), leg(2, '2026-03-02', 'IST', 'JFK', 'nope'),
    ])
    expect(decisions.get(1)).toMatchObject({ kind: 'link', label: 'estimated' })
  })

  it('stays linear enough for a long hub history', () => {
    const legs: ConnectionLeg[] = []
    for (let i = 0; i < 2000; i += 1) {
      const day = new Date(Date.UTC(2020, 0, 1 + i * 3)).toISOString().slice(0, 10)
      legs.push(leg(2 * i + 1, day, 'TBS', 'IST'), leg(2 * i + 2, day, 'IST', 'TBS'))
    }
    const started = Date.now()
    connectionChains(legs)
    expect(Date.now() - started).toBeLessThan(2000)
  })
})
