// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { TravelPatterns } from './travel-patterns'

const add = vi.fn()
vi.mock('../../store/overview-context', () => ({
  useOverview: () => ({ locale: 'en', actions: { add }, isCurrent: () => true }),
}))
vi.mock('../manufacturers/aircraft-review', () => ({ PayloadAircraftReview: () => null }))

beforeEach(() => add.mockClear())

it('inspects without filtering and uses the whole journal denominator in expanded evidence', () => {
  render(
    <TravelPatterns
      filtered
      patterns={[
        {
          id: 'daytime',
          total: 4,
          categories: [
            { key: 'day', count: 1 },
            { key: 'night', count: 1 },
            { key: 'unknown', count: 2 },
          ],
        },
      ]}
      baseline={[
        {
          id: 'daytime',
          total: 10,
          categories: [
            { key: 'day', count: 7 },
            { key: 'night', count: 1 },
            { key: 'unknown', count: 2 },
          ],
        },
      ]}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Day departures: 1 flight · 25%' }))
  expect(add).not.toHaveBeenCalled()
  const table = screen.getByRole('table')
  expect(within(table).getByRole('columnheader', { name: 'Whole lifetime journal' })).toBeVisible()
  expect(within(table).getByText('7 · 70%')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Filter Overview' }))
  expect(add.mock.calls).toEqual([
    ['departureBands', 'morning'],
    ['departureBands', 'afternoon'],
    ['departureBands', 'evening'],
  ])
})

it('offers a filter after keyboard inspection without repeating unfiltered legend numbers', async () => {
  const user = userEvent.setup()
  const patterns = [
    {
      id: 'haul' as const,
      total: 4,
      categories: [
        { key: 'long', count: 1 },
        { key: 'short-medium', count: 3 },
      ],
    },
  ]
  const { container } = render(
    <TravelPatterns filtered={false} patterns={patterns} baseline={patterns} />,
  )
  expect(container.querySelector('details')).toBeNull()
  const segment = screen.getByRole('button', { name: 'Long haul: 1 flight · 25%' })
  segment.focus()
  await user.keyboard('{Enter}')
  expect(add).not.toHaveBeenCalled()
  expect(segment).toHaveAttribute('aria-pressed', 'true')
  expect(container.querySelector('details')).toHaveAttribute('open')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(/^Long haul$/)
  expect(screen.getByText('1 · 25%')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Filter Overview' }))
  expect(add).toHaveBeenCalledWith('haul', 'long')
})
