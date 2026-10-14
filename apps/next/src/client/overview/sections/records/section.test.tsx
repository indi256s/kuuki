// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { Section } from './section'

const context = vi.hoisted(() => ({
  openFlight: vi.fn(),
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))
vi.mock('../../store/open-flight', () => ({ useOpenFlight: () => context.openFlight }))

const payload = fixture as OverviewPayload
const admit = (filter: OverviewFilter = {}) => {
  const actions = { add: vi.fn(), clear: vi.fn(), setPeriod: vi.fn() }
  context.current = {
    payload,
    scope: computeOverview(payload, filter),
    all: computeOverview(payload, {}),
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
  expect(screen.getByRole('heading', { name: 'Records' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
  expect(actions.clear).toHaveBeenCalled()
})

it('keeps sparse filtered facts with lifetime evidence and opens the witness explicitly', () => {
  const actions = admit({ routes: ['KUT-TBS'] })
  context.openFlight.mockClear()
  const { container } = render(<Section span="full" />)
  expect(screen.getAllByText('Shortest flight').length).toBeGreaterThan(0)
  expect(screen.getByText('No distance range in this selection.')).toBeInTheDocument()
  expect(container.querySelector('.ov3-record-months')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Record cabinet' }))
  fireEvent.click(screen.getByRole('button', { name: 'Flight evidence' }))
  expect(screen.getAllByText(/Whole journal: 187–14,535 km/).length).toBeGreaterThan(0)
  expect(actions.add).not.toHaveBeenCalled()
  const shortest = container.querySelector(
    '.ov3-record-small-grid .ov3-record-inset',
  ) as HTMLElement
  fireEvent.click(within(shortest).getByRole('button', { name: 'Open flight ↗' }))
  expect(context.openFlight).toHaveBeenCalledWith(17)
  expect(actions.add).not.toHaveBeenCalled()
})

it('retains year and duration evidence when no selected flight has known distance', () => {
  admit()
  const unknownDistance = {
    ...payload,
    rows: payload.rows.map((row) => ({ ...row, distanceKm: null })),
  }
  context.current = {
    ...context.current,
    payload: unknownDistance,
    scope: computeOverview(unknownDistance, {}),
  }
  render(<Section span="full" />)
  expect(screen.getByText('Distance unknown')).toBeInTheDocument()
  expect(screen.getAllByText('Busiest year').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Record cabinet' }))
  fireEvent.click(screen.getByRole('button', { name: 'Duration evidence' }))
  expect(screen.getByText('Longest time in the air')).toBeInTheDocument()
  expect(screen.getByText('Shortest time in the air')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Clear filter' })).toBeNull()
})
