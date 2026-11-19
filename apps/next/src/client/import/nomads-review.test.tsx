// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { draft } from './fixtures'
import { ReviewRow } from './review-row'

it('shows imported cities while airport codes remain unknown', () => {
  const row = draft({
    id: 'nomads-row',
    selected: false,
    fields: {
      date: '2026-03-12',
      origin: '',
      destination: '',
      airline_iata: 'ZZ',
      origin_hint: 'New York, US',
      destination_hint: 'Boston, US',
      review_required: true,
    },
  })
  render(
    <ReviewRow
      locale="en"
      draft={row}
      stored={row}
      mobile={false}
      onChange={vi.fn()}
      onDirty={vi.fn()}
      onRetry={vi.fn()}
      onDiscard={vi.fn()}
    />,
  )
  expect(screen.getByText('New York, US')).toBeVisible()
  expect(screen.getByText('Boston, US')).toBeVisible()
})
