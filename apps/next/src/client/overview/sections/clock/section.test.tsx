// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { Section } from './section'

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))

const add = vi.fn(),
  clear = vi.fn()
const admit = (filter: OverviewFilter = {}, arrMinutes: (number | null)[] = []) => {
  const payload = structuredClone(fixture) as OverviewPayload
  payload.rows = [365, 370, 375, 378, 380, 1385].map((depMinute, i) => ({
    ...payload.rows[0],
    id: i + 1,
    weight: 1,
    state: 'logged',
    origin: 'IST',
    destination: ['CDG', 'LHR', 'CDG', 'LHR', 'FRA', 'NRT'][i],
    date: '2025-01-03',
    depMinute,
    arrMinute: arrMinutes[i] ?? null,
  }))
  context.current = {
    scope: computeOverview(payload, filter),
    all: computeOverview(payload, {}),
    filter,
    locale: 'en',
    actions: { add, clear },
    isCurrent: () => true,
  } as unknown as typeof context.current
}
const hero = (view: { container: HTMLElement }) =>
  view.container.querySelector('.ov3-card-value-text')

beforeEach(() => {
  add.mockClear()
  clear.mockClear()
  admit()
})
afterEach(cleanup)

it('a pick on the chart moves the hero and the display and does not filter', () => {
  const view = render(<Section span="full" />)
  expect(hero(view)).toHaveTextContent('06:05')
  expect(screen.queryByRole('button', { name: /^Only/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^23:00–23:59/ }))
  expect(hero(view)).toHaveTextContent('23:00')
  expect(view.container.querySelector('.ov3-card-caption')).toHaveTextContent(
    '1 departure, 0 arrivals',
  )
  expect(view.container.querySelector('.ov3-clock-figure')).toHaveAttribute('data-side', 'b')
  expect(add).not.toHaveBeenCalled()
})

it('"Only …" applies the departure hour facet', () => {
  render(<Section span="full" />)
  fireEvent.click(screen.getByRole('button', { name: /^23:00–23:59/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Only 23:00' }))
  expect(add).toHaveBeenCalledWith('depHours', 23)
})

it('an hour with arrivals only can be picked and "Only …" applies the arrival hour', () => {
  admit({}, [null, null, null, null, null, 9 * 60 + 10])
  const view = render(<Section span="full" />)
  fireEvent.click(screen.getByRole('button', { name: /^09:00–09:59 · 0 departures, 1 arrival/ }))
  expect(hero(view)).toHaveTextContent('09:00')
  expect(view.container.querySelector('.ov3-card-caption')).toHaveTextContent(
    '0 departures, 1 arrival',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Only 09:00' }))
  expect(add).toHaveBeenCalledWith('arrHours', 9)
})

it('the figure button steps earliest, latest, busiest hour and back', () => {
  const view = render(<Section span="full" />)
  const next = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Show next clock reading' }))
  next()
  expect(hero(view)).toHaveTextContent('23:05')
  expect(view.container.querySelector('.ov3-card-caption')).toHaveTextContent(
    'Latest departure · IST → NRT · busiest hour 06:00',
  )
  next()
  expect(hero(view)).toHaveTextContent('06:00')
  expect(view.container.querySelector('.ov3-card-caption')).toHaveTextContent(
    'Busiest hour · 5 departures, 0 arrivals',
  )
  next()
  expect(hero(view)).toHaveTextContent('06:05')
})

it('shows the empty state when the filter leaves too few timed flights', () => {
  admit({ depHours: [23] })
  render(<Section span="full" />)
  expect(screen.getByText('Too few departure times')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
  expect(clear).toHaveBeenCalled()
})
