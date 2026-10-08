import { expect, it } from 'vitest'
import type { OverviewFilter } from '@kuuki/shared/overview/model'
import { referenceLabels } from '../labels'
import { scopeTitle } from './scope-title'

it('uses actual key and value order, two selections then +N without mutating filters', () => {
  const filter: OverviewFilter = { airlines: ['QR', 'TK'], countries: ['JP', 'US'] }
  const before = structuredClone(filter)
  expect(scopeTitle(filter, referenceLabels('en'), 'en')).toBe(' · Qatar Airways, Turkish Airlines +2')
  expect(filter).toEqual(before)
})
it('counts a multi-year period atomically and skips empty facets', () => {
  expect(scopeTitle({ airlines: [], period: { years: [2025, 2016] }, countries: ['JP'], airports: ['IST'] }, referenceLabels('en'), 'en')).toBe(' · Period 2025, 2016, Japan +1')
  expect(scopeTitle({ period: { years: [] }, airlines: [] }, referenceLabels('en'), 'en')).toBe('')
})
it('localizes canonical labels, month ranges and numeric hours with unknown ids as fallback', () => {
  expect(scopeTitle({ countries: ['JP'], regions: ['europe'], airlines: ['LEGACY'] }, referenceLabels('ru'), 'ru')).toBe(' · Япония, Европа +1')
  expect(scopeTitle({ airlines: ['LEGACY'], makers: ['unknown'] }, referenceLabels('ru'), 'ru')).toBe(' · LEGACY, Неизвестно')
  expect(scopeTitle({ period: { from: '2025-01', to: '2025-03' }, depHours: [0] }, referenceLabels('ru'), 'ru')).toBe(' · Период январь 2025 г. – март 2025 г., 00:00')
})
