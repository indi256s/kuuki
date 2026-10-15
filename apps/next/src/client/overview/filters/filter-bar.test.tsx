// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import type { OverviewGroundJourney, OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS, type OverviewPrefs } from '@kuuki/shared/overview/prefs'
import { OverviewProvider, useOverview } from '../store/overview-context'
import { ZeroResult } from '../page/page-states'
import { FilterBar } from './filter-bar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/overview',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
const journey: OverviewGroundJourney = {
  id: 'g1',
  mode: 'rail',
  status: 'completed',
  startDate: '2024-05-01',
  endDate: null,
  runs: [
    [
      [13.4, 52.5],
      [11.6, 48.1],
    ],
  ],
  countries: ['DE'],
  distanceKm: 500,
}
const withGround = { ...fixture, ground: [journey] } as OverviewPayload
const noGround = { ...fixture, ground: [] } as OverviewPayload
function Filter() {
  const { filter } = useOverview()
  return <output aria-label="Active filters">{JSON.stringify(filter)}</output>
}
const mount = (payload: OverviewPayload, filter: OverviewPrefs['filter']) =>
  render(
    <OverviewProvider
      payload={payload}
      prefs={{ ...structuredClone(DEFAULT_PREFS), filter }}
      ownerKey="owner"
      locale="en"
      saver={async (prefs) => prefs}
      live={false}
    >
      <FilterBar />
      <Filter />
      <ZeroResult />
    </OverviewProvider>,
  )
afterEach(cleanup)

it('hides the scope segment without ground data, even when a scope is stored', () => {
  mount(noGround, { scope: 'ground' })
  expect(screen.queryByRole('radiogroup', { name: 'Travel scope' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Period: All time' })).toHaveTextContent('All time')
})

it('shows the segment with ground data and writes or removes filter.scope', async () => {
  const user = userEvent.setup()
  mount(withGround, {})
  expect(screen.getByRole('radiogroup', { name: 'Travel scope' })).toBeTruthy()
  await user.click(screen.getByRole('radio', { name: 'Ground' }))
  expect(screen.getByLabelText('Active filters')).toHaveTextContent('{"scope":"ground"}')
  await user.click(screen.getByRole('radio', { name: 'All' }))
  expect(screen.getByLabelText('Active filters')).toHaveTextContent('{}')
})

it('explains under Ground that a flight facet leaves ground trips out', () => {
  mount(withGround, { scope: 'ground', airlines: ['BA'] })
  expect(screen.getByText('Flight filters leave out ground trips')).toBeTruthy()
  cleanup()
  mount(withGround, { scope: 'ground', countries: ['DE'] })
  expect(screen.queryByText('Flight filters leave out ground trips')).toBeNull()
})

it('names the period on its button and keeps it out of the chip row', () => {
  mount(withGround, { period: { years: [2022, 2023, 2024] } })
  expect(screen.getByRole('button', { name: 'Period: 2022–2024' })).toHaveTextContent('2022–2024')
  expect(document.querySelector('[data-filter-chip="period"]')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull()
})

it('removes one chip at a time and offers Clear all once several conditions apply', async () => {
  const user = userEvent.setup()
  mount(withGround, { scope: 'flights', period: { years: [2024] }, airlines: ['BA'] })
  await user.click(screen.getByRole('button', { name: 'Clear all' }))
  // Clear all resets facets and period; the page-level scope stays.
  expect(screen.getByLabelText('Active filters')).toHaveTextContent('{"scope":"flights"}')
  expect(screen.getByRole('button', { name: /^Filter$/ })).toHaveFocus()
  cleanup()
  mount(withGround, { airlines: ['BA'], countries: ['GB'] })
  const bar = () => within(screen.getByRole('group', { name: 'Overview filters' }))
  const removals = bar().getAllByRole('button', { name: /^Remove / })
  expect(removals).toHaveLength(2)
  await user.click(removals[0])
  expect(bar().getAllByRole('button', { name: /^Remove / })).toHaveLength(1)
  expect(bar().getByRole('button', { name: /^Remove / })).toHaveFocus()
})
