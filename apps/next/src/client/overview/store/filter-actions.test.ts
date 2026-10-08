import { expect, it } from 'vitest'
import type { OverviewFilter } from '@kuuki/shared/overview/model'
import { addValue, removeValue, removeFacet, setPeriod, clearAll, removeLast } from './filter-actions'

it('removeLast removes the newest value and removes period atomically', () => {
  const original: OverviewFilter = { airlines: ['TK', 'QR'], countries: ['JP'] }
  const first = removeLast(original)
  expect(first).toEqual({ airlines: ['TK', 'QR'] })
  expect(removeLast(first)).toEqual({ airlines: ['TK'] })
  expect(original).toEqual({ airlines: ['TK', 'QR'], countries: ['JP'] })
  expect(removeLast({ ...original, period: { years: [2025, 2026] } })).toEqual(original)
  expect(removeLast({})).toEqual({})
})
it('removing the last value deletes the facet; additions are typed immutable and deduplicated', () => {
  const original: OverviewFilter = { depHours: [0], airlines: ['TK'] }
  expect(removeValue(original, 'depHours', 0)).toEqual({ airlines: ['TK'] })
  expect(addValue(original, 'depHours', 0)).toBe(original)
  const next = addValue(original, 'depHours', 23)
  expect(next.depHours).toEqual([0, 23])
  expect(original.depHours).toEqual([0])
  expect(removeValue(original, 'depHours', 6)).toBe(original)
  expect(removeFacet(original, 'airlines')).toEqual({ depHours: [0] })
})
it('removeLast skips empty persisted facets and keeps the original filter intact', () => {
  for (const empty of [{ countries: [] }, { period: { years: [] } }] satisfies OverviewFilter[]) {
    const original: OverviewFilter = { airlines: ['TK', 'QR'], ...empty }
    expect(removeLast(original)).toEqual({ airlines: ['TK'], ...empty })
    expect(original).toEqual({ airlines: ['TK', 'QR'], ...empty })
    const onlyEmpty: OverviewFilter = { ...empty }
    expect(removeLast(onlyEmpty)).toBe(onlyEmpty)
  }
})
it('reinserted facets become newest and period clearing preserves the other keys', () => {
  const first = { airlines: ['TK'], countries: ['JP'] }
  const next = addValue(removeFacet(first, 'airlines'), 'airlines', 'QR')
  expect(Object.keys(next)).toEqual(['countries', 'airlines'])
  expect(removeLast(next)).toEqual({ countries: ['JP'] })
  expect(setPeriod(setPeriod(next, { from: '2025-01', to: '2026-01' }), null)).toEqual(next)
  expect(clearAll()).toEqual({})
})
