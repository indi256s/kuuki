import { expect, it } from 'vitest'
import { previousPeriod } from './filter'

it('exact-day comparison preserves facets and equal inclusive spans across leap days and early years', () => {
  expect(previousPeriod({ period: { from: '2024-03-01', to: '2024-03-02' }, countries: ['JP'] })).toEqual({ period: { from: '2024-02-28', to: '2024-02-29' }, countries: ['JP'] })
  expect(previousPeriod({ period: { from: '0099-01-01', to: '0099-01-01' } })).toEqual({ period: { from: '0098-12-31', to: '0098-12-31' } })
  expect(previousPeriod({ period: { from: '0000-01-01', to: '0000-01-01' } })).toBeNull()
})
