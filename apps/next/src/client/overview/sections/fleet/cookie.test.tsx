// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { OverviewProvider, useOverview } from '../../store/overview-context'
import { Tile } from '../aircraft/tile'
import { FleetContent } from './section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(cleanup)

function Filter() {
  const { filter } = useOverview()
  return <output aria-label="Aircraft filter">{filter.aircraft?.join(', ') ?? 'none'}</output>
}

it('shows exact aircraft counts and filters the selected ICAO type rather than its family', async () => {
  const payload: OverviewPayload = {
    ...(fixture as OverviewPayload),
    rows: fixture.rows.map((row, i) => ({
      ...row,
      aircraft: i < 6 ? 'A320' : 'A321',
      durationMinutes: null,
    })) as OverviewPayload['rows'],
    refs: {
      ...fixture.refs,
      aircraft: {
        A320: { manufacturer: 'Airbus', type: 'narrowbody', family: 'A320', name: 'Airbus A320' },
        A321: { manufacturer: 'Airbus', type: 'narrowbody', family: 'A320', name: 'Airbus A321' },
      },
    },
  }
  render(
    <OverviewProvider
      payload={payload}
      prefs={DEFAULT_PREFS}
      ownerKey="fleet-test"
      locale="en"
      live={false}
    >
      <div aria-label="Fleet tile" role="group">
        <Tile />
      </div>
      <FleetContent span="full" />
      <Filter />
    </OverviewProvider>,
  )
  const tile = within(screen.getByRole('group', { name: 'Fleet tile' }))
  expect(tile.getByText('A320 ×6')).toBeInTheDocument()
  expect(tile.getByText('Most flown · 2 types')).toBeInTheDocument()
  expect(screen.getAllByText('A320 ×6')).toHaveLength(2)
  const button = screen.getByRole('button', { name: 'Add filter · Airbus A321 · A321 · 4 flights' })
  expect(button).toHaveAttribute('type', 'button')
  await userEvent.click(button)
  expect(screen.getByRole('status', { name: 'Aircraft filter' })).toHaveTextContent('A321')
})
