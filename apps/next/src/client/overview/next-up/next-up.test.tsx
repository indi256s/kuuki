// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Goal } from '@kuuki/shared/overview/goals'
import { NextUp } from './next-up'

const overview = vi.hoisted(() => ({
  locale: 'en',
  aggregate: false,
  ownerKey: 'owner',
  payload: { mode: 'flights' },
  scope: { coverage: { total: 10, typed: 1 } },
}))
vi.mock('../store/overview-context', () => ({ useOverview: () => overview }))
// The hook stays real: it owns when the review is available.
vi.mock('../sections/manufacturers/aircraft-review', async (importActual) => ({
  ...(await importActual<typeof import('../sections/manufacturers/aircraft-review')>()),
  PayloadAircraftReview: () => <button type="button">Add aircraft →</button>,
}))
afterEach(() => {
  cleanup()
  overview.aggregate = false
  overview.scope.coverage.typed = 1
})

const goals: Goal[] = [
  { id: 'unlock:routes', kind: 'unlock', section: 'routes', have: 3, need: 5, unit: 'flights' },
  { id: 'unlock:clock', kind: 'unlock', section: 'clock', have: 2, need: 5, unit: 'times' },
  {
    id: 'unlock:aircraft',
    kind: 'unlock',
    section: 'aircraft',
    have: 1,
    need: 5,
    unit: 'aircraft',
  },
  {
    id: 'milestone:flights:10',
    kind: 'milestone',
    metric: 'flights',
    have: 7,
    need: 10,
  },
]

it('lists each goal as a row with a labelled meter and one action, and no rules between rows', () => {
  const { container } = render(<NextUp goals={goals} />)
  const band = screen.getByRole('region', { name: 'Next up' })
  const rows = within(within(band).getByRole('list')).getAllByRole('listitem')
  expect(rows).toHaveLength(4)
  expect(within(rows[0]).getByText('2 more flights unlock Routes')).toBeInTheDocument()
  expect(within(rows[0]).getByRole('meter', { name: 'Flights: 3 of 5 needed' })).toHaveAttribute(
    'aria-valuenow',
    '3',
  )
  expect(within(rows[0]).getByRole('link', { name: 'Add a flight' })).toHaveAttribute(
    'href',
    '/add',
  )
  expect(
    within(rows[1]).getByText('3 more flights with departure times unlock Clock'),
  ).toBeVisible()
  expect(within(rows[1]).getByRole('link', { name: 'Add times' })).toHaveAttribute(
    'href',
    '/journal',
  )
  expect(within(rows[2]).getByText('4 more flights with an aircraft unlock Aircraft')).toBeVisible()
  expect(within(rows[2]).getByRole('button', { name: 'Add aircraft →' })).toBeVisible()
  expect(within(rows[3]).getByText('7 of 10 flights')).toBeVisible()
  expect(within(rows[3]).getByRole('meter', { name: '7 of 10 flights' })).toBeVisible()
  expect(within(rows[3]).queryByRole('link')).toBeNull()
  expect(container.querySelector('hr')).toBeNull()
})

it('renders nothing without goals', () => {
  const { container } = render(<NextUp goals={[]} />)
  expect(container).toBeEmptyDOMElement()
})

it('offers adding a flight for the aircraft goal when no flight lacks an aircraft or rows are aggregated', () => {
  const aircraft = goals.filter((goal) => goal.id === 'unlock:aircraft')
  overview.scope.coverage.typed = 10
  render(<NextUp goals={aircraft} />)
  expect(screen.queryByRole('button', { name: 'Add aircraft →' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Add a flight' })).toHaveAttribute('href', '/add')
  cleanup()
  overview.scope.coverage.typed = 1
  overview.aggregate = true
  render(<NextUp goals={aircraft} />)
  expect(screen.getByRole('link', { name: 'Add a flight' })).toHaveAttribute('href', '/add')
})
