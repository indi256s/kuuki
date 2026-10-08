// @vitest-environment jsdom
import { useEffect } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS, type SectionId } from '@kuuki/shared/overview/prefs'
import { aggregateRows } from '@kuuki/shared/overview/aggregate'
import { computeOverview } from '@kuuki/shared/overview/compute'
import { dayToEpoch } from '@kuuki/shared/overview/range'
import board from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { OverviewProvider, useOverview } from '../../store/overview-context'
import { SECTIONS } from '../registry'

const url = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/overview', useSearchParams: () => url.params, useRouter: () => ({ push: url.push, replace: url.replace, refresh: vi.fn() }) }))
const payload = board as OverviewPayload
let overview: ReturnType<typeof useOverview>
function Capture() { const value = useOverview(); useEffect(() => { overview = value }); return null }
function mount(id: SectionId, data: OverviewPayload = payload, locale: 'en' | 'ru' = 'en') {
  const Entry = SECTIONS[id]
  return render(<OverviewProvider payload={data} prefs={DEFAULT_PREFS} ownerKey="owner" locale={locale} live={false}><Capture /><Entry.Section span="full" /><Entry.Tile /></OverviewProvider>)
}
beforeEach(() => {
  url.params = new URLSearchParams(); url.push.mockClear(); url.replace.mockClear()
  // Substitute only browser geometry: actual SVG marks and selection stay in use.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 640, bottom: 300, width: 640, height: 300, toJSON() {} })
  document.documentElement.lang = 'en'
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
function choose(chart: Element, pointerType = 'mouse') {
  const svg = chart.querySelector('svg')!
  // Native keyboard selection chooses the actual chart's nearest point.
  fireEvent.pointerMove(svg, { clientX: 200, clientY: 120 })
  const down = new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 120 })
  Object.defineProperty(down, 'pointerType', { value: pointerType })
  fireEvent(svg, down)
  if (pointerType === 'mouse') { fireEvent.keyDown(svg, { key: 'Home' }); fireEvent.keyDown(svg, { key: 'Enter' }) }
  else fireEvent.click(svg, { clientX: 200, clientY: 120 })
}
const ids: SectionId[] = ['rankings', 'records', 'manufacturers', 'fleet', 'clock', 'rhythm', 'crossings']
describe.each(ids)('%s section', id => {
  it('renders engine rows in native tables and pure heading-free tiles', async () => {
    const { container } = mount(id)
    expect(container.querySelector('h2')).toBeNull()
    expect(container.querySelector('[data-span="full"]')).toBeTruthy()
    const toggles = screen.getAllByRole('button', { name: 'View as table' })
    for (const toggle of toggles) await userEvent.click(toggle)
    for (const table of screen.getAllByRole('table')) expect(within(table).getAllByRole('row').length).toBeGreaterThan(1)
  })
  it('renders Russian captions and localized table actions', () => {
    document.documentElement.lang = 'ru'
    const { container } = mount(id, payload, 'ru')
    expect(screen.getAllByRole('button', { name: 'Показать таблицу' }).length).toBeGreaterThan(0)
    expect(container.textContent).not.toMatch(/undefined|NaN|\{count\}|Missing key/)
  })
  if (id !== 'rankings') it('shows the real below-gate narrator and coverage', () => {
    mount(id, { ...payload, rows: payload.rows.filter(row => row.state !== 'upcoming').slice(0, 1) })
    expect(screen.getByText(/Coverage:/)).toBeTruthy()
    expect(document.querySelector('.narrator')?.textContent).toMatch(/evidence|Evidence|needs/)
    expect(document.querySelector('svg')).toBeNull()
  })
})
it.each([['rankings', 'airlines'], ['manufacturers', 'makers'], ['fleet', 'families'], ['clock', 'depHours'], ['crossings', 'period']] as const)('%s real chart selection writes %s', (id, facet) => {
  const { container } = mount(id)
  const chart = container.querySelector('.kc')!
  choose(chart)
  expect(overview.filter[facet]).toBeTruthy()
  const valid = id === 'rankings' ? payload.rows.map(row => row.airline) : id === 'manufacturers' ? ['airbus', 'boeing', 'embraer', 'atr', 'other', 'unknown'] : id === 'fleet' ? Object.values(payload.refs.aircraft).map(row => row.family) : null
  if (valid) expect(valid).toContain((overview.filter[facet] as string[])[0])
})
it('rankings segment switches the native series and route pick writes a route chip', async () => {
  const { container } = mount('rankings')
  await userEvent.click(screen.getByRole('radio', { name: 'Routes' }))
  choose(container.querySelector('.kc')!)
  expect(overview.filter.routes?.[0]).toMatch(/^[A-Z]{3}-[A-Z]{3}$/)
})
it('clock arrivals toggle selects the arrival-hour facet', async () => {
  const { container } = mount('clock')
  await userEvent.click(screen.getByRole('radio', { name: 'Arrivals' }))
  choose(container.querySelector('.kc')!)
  expect(overview.filter.arrHours?.length).toBe(1)
  expect(overview.filter.depHours).toBeUndefined()
})
it('fleet sub-band writes both the body and maker facets', async () => {
  mount('fleet')
  await userEvent.click(screen.getByRole('button', { name: /Narrowbody · airbus/ }))
  expect(overview.filter).toMatchObject({ bodies: ['narrow'], makers: ['airbus'] })
})
it('rhythm heat selects a month and odometer selects an exact day', () => {
  const { container } = mount('rhythm')
  choose(container.querySelectorAll('.kc')[0])
  expect(overview.filter.period).toMatchObject({ from: expect.stringMatching(/^\d{4}-\d{2}$/), to: expect.stringMatching(/^\d{4}-\d{2}$/) })
  act(() => overview.actions.clear())
  choose(container.querySelectorAll('.kc')[1])
  expect(overview.filter.period).toMatchObject({ from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
  const period = overview.filter.period
  if (!period || !('from' in period)) throw new Error('Odometer must select an exact day')
  expect(period.from).toBe(period.to)
})
it('rhythm date inputs apply atomically and brush keyboard release commits its draft', () => {
  mount('rhythm')
  const from = screen.getByLabelText('From date'), to = screen.getByLabelText('To date')
  fireEvent.change(from, { target: { value: '2021-01-01' } })
  fireEvent.change(to, { target: { value: '2024-01-01' } })
  expect(overview.filter.period).toBeUndefined()
  fireEvent.click(screen.getByRole('button', { name: 'Apply range' }))
  expect(overview.filter.period).toEqual({ from: '2021-01-01', to: '2024-01-01' })
  const handle = screen.getByRole('slider', { name: 'Range end' })
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  fireEvent.change(handle, { target: { value: dayToEpoch('2024-01-02') } })
  expect(overview.filter.period).toEqual({ from: '2021-01-01', to: '2024-01-01' })
  fireEvent.keyUp(handle, { key: 'ArrowRight' })
  expect(overview.filter.period).toEqual({ from: '2021-01-01', to: '2024-01-02' })
})
it('records private opener uses the actual cabinet id and route bus', async () => {
  mount('records')
  const record = computeOverview(payload, {}).records
  if (record.status !== 'ready' || !record.value.longest) throw new Error('board record missing')
  await userEvent.click(screen.getAllByRole('button', { name: `Open flight · ${record.value.longest.origin} → ${record.value.longest.destination}` })[0])
  expect(url.push).toHaveBeenCalledWith(`/overview?flight=${record.value.longest.flightId}`, { scroll: false })
  expect(overview.bus.getSnapshot().focusRoute).toBe([record.value.longest.origin, record.value.longest.destination].sort().join('-'))
})
it('real aggregate producer preserves board metrics, hides private openers and groups waffle cells', () => {
  const aggregate: OverviewPayload = { ...payload, mode: 'aggregate', rows: aggregateRows(payload.rows) }
  const scope = computeOverview(aggregate, {})
  expect(scope.figures.flights).toBe(69)
  expect(scope.records.status === 'ready' && scope.records.value.longest?.flightId).toBeNull()
  const first = mount('records', aggregate)
  expect(screen.queryByRole('button', { name: /Open flight/ })).toBeNull()
  first.unmount()
  mount('manufacturers', aggregate)
  expect(screen.getByText(/1 cell = 5 flights/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Add aircraft/ })).toBeNull()
})
it('crossings empty years visibly show a dash', async () => {
  mount('crossings')
  await userEvent.click(screen.getByRole('button', { name: 'View as table' }))
  const row = screen.getByRole('row', { name: /^2020/ })
  expect(row.textContent).toContain('–')
})
it('owner retirement unmounts chart actions before they can change private state', () => {
  const { container } = mount('manufacturers')
  act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
  expect(container.querySelector('svg')).toBeNull()
  expect(screen.queryByRole('button', { name: /Add aircraft/ })).toBeNull()
})

it('manufacturer metric stays in the URL and native hours grid has 100 cells', async () => {
  const first = mount('manufacturers')
  await userEvent.click(screen.getByRole('radio', { name: 'Hours' }))
  expect(url.replace).toHaveBeenCalledWith('/overview?makers=hours', { scroll: false })
  first.unmount()
  url.params = new URLSearchParams('makers=hours')
  const { container } = mount('manufacturers')
  expect(screen.getByText(/1 cell = 1% of/)).toBeTruthy()
  expect(container.querySelectorAll('svg rect[fill^="var(--cat-maker-"]').length).toBe(100)
})
it('manufacturer touch exposes real filter and flight actions with a factual tooltip', async () => {
  const { container } = mount('manufacturers')
  const svg = container.querySelector('.kc svg')!
  const cell = svg.querySelector('rect[fill^="var(--cat-maker-"]')!
  const x = Number(cell.getAttribute('x')) + Number(cell.getAttribute('width')) / 2
  const y = Number(cell.getAttribute('y')) + Number(cell.getAttribute('height')) / 2
  const down = new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y })
  Object.defineProperty(down, 'pointerType', { value: 'touch' })
  const mark = cell.closest('[data-kc-key]')!
  fireEvent(mark, down); fireEvent.click(mark, { clientX: x, clientY: y })
  expect(overview.filter.makers).toBeUndefined()
  const dialog = screen.getByRole('dialog')
  expect(dialog.textContent).toMatch(/Airbus|Boeing|Embraer|ATR|Other|Unknown/)
  expect(within(dialog).getByRole('button', { name: 'Open flight' })).toBeTruthy()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add filter' }))
  expect(overview.filter.makers?.length).toBe(1)
})
it('payload aircraft review opens locally and preserves filtering of its targets', async () => {
  mount('manufacturers')
  await userEvent.click(screen.getByRole('button', { name: 'Add aircraft →' }))
  expect(await screen.findByRole('button', { name: /Identify aircraft/i })).toBeTruthy()
  expect(screen.queryByText('The flights could not be loaded.')).toBeNull()
})
it('below aircraft and times coverage supplies the corresponding correction action', () => {
  const rows = payload.rows.filter(row => row.state !== 'upcoming').slice(0, 4).map(row => ({ ...row, aircraft: null, depMinute: null }))
  const data = { ...payload, rows }
  const first = mount('manufacturers', data)
  expect(screen.getByRole('button', { name: 'Add aircraft →' })).toBeTruthy()
  first.unmount()
  mount('clock', data)
  expect(screen.getByRole('link', { name: 'Add times →' }).getAttribute('href')).toBe('/journal')
})
