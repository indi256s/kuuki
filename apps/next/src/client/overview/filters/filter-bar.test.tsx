// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import type { OverviewGroundJourney, OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS, type OverviewPrefs } from '@kuuki/shared/overview/prefs'
import { OverviewProvider, useOverview } from '../store/overview-context'
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
    </OverviewProvider>,
  )
afterEach(cleanup)

it('hides the scope segment without ground data, even when a scope is stored', () => {
  mount(noGround, { scope: 'ground' })
  expect(screen.queryByRole('radiogroup', { name: 'Travel scope' })).toBeNull()
  expect(screen.getByText('All flights, all time')).toBeTruthy()
})

it('shows the segment with ground data and writes or removes filter.scope', async () => {
  const user = userEvent.setup()
  mount(withGround, {})
  expect(screen.getByRole('radiogroup', { name: 'Travel scope' })).toBeTruthy()
  expect(screen.getByText('All travel, all time')).toBeTruthy()
  await user.click(screen.getByRole('radio', { name: 'Ground' }))
  expect(screen.getByLabelText('Active filters')).toHaveTextContent('{"scope":"ground"}')
  expect(screen.getByText('All ground trips, all time')).toBeTruthy()
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
