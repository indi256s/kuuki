// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { Section } from './section'

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))
vi.mock('../../store/open-flight', () => ({ useOpenFlight: () => vi.fn() }))

const payload = fixture as OverviewPayload
const admit = (filter: OverviewFilter = {}) => {
  const actions = { add: vi.fn(), clear: vi.fn() }
  context.current = {
    payload,
    scope: computeOverview(payload, filter),
    filter,
    locale: 'en',
    aggregate: false,
    ownerKey: 'owner',
    actions,
    bus: { setFocusRoute: vi.fn() },
    isCurrent: () => true,
  } as unknown as typeof context.current
  return actions
}
const pick = (route: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${route},`) }))

afterEach(() => vi.useRealTimers())

it('a pick moves the hero to that route and does not filter', () => {
  const actions = admit()
  const { container } = render(<Section span="full" />)
  const value = () => container.querySelector('.ov3-card-value-text')
  expect(value()).toHaveTextContent('14,535')
  expect(screen.queryByRole('button', { name: /^Only/ })).toBeNull()
  pick('NRT → DOH')
  expect(value()).toHaveTextContent('8,207')
  expect(container.querySelector('.ov3-card-caption')).toHaveTextContent(
    '2nd longest · NRT → DOH · 1 flight',
  )
  expect(actions.add).not.toHaveBeenCalled()
})

it('"Only …" filters by the undirected route of the picked record', () => {
  const actions = admit()
  render(<Section span="full" />)
  pick('NRT → DOH')
  fireEvent.click(screen.getByRole('button', { name: 'Only NRT → DOH' }))
  expect(actions.add).toHaveBeenCalledWith('routes', 'DOH-NRT')
})

it('re-pins the map on a pick: the old pins sink, the route swaps, the new pins rise', () => {
  vi.useFakeTimers()
  admit()
  const { container } = render(<Section span="full" />)
  const codes = () =>
    Array.from(container.querySelectorAll('.iso-map-pick [data-part="pin"] text')).map(
      (text) => text.textContent,
    )
  const host = () => container.querySelector('.iso-map-host')
  expect(codes()).toEqual(['DOH', 'AKL'])
  expect(host()).not.toHaveAttribute('data-pins')
  pick('NRT → DOH')
  expect(host()).toHaveAttribute('data-pins', 'down')
  expect(codes()).toEqual(['DOH', 'AKL'])
  pick('JFK → LHR')
  act(() => void vi.advanceTimersByTime(120))
  expect(codes()).toEqual(['JFK', 'LHR'])
  expect(host()).not.toHaveAttribute('data-pins')
})

it('below the gate under a filter, the card says so and offers to clear it', () => {
  const actions = admit({ airlines: ['ZZ'] })
  render(<Section span="full" />)
  expect(screen.getByRole('heading', { name: 'No records to show' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
  expect(actions.clear).toHaveBeenCalled()
})
