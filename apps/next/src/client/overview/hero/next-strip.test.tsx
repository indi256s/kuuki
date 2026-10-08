// @vitest-environment jsdom
import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import board from '../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { OverviewProvider, useOverview } from '../store/overview-context'
import { NextStrip } from './next-strip'

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/overview', useSearchParams: () => new URLSearchParams('keep=1'), useRouter: () => navigation }))
const payload = board as OverviewPayload
let overview: ReturnType<typeof useOverview>
function Capture({ show }: { show: boolean }) { const value = useOverview(); useEffect(() => { overview = value }); return show ? <NextStrip /> : null }
function tree(data: OverviewPayload | null = payload, ownerKey = 'owner', filter: OverviewFilter = {}, show = true, locale: 'en' | 'ru' = 'en') {
  return <OverviewProvider payload={data} prefs={{ ...DEFAULT_PREFS, filter }} ownerKey={ownerKey} locale={locale} live={false}><Capture show={show} /></OverviewProvider>
}
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })
it('uses earliest global flight, engine IN 3 DAYS and actual board country evidence', () => {
  render(tree({ ...payload, rows: [...payload.rows].reverse() }, 'owner', { period: { years: [2014] } }))
  expect(screen.getByText('IN 3 DAYS')).toBeTruthy()
  expect(screen.getByText('DXB–MLE')).toBeTruthy()
  expect(screen.getByText(/Sat, 10 Oct/)).toBeTruthy()
  expect(screen.getByText('+1 more booked')).toBeTruthy()
  expect(screen.queryByText(/a new country/)).toBeNull()
})
it('strip shows IN 3 DAYS and new country when actual evidence has none', () => {
  const future = payload.rows.find(row => row.id === 70)!
  render(tree({ ...payload, rows: [future], passport: { countries: 0, countryCodes: [], regions: 0 } }))
  expect(screen.getByText('IN 3 DAYS')).toBeTruthy()
  expect(screen.getByText(/a new country/)).toBeTruthy()
  expect(screen.queryByText(/more booked/)).toBeNull()
})
it('awaiting variant when nothing is booked uses global awaiting even outside selected period', () => {
  render(tree({ ...payload, rows: payload.rows.filter(row => row.state !== 'upcoming') }, 'owner', { period: { years: [2014] } }))
  expect(screen.getByRole('link', { name: '3 flights to review · Review →' }).getAttribute('href')).toBe('/journal?queue=awaiting')
})
it('confirmed empty renders nothing and missing payload remains loading', () => {
  const view = render(tree({ ...payload, rows: [] }))
  expect(view.container.textContent).toBe('')
  view.rerender(tree(null, 'other'))
  expect(screen.getByRole('status').textContent).toMatch(/Loading/)
})
it('hover/focus preview clears on leave, blur and unmount and preserves another preview', () => {
  const view = render(tree())
  const button = screen.getByRole('button', { name: /Open flight/ })
  fireEvent.mouseEnter(button)
  expect(overview.bus.getSnapshot().hoverGhost).toBe(70)
  fireEvent.mouseLeave(button)
  expect(overview.bus.getSnapshot().hoverGhost).toBeNull()
  fireEvent.focus(button)
  expect(overview.bus.getSnapshot().hoverGhost).toBe(70)
  act(() => overview.actions.setPeriod({ years: [2025] }))
  expect(overview.bus.getSnapshot().hoverGhost).toBe(70)
  fireEvent.blur(button)
  expect(overview.bus.getSnapshot().hoverGhost).toBeNull()
  fireEvent.focus(button)
  const bus = overview.bus
  view.rerender(tree(payload, 'owner', {}, false))
  expect(bus.getSnapshot().hoverGhost).toBeNull()
  view.rerender(tree())
  fireEvent.mouseEnter(screen.getByRole('button', { name: /Open flight/ }))
  bus.setHoverGhost(71)
  view.rerender(tree(payload, 'owner', {}, false))
  expect(bus.getSnapshot().hoverGhost).toBe(71)
})
it('retirement and owner replacement cannot publish stale previews or navigation', () => {
  const view = render(tree())
  const button = screen.getByRole('button', { name: /Open flight/ })
  fireEvent.mouseEnter(button)
  const old = overview.bus, updates = vi.fn()
  old.subscribe(updates)
  act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
  expect(updates).not.toHaveBeenCalled()
  fireEvent.click(button)
  expect(navigation.push).not.toHaveBeenCalled()
  view.rerender(tree(payload, 'replacement'))
  expect(overview.bus.getSnapshot().hoverGhost).toBeNull()
})
it('click uses the real guarded opener and never fetches directly', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(tree())
  fireEvent.click(screen.getByRole('button', { name: /Open flight/ }))
  expect(navigation.push).toHaveBeenCalledWith('/overview?keep=1&flight=70', { scroll: false })
  expect(fetcher).not.toHaveBeenCalled()
})
it.each(['dev', 'aggregate'])('omits private action for %s', kind => {
  render(tree({ ...payload, mode: kind === 'aggregate' ? 'aggregate' : 'flights' }, kind === 'dev' ? 'dev' : 'owner'))
  expect(screen.queryByRole('button', { name: /Open flight/ })).toBeNull()
  expect(screen.getByText('DXB–MLE')).toBeTruthy()
  fireEvent.click(screen.getByText('DXB–MLE'))
  expect(navigation.push).not.toHaveBeenCalled()
})
it.each(['2026-10-01', 'invalid'])('past/invalid upcoming dates use actual date, not TODAY (%s)', date => {
  const future = payload.rows.find(row => row.id === 70)!
  render(tree({ ...payload, rows: [{ ...future, date }] }))
  expect(screen.queryByText('TODAY')).toBeNull()
  expect(screen.getAllByText(date === 'invalid' ? /invalid/i : /Oct 1, 2026|Thu, 1 Oct/).length).toBeGreaterThan(0)
})
it('invalid generated time does not turn the engine fallback zero into TODAY', () => {
  render(tree({ ...payload, generatedAt: 'invalid' }))
  expect(screen.queryByText('TODAY')).toBeNull()
  expect(screen.getByText('OCT 10, 2026')).toBeTruthy()
})
it.each([['2026-10-10T23:00:00Z', 'TODAY'], ['2026-10-09T00:00:00Z', 'TOMORROW']])('uses generated UTC day %s', (generatedAt, label) => {
  render(tree({ ...payload, generatedAt }))
  expect(screen.getByText(label)).toBeTruthy()
})
it('Russian countdown and review copy use plural forms', () => {
  const view = render(tree(payload, 'owner', {}, true, 'ru'))
  expect(screen.getByText('ЧЕРЕЗ 3 ДНЯ')).toBeTruthy()
  view.rerender(tree({ ...payload, rows: payload.rows.filter(row => row.state !== 'upcoming') }, 'other', {}, true, 'ru'))
  expect(screen.getByRole('link', { name: '3 перелёта · Проверить →' })).toBeTruthy()
})

it.each([
  ['en', /^Open flight · IN 3 DAYS · DXB–MLE · Sat, 10 Oct · EK 169 · a new country$/],
  ['ru', /^Открыть перелёт · ЧЕРЕЗ 3 ДНЯ · DXB–MLE · .* · EK 169 · новая страна$/],
] as const)('announces countdown, booking number and new-country evidence in %s', (locale, name) => {
  const future = payload.rows.find(row => row.id === 70)!
  render(tree({ ...payload, rows: [future], passport: { countries: 0, countryCodes: [], regions: 0 } }, 'owner', {}, true, locale))
  expect(screen.getByRole('button', { name })).toBeTruthy()
})
