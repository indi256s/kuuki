// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import { aggregateRows } from '@kuuki/shared/overview/aggregate'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { Section } from './section'

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))
afterEach(() => vi.unstubAllGlobals())
function admit(payload: OverviewPayload, ownerKey = 'owner-a') {
  const setPeriod = vi.fn()
  context.current = {
    payload,
    scope: computeOverview(payload, {}),
    all: computeOverview(payload, {}),
    filter: {},
    aggregate: payload.mode === 'aggregate',
    ownerKey,
    locale: 'en',
    actions: { setPeriod },
    isCurrent: () => true,
  } as unknown as typeof context.current
  return setPeriod
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
  expect(
    screen.getByText('Daily activity is unavailable in this older monthly summary.'),
  ).toBeInTheDocument()
})

it('names the daily scale and the monthly base in both languages, and tells a known zero from a day with no data', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const payload = structuredClone(fixture) as OverviewPayload
  // The journal starts mid-January, so the first days of the year fall before it.
  payload.rows[0].date = '2020-01-10'
  admit(payload)
  const view = render(<Section span="full" />)
  expect(screen.getByText('Completed flights per day')).toBeInTheDocument()
  for (const label of ['0', '1', '2', '3', '4+'])
    expect(screen.getAllByText(label).length).toBeGreaterThan(0)
  expect(screen.getByText('No data (before the journal or after today)')).toBeInTheDocument()
  expect(screen.getByText(/^Share of your busiest month: \d+ flights?$/)).toBeInTheDocument()
  const calendar = screen.getByRole('group', { name: /^Completed flights by day/ })
  const days = [...calendar.querySelectorAll('[data-kc-key]')]
  const before = days[0].getAttribute('aria-label')!
  expect(before).toContain('no data')
  expect(days.some((day) => /· 0$/.test(day.getAttribute('aria-label')!))).toBe(true)
  context.current = { ...context.current, locale: 'ru' }
  view.rerender(<Section span="full" />)
  expect(screen.getByText('Завершённых перелётов в день')).toBeInTheDocument()
  expect(
    screen.getByText(/^Доля от вашего самого активного месяца: \d+ перелёт/),
  ).toBeInTheDocument()
})

it('never reads a missing monthly measurement as zero: unmeasured and future months say no data, empty months stay 0', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const payload = structuredClone(fixture) as OverviewPayload
  payload.generatedAt = '2020-06-15T00:00:00.000Z'
  // January has a flight without a distance; March has no flights at all; July onwards is still ahead.
  payload.rows[0].distanceKm = null
  payload.rows[2].date = '2020-02-20'
  admit(payload)
  render(<Section span="full" />)
  fireEvent.click(screen.getByRole('radio', { name: 'Distance' }))
  const grid = screen.getByRole('group', { name: 'Flights by month' })
  const label = (key: string) =>
    grid.querySelector(`[data-kc-key="${key}"]`)?.getAttribute('aria-label')
  expect(label('2020-01')).toContain('No data')
  expect(label('2020-03')).toMatch(/ 0$/)
  expect(label('2020-02')).toMatch(/13.766$/)
  const table = [...document.querySelectorAll('table')].find(
    (candidate) => candidate.caption?.textContent === 'Flights by month',
  )!
  const row = (key: string) =>
    [...table.querySelectorAll('tr')].find((tr) => tr.cells[0]?.textContent === key)!
  expect(row('2020-01')).toHaveTextContent('No data')
  expect(row('2020-03')).toHaveTextContent(/0$/)
  expect(row('2020-12')).toHaveTextContent('No data')
  expect(screen.getAllByText('No data').length).toBeGreaterThan(0)
})
