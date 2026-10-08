// @vitest-environment jsdom
import { useEffect } from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import board from '../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { OverviewProvider, useOverview } from '../store/overview-context'
import { HeroPanel } from './hero-panel'

const payload = board as OverviewPayload
let overview: ReturnType<typeof useOverview>
function Capture() { const value = useOverview(); useEffect(() => { overview = value }); return <HeroPanel /> }
function mount(filter: OverviewFilter = {}, data: OverviewPayload | null = payload, locale: 'en' | 'ru' = 'en') {
  return render(<OverviewProvider payload={data} prefs={{ ...DEFAULT_PREFS, filter }} locale={locale} ownerKey="owner" live={false}><Capture /></OverviewProvider>)
}
afterEach(cleanup)
it('renders the accepted board figures, provenance and review target', () => {
  mount()
  expect(screen.getByLabelText('Flights').textContent).toBe('69')
  expect(screen.getByLabelText('Kilometres').textContent).toBe('141,204 km')
  expect(screen.getByLabelText('Countries and territories').textContent).toBe('14')
  expect(screen.getByText('Flights since March 2014')).toBeTruthy()
  expect(screen.getByRole('link', { name: '3 awaiting review →' }).getAttribute('href')).toBe('/journal?queue=awaiting')
  expect(screen.getByText(/In the air · 6 estimated/)).toBeTruthy()
  expect(screen.getByLabelText('In the air').textContent).toMatch(/^≈ /)
})
it('deltas only with a valid time filter and subtract previous totals', () => {
  mount()
  expect(screen.queryByText(/vs /)).toBeNull()
  act(() => overview.actions.setPeriod({ years: [2026] }))
  expect(screen.getByText('↓ −4 vs 2025')).toBeTruthy()
  act(() => overview.actions.setPeriod({ years: [2025] }))
  expect(screen.getByText('↑ +3 vs 2024')).toBeTruthy()
  act(() => overview.actions.setPeriod({ years: [2024, 2026] }))
  expect(screen.queryByText(/vs /)).toBeNull()
  act(() => overview.actions.setPeriod({ years: [] }))
  expect(screen.queryByText(/vs /)).toBeNull()
})
it('compares custom months against the equal preceding span and keeps zero signed', () => {
  const row = payload.rows[0]
  mount({ period: { from: '2026-03', to: '2026-04' } }, { ...payload, rows: [
    { ...row, id: 1, date: '2026-01-01', durationMinutes: 60 }, { ...row, id: 2, date: '2026-03-01', durationMinutes: 75 },
  ] })
  expect(screen.getByText('↑ +0 vs January 2026–February 2026')).toBeTruthy()
  expect(screen.getByText('↑ +15 min vs January 2026–February 2026')).toBeTruthy()
})
it('share line only for facet-only filters and displays the ratio as percent', () => {
  mount({ airlines: ['TK'] })
  expect(screen.getByText('24 flights · 35% of all')).toBeTruthy()
  expect(screen.getByText('Countries and territories · by air')).toBeTruthy()
  act(() => overview.actions.setPeriod({ years: [2026] }))
  expect(screen.queryByText(/% of all/)).toBeNull()
  act(() => overview.actions.clear())
  expect(screen.queryByText(/% of all/)).toBeNull()
})
it('approximate duration shows ≈ and estimated count; precise duration does not', () => {
  mount({}, { ...payload, rows: [{ ...payload.rows[0], durationSource: 'times', durationMinutes: 13200 }] })
  expect(screen.getByLabelText('In the air').textContent).toBe('9 d 4 h')
  expect(screen.queryByText(/estimated/)).toBeNull()
})
it('year tap atomically sets the period with keyboard support and selected state', async () => {
  mount({ airlines: ['TK'], period: { from: '2025-01', to: '2026-12' } })
  const button = screen.getByRole('button', { name: /^2025 ·/ })
  button.focus()
  await userEvent.keyboard('{Enter}')
  expect(overview.filter).toEqual({ airlines: ['TK'], period: { years: [2025] } })
  expect(button.getAttribute('aria-pressed')).toBe('true')
})
it('zero-result figures all use dashes and retain usable empty years', () => {
  mount({ airlines: ['ZZ'] })
  for (const name of ['Flights', 'Kilometres', 'In the air', 'Countries and territories', 'Airports']) {
    expect(screen.getByLabelText(name).textContent).toBe('—')
  }
  const strip = screen.getByRole('group', { name: 'Flights per year' })
  expect(within(strip).getAllByRole('button').length).toBe(13)
  expect(screen.queryByText(/% of all/)).toBeNull()
})
it('empty facet arrays are semantically unfiltered, and unknown payload is loading', () => {
  const empty = { ...payload, rows: [], passport: { ...payload.passport, countries: 2 } }
  const first = mount({ airlines: [] }, empty)
  expect(screen.getByLabelText('Countries and territories').textContent).toBe('2')
  first.unmount()
  mount({}, null)
  expect(screen.getByRole('status').textContent).toMatch(/Loading/)
  expect(screen.queryByLabelText('Flights')).toBeNull()
})
it('Russian captions, counts and previous period remain localized', () => {
  mount({ period: { years: [2026] } }, payload, 'ru')
  expect(screen.getByText('↓ −4 к 2025')).toBeTruthy()
  expect(screen.getByText(/Перелёты с/)).toBeTruthy()
  expect(screen.getByLabelText('Страны и территории').textContent).toBe('6')
})

it('uses weighted producer totals without counting payload rows', () => {
  mount({}, { ...payload, mode: 'aggregate', rows: [{ ...payload.rows[0], weight: 7, distanceKm: 700, durationMinutes: 420 }] })
  expect(screen.getByLabelText('Flights').textContent).toBe('7')
  expect(screen.getByLabelText('Kilometres').textContent).toBe('700 km')
  expect(screen.getByLabelText('In the air').textContent).toBe('≈ 7 h')
})

it.each([
  ['en', 'Flights since December 99', '↑ +0 vs October 99–November 99', '↑ +15 min vs October 99–November 99'],
  ['ru', 'Перелёты с декабря 99 г.', '↑ +0 к октябрь 99 г.–ноябрь 99 г.', '↑ +15 мин к октябрь 99 г.–ноябрь 99 г.'],
] as const)('localizes valid early-year first dates and equal preceding months in %s', (locale, since, delta, duration) => {
  const row = { ...payload.rows[0], id: 1, date: '0099-12-30', state: 'logged' as const, durationMinutes: 75 }
  const view = mount({}, { ...payload, rows: [row] }, locale)
  expect(overview.scope?.figures.firstDate).toBe('0099-12-30')
  expect.soft(screen.queryByText(since)).toBeTruthy()
  view.unmount()
  mount({ period: { from: '0099-12', to: '0100-01' } }, { ...payload, rows: [
    row, { ...row, id: 2, date: '0099-10-30', durationMinutes: 60 },
  ] }, locale)
  expect(overview.scope?.figures.deltas).toEqual({ flights: 1, distanceKm: row.distanceKm, durationMinutes: 60 })
  expect.soft(screen.queryByText(delta)).toBeTruthy()
  expect.soft(screen.queryByText(duration)).toBeTruthy()
})
