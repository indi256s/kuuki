import { expect, it } from 'vitest'
import type { OverviewLabels } from '../labels'
import { chipLabel } from './chip-label'

it('labels the month facet with its localized name and standalone month names', () => {
  const labels = {} as OverviewLabels
  expect(chipLabel('months', [3, 12], labels, 'en')).toEqual({
    name: 'Month',
    values: 'March, December',
    more: 0,
  })
  expect(chipLabel('months', [3, 5, 12], labels, 'ru')).toEqual({
    name: 'Месяц',
    values: 'март, май',
    more: 1,
  })
})
