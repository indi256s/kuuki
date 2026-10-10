// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { Section } from './section'

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))

it('renders the profile headline, figures and a pickable year chart', () => {
  const payload = fixture as OverviewPayload,
    scope = computeOverview(payload, {}),
    setPeriod = vi.fn()
  if (scope.routes.status !== 'ready') throw new Error('Board must satisfy Routes minimum')
  const data = scope.routes.value,
    year = data.byYear.find((row) => row.flights > 0)!.year
  context.current = {
    scope,
    all: scope,
    payload,
    locale: 'en',
    isCurrent: () => true,
    actions: { setPeriod },
  } as unknown as typeof context.current
  render(<Section span="full" />)
  expect(screen.getByText(/^(Explorer|Commuter|Mixed) — /)).toBeInTheDocument()
  expect(screen.getByText('Distinct routes').nextElementSibling).toHaveTextContent(
    String(data.distinct),
  )
  const chart = screen.getByRole('group', { name: 'Flights and new routes per year' })
  const mark = chart.querySelector(`[data-kc-key="${String(year).padStart(4, '0')}"]`)!
  fireEvent.click(mark)
  expect(setPeriod).toHaveBeenCalledExactlyOnceWith({ years: [year] })
})
