import { expect, it } from 'vitest'
import { favoriteAirline, newCountriesIn, overviewComparison, overviewDelta, NEW_COUNTRY_ITEMS } from '../api/_services/overviewShape'

it('computes deltas with no percentage of a zero baseline and rounds half away from zero', () => {
  expect(overviewDelta(5, 0)).toEqual({ previous: 0, delta: 5, percent: null })
  expect(overviewDelta(0, 0)).toEqual({ previous: 0, delta: 0, percent: null })
  expect(overviewDelta(3, 8)).toEqual({ previous: 8, delta: -5, percent: -63 }) // -62.5
  expect(overviewDelta(1, 8)).toEqual({ previous: 8, delta: -7, percent: -88 }) // -87.5
  expect(overviewDelta(9, 8)).toEqual({ previous: 8, delta: 1, percent: 13 }) // 12.5
  expect(overviewDelta(0, 4)).toEqual({ previous: 4, delta: -4, percent: -100 })
})

it('has no comparison for all time and no country delta while countries are unknown', () => {
  const totals = { flights: 1, distanceKm: 1, durationMinutes: 1, countries: 1 }
  expect(overviewComparison('all', totals, totals, true)).toBeNull()
  expect(overviewComparison('2026', { ...totals, countries: null }, totals, true)?.countries).toBeNull()
  expect(overviewComparison('2026', totals, { ...totals, countries: null }, true)?.countries).toBeNull()
  expect(overviewComparison('2026', totals, totals, false)).toMatchObject({ previousPeriod: '2025', firstYear: true })
})

it('names a favorite airline only from two flights up', () => {
  expect(favoriteAirline([])).toBeNull()
  expect(favoriteAirline([{ id: 'TK', count: 1 }])).toBeNull()
  expect(favoriteAirline([{ id: 'TK', count: 2 }, { id: 'PC', count: 2 }])).toEqual({ id: 'TK', count: 2 })
})

it('orders new countries by first visit then code, bounds the items and keeps the exact count', () => {
  const evidence = Array.from({ length: 20 }, (_, i) => ({ id: `C${String(i).padStart(2, '0')}`, first_visit: '2025-02-01', status: 'pressed' as const }))
  const period = evidence.map(row => ({ id: row.id, visits: 1, pending: false }))
  const result = newCountriesIn('2025', [{ id: 'ZZ', first_visit: '2025-01-05', status: 'pending' }, ...evidence, { id: 'OLD', first_visit: '2024-12-31', status: 'pressed' }],
    [...period, { id: 'ZZ', visits: 1, pending: true }, { id: 'OLD', visits: 3, pending: false }])
  expect(result?.count).toBe(21)
  expect(result?.items).toHaveLength(NEW_COUNTRY_ITEMS)
  expect(result?.items[0]).toEqual({ id: 'ZZ', firstVisit: '2025-01-05', pending: true })
  expect(result?.items[1].id).toBe('C00')
  expect(newCountriesIn('all', evidence, period)).toBeNull()
})
