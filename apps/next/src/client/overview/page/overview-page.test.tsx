// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { LIFECYCLE_CHANGED_EVENT } from '../../lifecycle-sync'
import { afterEach, expect, it, vi } from 'vitest'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import board from '../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import empty from '../../../../../../packages/shared/src/overview/__fixtures__/n0.json'
import n1 from '../../../../../../packages/shared/src/overview/__fixtures__/n1.json'
import aggregate from '../../../../../../packages/shared/src/overview/__fixtures__/n5001.json'
import { computeOverview } from '@kuuki/shared/overview/compute'
import { pickLine } from '../narrator/pick'
import { OverviewPage } from './overview-page'
import { SECTIONS } from '../sections/registry'
import { DevOverview } from '../../../app/dev/overview/dev-overview'
import DevPage from '../../../app/dev/overview/page'

const navigation = vi.hoisted(() => ({ query: '', notFound: vi.fn(() => { throw new Error('NOT_FOUND') }) }))
vi.mock('next/navigation', () => ({ notFound: navigation.notFound, usePathname: () => '/dev/overview', useSearchParams: () => new URLSearchParams(navigation.query), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
const transport = vi.hoisted(() => ({ put: vi.fn(), getFlight: vi.fn() }))
vi.mock('@kuuki/client/apiClient', async original => {
  const actual = await original<typeof import('@kuuki/client/apiClient')>()
  return { ...actual, api: { ...actual.api, put: transport.put } }
})
vi.mock('@kuuki/client/flights', () => ({ getFlight: transport.getFlight, deleteFlight: vi.fn(), checkDuplicateFlight: vi.fn() }))
const payload = board as OverviewPayload
const zeroPrefs = () => ({ ...structuredClone(DEFAULT_PREFS), filter: { period: { years: [2016] }, airlines: ['QR'] } })
const saver = async (prefs: typeof DEFAULT_PREFS) => prefs
function mount(data: OverviewPayload | null = payload, prefs = structuredClone(DEFAULT_PREFS), locale: 'en' | 'ru' = 'en') {
  return render(<OverviewPage payload={data} prefs={prefs} ownerKey="dev" name="" locale={locale} live={false} saver={saver} />)
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); transport.put.mockClear(); transport.getFlight.mockClear(); navigation.query = '' })
it.each(['en', 'ru'] as const)('first run shows actual narrator and import/add links, no figures or sections (%s)', locale => {
  const data = empty as OverviewPayload
  const scope = computeOverview(data, {})
  const view = mount(data, { ...structuredClone(DEFAULT_PREFS), filter: { airlines: [], period: { years: [] } } }, locale)
  expect(screen.getByRole('link', { name: locale === 'en' ? 'Import flights' : 'Импортировать перелёты' })).toHaveAttribute('href', '/import')
  expect(screen.getByRole('link', { name: locale === 'en' ? 'Add manually' : 'Добавить вручную' })).toHaveAttribute('href', '/add')
  expect(view.container.querySelector('.narrator')).toHaveTextContent(pickLine('firstRun', scope, scope, 'dev', locale)!)
  expect(view.container.querySelector('[data-region="figures"]')).toBeNull()
  expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
  expect(view.container.querySelector('[data-globe="blank"]')).not.toBeNull()
})
it('zero result has one actual narrator, chips and actions; removes QR then the atomic period', async () => {
  mount(payload, zeroPrefs())
  const scope = computeOverview(payload, zeroPrefs().filter), all = computeOverview(payload, {})
  expect(document.querySelectorAll('.narrator')).toHaveLength(1)
  expect(document.querySelector('.narrator')).toHaveTextContent(pickLine('zero', scope, all, 'dev', 'en')!)
  expect(document.querySelector('[data-globe="ghost"]')).not.toBeNull()
  expect(within(screen.getByRole('region', { name: 'Totals for the period' })).getAllByText('—')).toHaveLength(4)
  expect(screen.getByRole('button', { name: 'Remove Qatar Airways' })).toBeInTheDocument()
  act(() => screen.getByRole('button', { name: 'Remove last filter' }).click())
  expect(screen.queryByRole('button', { name: 'Remove Qatar Airways' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Remove Period 2016' })).toBeInTheDocument()
  act(() => screen.getByRole('button', { name: 'Remove last filter' }).click())
  expect(screen.queryByRole('button', { name: 'Remove Period 2016' })).toBeNull()
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7)
})
it('chip removal and clear all use real actions to recover ready data', () => {
  const view = mount(payload, zeroPrefs())
  act(() => screen.getByRole('button', { name: 'Remove Qatar Airways' }).click())
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(' · Period 2016')
  act(() => screen.getByRole('button', { name: 'Clear all' }).click())
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7)
  expect(view.container.querySelectorAll('.ui-chip')).toHaveLength(0)
})
it.each([false, true])('sections follow persisted order and hidden filtering on mobile=%s', mobile => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: mobile, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
  const prefs = structuredClone(DEFAULT_PREFS)
  prefs.layout.order.reverse(); prefs.layout.hidden = ['fleet', 'clock']
  mount(payload, prefs, 'ru')
  expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(['Пересечения', 'Ритм', 'Производители', 'Рекорды', 'Рейтинги'])
  expect(screen.getByRole('contentinfo')).toHaveTextContent('Скрытые разделы: 2')
})
it('missing payload loads instead of showing first run; SSR does not guess a section surface', () => {
  const view = mount(null)
  expect(screen.getByRole('status')).toHaveTextContent('Loading overview')
  expect(screen.queryByRole('link')).toBeNull()
  view.unmount()
  const html = renderToString(<OverviewPage payload={payload} prefs={DEFAULT_PREFS} ownerKey="dev" name="Alex" locale="en" live={false} saver={saver} />)
  expect(html).toContain('Hi, Alex')
  expect(html).not.toContain('<h2')
})
it.each([n1, aggregate])('real nonempty fixtures stay ready without editor reads', data => {
  mount(data as OverviewPayload)
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7)
  expect(screen.queryByRole('link', { name: 'Import flights' })).toBeNull()
  expect(transport.getFlight).not.toHaveBeenCalled()
})
it('dev wrapper prevents private GET/PUT and editor calls after actual edits and lifecycle events', async () => {
  vi.useFakeTimers()
  navigation.query = 'flight=1'
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  render(<DevOverview payload={payload} prefs={zeroPrefs()} locale="ru" theme="dark" />)
  act(() => screen.getByRole('button', { name: 'Сбросить всё' }).click())
  act(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT)); document.dispatchEvent(new Event('visibilitychange')) })
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(fetcher).not.toHaveBeenCalled(); expect(transport.put).not.toHaveBeenCalled(); expect(transport.getFlight).not.toHaveBeenCalled()
  expect(document.documentElement.dataset.theme).toBe('dark')
})
it('production rejects before awaiting search parameters or invoking fixture/provider work', async () => {
  vi.stubEnv('NODE_ENV', 'production')
  let awaited = false
  const params = { then() { awaited = true; throw new Error('SEARCH_AWAITED') } } as unknown as Promise<{ fixture?: string }>
  await expect(DevPage({ searchParams: params })).rejects.toThrow('NOT_FOUND')
  expect(awaited).toBe(false)
})
it('dev route selects actual fixtures and safe query defaults using serializable props', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  for (const [fixture, source] of [['board', board], ['empty', empty], ['n1', n1], ['zero', board], ['aggregate', aggregate]] as const) {
    const result = await DevPage({ searchParams: Promise.resolve({ fixture, theme: 'dark', locale: 'ru' }) })
    expect(result.props.payload).toEqual(source)
    expect(result.props.locale).toBe('ru'); expect(result.props.theme).toBe('dark')
    expect(result.props.prefs.filter).toEqual(fixture === 'zero' ? zeroPrefs().filter : {})
    expect(Object.values(result.props).some(value => typeof value === 'function')).toBe(false)
  }
  const result = await DevPage({ searchParams: Promise.resolve({ fixture: 'bad', theme: 'bad', locale: 'bad' }) })
  expect(result.props.payload).toEqual(board); expect(result.props.theme).toBe('light'); expect(result.props.locale).toBe('en')
  expect(DEFAULT_PREFS.filter).toEqual({})
})

it('keeps available scope after a real refresh failure instead of replacing it with empty state', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
  vi.stubGlobal('fetch', fetcher)
  render(<OverviewPage payload={payload} prefs={DEFAULT_PREFS} ownerKey="owner" name="Alex" locale="en" saver={saver} />)
  await act(async () => { window.dispatchEvent(new Event('focus')) })
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7)
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Import flights' })).toBeNull()
})
it('registry exposes actual gates including makers and ungated rankings to later section consumers', () => {
  const scope = computeOverview(payload, {})
  expect(SECTIONS.manufacturers.gate(scope)).toBe(scope.makers)
  expect(SECTIONS.rankings.gate(scope)).toBeNull()
  expect(SECTIONS.records.gate(scope)).toBe(scope.records)
})
it('composes inside the member main without nesting landmarks and supplies one main in dev', () => {
  const view = render(<main id="main"><OverviewPage payload={payload} prefs={DEFAULT_PREFS} ownerKey="dev" name="Alex" locale="en" saver={saver} live={false} /></main>)
  expect(screen.getAllByRole('main')).toHaveLength(1)
  view.unmount()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
  render(<DevOverview payload={payload} prefs={DEFAULT_PREFS} theme="light" locale="en" />)
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
})

it('hydrates on mobile without mounting desktop sections or reporting a hydration mismatch', async () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
  const page = <OverviewPage payload={payload} prefs={DEFAULT_PREFS} ownerKey="dev" name="" locale="ru" saver={saver} live={false} />
  const host = document.createElement('div')
  host.innerHTML = renderToString(page)
  expect(host.querySelector('[data-surface]')).toBeNull()
  document.body.appendChild(host)
  const errors: unknown[] = []
  let root!: ReturnType<typeof hydrateRoot>
  try {
    await act(async () => { root = hydrateRoot(host, page, { onRecoverableError: error => errors.push(error) }) })
    expect(host.querySelector('[data-surface]')).toHaveAttribute('data-surface', 'tiles')
    expect(errors).toEqual([])
  } finally {
    act(() => root?.unmount())
    host.remove()
  }
})
