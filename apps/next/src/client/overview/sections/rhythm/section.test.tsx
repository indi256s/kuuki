// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import { aggregateRows } from '@kuuki/shared/overview/aggregate'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { Section } from './section'

// Queries scoped to the card's bands: whole-card role queries walk every Details node and are slow in jsdom.
const stage = () => within(document.querySelector('.ov3-card-chart') as HTMLElement)
const top = () => within(document.querySelector('.ov3-card-top') as HTMLElement)

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))
vi.mock('../../store/open-flight', () => ({ useOpenFlight: () => vi.fn() }))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const add = vi.fn(),
  clear = vi.fn()
function admit(payload: OverviewPayload, ownerKey = 'owner-a', filter: OverviewFilter = {}) {
  const setPeriod = vi.fn()
  add.mockClear()
  clear.mockClear()
  context.current = {
    payload,
    scope: computeOverview(payload, filter),
    all: computeOverview(payload, {}),
    filter,
    aggregate: payload.mode === 'aggregate',
    ownerKey,
    locale: 'en',
    actions: { setPeriod, add, clear },
    isCurrent: () => true,
  } as unknown as typeof context.current
  return setPeriod
}
const open = (name: string) => {
  const details = screen.getByRole('button', { name: 'Peaks and gaps' })
  if (details.getAttribute('aria-expanded') === 'false') fireEvent.click(details)
  fireEvent.click(screen.getByRole('button', { name }))
}
const hero = (view: { container: HTMLElement }) =>
  view.container.querySelector('.ov3-card-value-text')
// Ten flights, one a month through 2020, plus two more Marches: March is the busiest month and 2020 the busiest year.
function marches() {
  const payload = structuredClone(fixture) as OverviewPayload
  const march = payload.rows[2]
  payload.rows.push(
    { ...march, id: 11, date: '2021-03-10' },
    { ...march, id: 12, date: '2022-03-15' },
  )
  return payload
}

it('daily activity uses actual weighted leap-day evidence, applies an exact day, and withholds legacy monthly detail', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const payload = structuredClone(fixture) as OverviewPayload
  const source = payload.rows[1]
  payload.rows = [
    { ...source, id: 1, date: '2024-02-29', weight: 2 },
    { ...source, id: 2, date: '2024-02-29', weight: 3 },
    { ...source, id: 3, date: '2024-03-01', state: 'awaiting', weight: 7 },
  ]
  const compact = {
    ...payload,
    mode: 'aggregate' as const,
    aggregateResolution: 'day' as const,
    rows: aggregateRows(payload.rows, 'day'),
  }
  const setPeriod = admit(compact)
  const view = render(<Section span="full" />)
  open('Daily activity')
  const calendar = screen.getByRole('group', { name: 'Completed flights by day · 2024' })
  const leap = calendar.querySelector('[data-kc-key="2024-02-29"]')!
  expect(leap).toHaveAttribute('aria-label', expect.stringContaining('5'))
  expect(calendar.querySelectorAll('[data-kc-key]')).toHaveLength(366)
  expect(calendar.querySelector('[data-kc-key="2024-03-01"]')).toHaveAttribute(
    'aria-label',
    expect.stringContaining('0'),
  )
  fireEvent.click(leap)
  expect(setPeriod).toHaveBeenLastCalledWith({ from: '2024-02-29', to: '2024-02-29' })
  admit({ ...payload, mode: 'aggregate', rows: aggregateRows(payload.rows) })
  view.rerender(<Section span="full" />)
  expect(screen.queryByRole('group', { name: /Completed flights by day/ })).toBeNull()
  expect(screen.getByText('Monthly data only.')).toBeInTheDocument()
})

// It renders two full-year grids in two languages: about 1s locally and 2.6s on Workers Builds, which once took 5.8s.
it('names the daily scale and the monthly base in both languages, and tells a known zero from a day with no data', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const payload = structuredClone(fixture) as OverviewPayload
  // The journal starts mid-January, so the first days of the year fall before it.
  payload.rows[0].date = '2020-01-10'
  admit(payload)
  const view = render(<Section span="full" />)
  open('Daily activity')
  open('Year by month')
  expect(screen.getByText('Completed flights per day')).toBeInTheDocument()
  for (const label of ['0', '1', '2', '3', '4+'])
    expect(screen.getAllByText(label).length).toBeGreaterThan(0)
  expect(screen.getByText('No data (before the journal or after today)')).toBeInTheDocument()
  expect(screen.getByText(/^Share of busiest month: \d+ flights?$/)).toBeInTheDocument()
  const calendar = screen.getByRole('group', { name: /^Completed flights by day/ })
  const days = [...calendar.querySelectorAll('[data-kc-key]')]
  const before = days[0].getAttribute('aria-label')!
  expect(before).toContain('no data')
  expect(days.some((day) => /· 0$/.test(day.getAttribute('aria-label')!))).toBe(true)
  context.current = { ...context.current, locale: 'ru' }
  view.rerender(<Section span="full" />)
  expect(screen.getByText('Завершённых перелётов в день')).toBeInTheDocument()
  expect(screen.getByText(/^Доля от самого активного месяца: \d+ перелёт/)).toBeInTheDocument()
}, 15_000)

it('never reads a missing monthly measurement as zero: unmeasured and future months say no data, empty months stay 0', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const payload = structuredClone(fixture) as OverviewPayload
  payload.generatedAt = '2020-06-15T00:00:00.000Z'
  // January has a flight without a distance; March has no flights at all; July onwards is still ahead.
  payload.rows[0].distanceKm = null
  payload.rows[2].date = '2020-02-20'
  admit(payload)
  render(<Section span="full" />)
  open('Year by month')
  fireEvent.click(screen.getByRole('radio', { name: 'Distance' }))
  const grid = screen.getByRole('group', { name: 'Year by month' })
  const label = (key: string) =>
    grid.querySelector(`[data-kc-key="${key}"]`)?.getAttribute('aria-label')
  expect(label('2020-01')).toContain('No data')
  expect(label('2020-03')).toMatch(/ 0$/)
  expect(label('2020-02')).toMatch(/13.766$/)
  const table = [...document.querySelectorAll('table')].find(
    (candidate) => candidate.caption?.textContent === 'Year by month',
  )!
  const row = (key: string) =>
    [...table.querySelectorAll('tr')].find((tr) => tr.cells[0]?.textContent === key)!
  expect(row('2020-01')).toHaveTextContent('No data')
  expect(row('2020-03')).toHaveTextContent(/0$/)
  expect(row('2020-12')).toHaveTextContent('No data')
  expect(screen.getAllByText('No data').length).toBeGreaterThan(0)
})

it('a pick on the chart moves the hero and the stamper and does not filter', () => {
  const setPeriod = admit(marches())
  const view = render(<Section span="full" />)
  fireEvent.click(stage().getByRole('radio', { name: 'Seasonality' }))
  expect(hero(view)).toHaveTextContent('March')
  expect(view.container.querySelector('.ov3-card-caption')).toHaveTextContent(
    'Busiest month · longest gap 11 months',
  )
  expect(top().queryByRole('button', { name: /^Only/ })).toBeNull()
  fireEvent.click(stage().getByRole('button', { name: /^May ·/ }))
  expect(hero(view)).toHaveTextContent('May')
  expect(view.container.querySelector('.ov3-card-caption')).toHaveTextContent('2nd busiest month')
  expect(view.container.querySelector('.iso-stamper-host')).toHaveAttribute('data-stamp', 'set')
  expect(add).not.toHaveBeenCalled()
  expect(setPeriod).not.toHaveBeenCalled()
})

it('"Only …" adds the month in Calendar and sets the year in Over time, and hides once applied', () => {
  const setPeriod = admit(marches())
  const view = render(<Section span="full" />)
  fireEvent.click(stage().getByRole('radio', { name: 'Seasonality' }))
  fireEvent.click(stage().getByRole('button', { name: /^May ·/ }))
  fireEvent.click(top().getByRole('button', { name: 'Only May' }))
  expect(add).toHaveBeenCalledWith('months', 5)
  fireEvent.click(stage().getByRole('radio', { name: 'Years' }))
  expect(hero(view)).toHaveTextContent('2020')
  fireEvent.click(stage().getByRole('button', { name: /^2021 ·/ }))
  expect(hero(view)).toHaveTextContent('2021')
  fireEvent.click(top().getByRole('button', { name: 'Only 2021' }))
  expect(setPeriod).toHaveBeenCalledWith({ years: [2021] })
  admit(marches(), 'owner-a', { period: { years: [2021] } })
  view.rerender(<Section span="full" />)
  expect(top().queryByRole('button', { name: /^Only/ })).toBeNull()
})

it('shows the empty state when the filter leaves too few months, and clears the filter', () => {
  admit(marches(), 'owner-a', { months: [1] })
  render(<Section span="full" />)
  expect(screen.getByText('Too few months for a rhythm')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
  expect(clear).toHaveBeenCalled()
})

// The desktop matrix is a stage: picking an exact month must inspect before filtering.
it('History selects a dated month for the hero and stamper and filters only through the explicit action', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const setPeriod = admit(marches())
  const view = render(<Section span="full" />)
  expect(stage().getByRole('radio', { name: 'History' })).toHaveAttribute('aria-checked', 'true')
  expect(hero(view)).toHaveTextContent('March 2022')
  fireEvent.click(stage().getByRole('button', { name: /^2021-03 ·/ }))
  expect(hero(view)).toHaveTextContent('March 2021')
  expect(stage().getByRole('button', { name: /^2021-03 ·/ })).toHaveAttribute(
    'aria-current',
    'true',
  )
  expect(view.container.querySelector('.iso-stamper-host')).toHaveAttribute('data-stamp', 'set')
  expect(setPeriod).not.toHaveBeenCalled()
  fireEvent.click(top().getByRole('button', { name: 'Only March 2021' }))
  expect(setPeriod).toHaveBeenCalledWith({ from: '2021-03', to: '2021-03' })
  const table = screen.getByRole('table', { name: 'Year by month' })
  expect(table.closest('[hidden]')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Year by month' })).toBeNull()
})
