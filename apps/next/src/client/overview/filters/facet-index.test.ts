import { expect, it } from 'vitest'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { referenceLabels } from '../labels'
import { buildFacetIndex } from './facet-index'

it('lists only flown months in calendar order with localized labels', () => {
  const payload = fixture as unknown as OverviewPayload
  const months = buildFacetIndex(payload, referenceLabels('en', payload.refs), 'en').filter(
    (option) => option.facet === 'months',
  )
  expect(months.map((option) => option.value)).toEqual(
    [...new Set(payload.rows.map((row) => Number(row.date.slice(5, 7))))]
      .sort((a, b) => a - b)
      .map(String),
  )
  expect(months[0]).toMatchObject({ value: '1', label: 'January' })
})
