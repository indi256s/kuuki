import { expect, it } from 'vitest'
import type { OverviewPayload, OverviewRow } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { compareChapters } from './compare-chapters'

const base = fixture as unknown as OverviewPayload
const row = (over: Partial<OverviewRow>): OverviewRow => ({ ...base.rows[0], weight: 1, state: 'logged', ...over })
const payloadOf = (rows: OverviewRow[], mode: OverviewPayload['mode'] = 'flights'): OverviewPayload => ({ ...base, mode, rows })

it('partitions routes across chapters, treats the reverse direction as the same route and ignores upcoming flights', () => {
  const result = compareChapters(payloadOf([
    row({ id: 1, date: '2019-03-01', origin: 'TBS', destination: 'IST', airline: 'TK' }),
    row({ id: 2, date: '2020-03-01', origin: 'IST', destination: 'TBS', airline: 'TK' }),
    row({ id: 3, date: '2019-04-01', origin: 'JFK', destination: 'LHR', airline: 'BA' }),
    row({ id: 4, date: '2020-04-01', origin: 'NRT', destination: 'SFO', airline: null }),
    row({ id: 5, date: '2020-05-01', origin: 'NRT', destination: 'SFO', airline: 'JL', state: 'upcoming' }),
  ]), { period: { years: [2019] } }, { period: { years: [2020] } })
  expect(result.routes).toHaveLength(3)
  expect(result.routes.map(({ key, status, heldCount, currentCount }) => [key, status, heldCount, currentCount])).toEqual(expect.arrayContaining([
    ['IST-TBS', 'shared', 1, 1], ['JFK-LHR', 'absent', 1, 0], ['NRT-SFO', 'added', 0, 1],
  ]))
  const shared = result.routes.find(r => r.key === 'IST-TBS')!
  expect([shared.a, shared.b, shared.flightIds]).toEqual(['IST', 'TBS', { held: [1], current: [2] }])
  expect(result.airlines.find(a => a.code === 'unknown')).toMatchObject({ heldCount: 0, currentCount: 1, currentShare: 0.5 })
})

it('weights aggregate rows, shares unknown distance honestly and exposes no flight ids', () => {
  const result = compareChapters(payloadOf([
    row({ id: 77, weight: 4, distanceKm: 4000, date: '2020-01-01', airline: 'TK', durationSource: 'times' }),
    row({ id: 78, weight: 1, distanceKm: null, date: '2020-02-01', airline: 'BA', durationSource: 'estimate' }),
  ], 'aggregate'), {}, { airlines: ['TK'] })
  expect(result.held).toMatchObject({ flights: 5, distanceKm: 4000, knownDistanceFlights: 4, averageDistanceKm: 1000,
    firstDate: '2020-01-01', lastDate: '2020-02-01' })
  expect(result.current).toMatchObject({ flights: 4, averageDistanceKm: 1000 })
  expect(result.airlines.map(a => [a.code, a.heldShare, a.currentShare])).toEqual(expect.arrayContaining([['TK', 0.8, 1], ['BA', 0.2, 0]]))
  expect(result.routes.flatMap(r => [...r.flightIds.held, ...r.flightIds.current])).toEqual([])
})
