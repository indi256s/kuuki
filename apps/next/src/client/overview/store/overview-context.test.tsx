// @vitest-environment jsdom
import { StrictMode, useEffect } from 'react'
import { renderToString } from 'react-dom/server'
import { flushSync } from 'react-dom'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { announceShellNotice } from '../../shell-notices'
import { api, advanceAuthGeneration, getAuthGeneration } from '@kuuki/client/apiClient'
import { withIdentityMutation } from '../../activity'
import { LIFECYCLE_CHANGED_EVENT } from '../../lifecycle-sync'
import userEvent from '@testing-library/user-event'
import { OverviewFlightSheet, useOpenFlight, useMakerMetric } from './open-flight'
import { createUIBus } from './ui-bus'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS, type OverviewPrefs } from '@kuuki/shared/overview/prefs'
import { OverviewProvider, useOverview, useFilterActions, useOverviewUI } from './overview-context'
import * as dataStores from '../data-store'

const auth = vi.hoisted(() => ({
  put: vi.fn(),
  pathname: '/overview',
  query: '',
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  getFlight: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => auth.pathname,
  useSearchParams: () => new URLSearchParams(auth.query),
  useRouter: () => ({ push: auth.push, replace: auth.replace, refresh: auth.refresh }),
}))
vi.mock('@kuuki/client/flights', () => ({
  getFlight: auth.getFlight,
  deleteFlight: auth.remove,
  checkDuplicateFlight: vi.fn(async () => null),
}))
vi.mock('@kuuki/client/apiClient', async (original) => {
  const actual = await original<typeof import('@kuuki/client/apiClient')>()
  return { ...actual, api: { ...actual.api, put: auth.put } }
})
vi.mock('../../shell-notices', () => ({ announceShellNotice: vi.fn() }))
const payload = { ...fixture, etag: 'W/"ov3-owner-1-0"' } as OverviewPayload
function Controls() {
  const overview = useOverview(),
    actions = useFilterActions()
  return (
    <>
      <output>{overview.scope?.figures.flights}</output>
      <button onClick={() => actions.add('airlines', 'ZZ')}>ZZ</button>
      <button onClick={() => actions.add('countries', 'JP')}>JP</button>
      <button onClick={() => actions.add('depHours', 0)}>hour</button>
    </>
  )
}
beforeEach(() => {
  vi.spyOn(window.history, 'pushState')
  vi.spyOn(window.history, 'replaceState')
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  auth.put.mockReset()
  vi.mocked(announceShellNotice).mockClear()
  auth.pathname = '/overview'
  auth.query = ''
  auth.push.mockReset()
  auth.replace.mockReset()
  auth.refresh.mockReset()
  auth.getFlight.mockReset()
  auth.remove.mockReset()
  window.history.replaceState(null, '', '/overview')
})
it('unknown facet value yields zero scope, not a crash', () => {
  render(
    <OverviewProvider
      payload={payload}
      prefs={DEFAULT_PREFS}
      ownerKey="owner"
      locale="en"
      live={false}
    >
      <Controls />
    </OverviewProvider>,
  )
  act(() => screen.getByText('ZZ').click())
  expect(screen.getByRole('status').textContent).toBe('0')
})
it('prefs save is debounced and last write wins without a mount save, including StrictMode', async () => {
  vi.useFakeTimers()
  const saver = vi.fn(async (prefs: OverviewPrefs) => prefs)
  const prefs = { ...DEFAULT_PREFS, publicSections: { records: true, fleet: true } }
  render(
    <StrictMode>
      <OverviewProvider
        payload={payload}
        prefs={prefs}
        ownerKey="owner"
        locale="en"
        saver={saver}
        live={false}
      >
        <Controls />
      </OverviewProvider>
    </StrictMode>,
  )
  await act(() => vi.advanceTimersByTimeAsync(800))
  expect(saver).not.toHaveBeenCalled()
  act(() => {
    screen.getByText('ZZ').click()
    screen.getByText('JP').click()
    screen.getByText('hour').click()
  })
  await act(() => vi.advanceTimersByTimeAsync(799))
  expect(saver).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(saver).toHaveBeenCalledTimes(1)
  expect(saver.mock.calls[0][0]).toEqual({
    ...prefs,
    filter: { airlines: ['ZZ'], countries: ['JP'], depHours: [0] },
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
let current!: ReturnType<typeof useOverview>
function Capture() {
  const value = useOverview()
  useEffect(() => {
    current = value
  })
  return <Controls />
}
function mount(
  saver?: (prefs: OverviewPrefs, signal: AbortSignal) => Promise<OverviewPrefs>,
  live = false,
) {
  return render(
    <OverviewProvider
      payload={payload}
      prefs={DEFAULT_PREFS}
      ownerKey="owner"
      locale="en"
      saver={saver}
      live={live}
    >
      <Capture />
    </OverviewProvider>,
  )
}
const advance = (ms = 800) => act(() => vi.advanceTimersByTimeAsync(ms))

it('serializes PUTs and retains only the newest eligible snapshot, without applying an old reply', async () => {
  vi.useFakeTimers()
  const first = deferred<OverviewPrefs>(),
    second = deferred<OverviewPrefs>()
  const saver = vi
    .fn<(prefs: OverviewPrefs, signal: AbortSignal) => Promise<OverviewPrefs>>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
  mount(saver)
  act(() => current.actions.add('airlines', 'TK'))
  await advance()
  act(() => current.actions.add('countries', 'JP'))
  await advance()
  act(() => current.actions.add('depHours', 0))
  await advance(799)
  await act(async () => first.resolve(DEFAULT_PREFS))
  expect(saver).toHaveBeenCalledTimes(1)
  expect(current.filter).toEqual({ airlines: ['TK'], countries: ['JP'], depHours: [0] })
  await advance(1)
  expect(saver).toHaveBeenCalledTimes(2)
  expect(saver.mock.calls[1][0].filter).toEqual(current.filter)
  await act(async () => second.resolve(DEFAULT_PREFS))
  await advance(2000)
  expect(saver).toHaveBeenCalledTimes(2)
})
it('sends the latest already-quiet edit after an outstanding request completes', async () => {
  vi.useFakeTimers()
  const first = deferred<OverviewPrefs>()
  const saver = vi
    .fn<(prefs: OverviewPrefs, signal: AbortSignal) => Promise<OverviewPrefs>>()
    .mockReturnValueOnce(first.promise)
    .mockImplementation(async (prefs) => prefs)
  mount(saver)
  act(() => current.actions.add('airlines', 'TK'))
  await advance()
  act(() => current.actions.add('countries', 'JP'))
  await advance()
  act(() => {
    current.setLayout((layout) => ({ ...layout, hidden: ['rhythm'] }))
    current.setLayout((layout) => ({ ...layout, order: [...layout.order].reverse() }))
    current.setReplayPaused(true)
  })
  await advance()
  expect(saver).toHaveBeenCalledTimes(1)
  await act(async () => first.resolve(DEFAULT_PREFS))
  expect(saver).toHaveBeenCalledTimes(2)
  expect(saver.mock.calls[1][0]).toMatchObject({
    replayPaused: true,
    filter: { airlines: ['TK'], countries: ['JP'] },
    layout: { order: [...DEFAULT_PREFS.layout.order].reverse(), hidden: ['rhythm'] },
  })
  expect(DEFAULT_PREFS.layout.hidden).toEqual([])
})
it('failed saves keep local choices and toast once per episode, with a new edit recovering', async () => {
  vi.useFakeTimers()
  const saver = vi
    .fn<(prefs: OverviewPrefs, signal: AbortSignal) => Promise<OverviewPrefs>>()
    .mockRejectedValue(new Error('offline'))
  mount(saver)
  act(() => current.actions.add('airlines', 'ZZ'))
  await advance()
  expect(current.filter).toEqual({ airlines: ['ZZ'] })
  await advance(5000)
  expect(saver).toHaveBeenCalledTimes(1)
  act(() => current.setReplayPaused(true))
  await advance()
  expect(announceShellNotice).toHaveBeenCalledTimes(1)
  expect(announceShellNotice).toHaveBeenCalledWith(
    'owner',
    expect.objectContaining({ kind: 'error', message: expect.stringContaining('choices remain') }),
  )
  saver.mockImplementation(async (prefs) => prefs)
  act(() => current.actions.add('countries', 'JP'))
  await advance()
  saver.mockRejectedValue(new Error('offline again'))
  act(() => current.actions.add('depHours', 0))
  await advance()
  expect(announceShellNotice).toHaveBeenCalledTimes(2)
})
it.each(['unmount', 'reset'])(
  'drops the final unsaved debounce window on %s and stops subsequent edits',
  async (kind) => {
    vi.useFakeTimers()
    const saver = vi.fn(async (prefs: OverviewPrefs) => prefs)
    const view = mount(saver)
    act(() => current.actions.add('airlines', 'TK'))
    await advance(799)
    if (kind === 'unmount') view.unmount()
    else act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
    await advance(5000)
    expect(saver).not.toHaveBeenCalled()
    if (kind === 'reset') {
      act(() => current.actions.add('countries', 'JP'))
      await advance()
      expect(saver).not.toHaveBeenCalled()
    }
  },
)
it.each(['resolve', 'reject'])(
  'owner replacement aborts old PUT and suppresses stale %s, errors and followups',
  async (completion) => {
    vi.useFakeTimers()
    const old = deferred<OverviewPrefs>()
    const saver = vi
      .fn<(prefs: OverviewPrefs, signal: AbortSignal) => Promise<OverviewPrefs>>()
      .mockReturnValue(old.promise)
    const view = mount(saver)
    act(() => current.actions.add('airlines', 'TK'))
    await advance()
    act(() => {
      current.actions.add('countries', 'JP')
      current.bus.setHoverRoute('TBS-IST')
    })
    await advance()
    view.rerender(
      <OverviewProvider
        payload={payload}
        prefs={DEFAULT_PREFS}
        ownerKey="other"
        locale="ru"
        saver={saver}
        live={false}
      >
        <Capture />
      </OverviewProvider>,
    )
    expect(saver.mock.calls[0][1].aborted).toBe(true)
    expect(current.filter).toEqual({})
    expect(current.bus.getSnapshot().hoverRoute).toBeNull()
    await act(async () =>
      completion === 'resolve' ? old.resolve(DEFAULT_PREFS) : old.reject(new Error('old failure')),
    )
    await advance(2000)
    expect(saver).toHaveBeenCalledTimes(1)
    expect(announceShellNotice).not.toHaveBeenCalled()
  },
)
it('same-owner rerenders keep choices and store, and bus-only updates never save', async () => {
  vi.useFakeTimers()
  const saver = vi.fn(async (prefs: OverviewPrefs) => prefs),
    view = mount(saver)
  const all = current.all,
    bus = current.bus
  act(() => {
    current.bus.setHoverGhost(7)
    current.bus.setFocusRoute('TBS-IST')
  })
  await advance()
  expect(saver).not.toHaveBeenCalled()
  act(() => current.actions.add('airlines', 'TK'))
  await advance()
  const scope = current.scope
  view.rerender(
    <OverviewProvider
      payload={payload}
      prefs={DEFAULT_PREFS}
      ownerKey="owner"
      locale="ru"
      saver={saver}
      live={false}
    >
      <Capture />
    </OverviewProvider>,
  )
  expect(current.locale).toBe('ru')
  expect(current.filter).toEqual({ airlines: ['TK'] })
  expect(current.scope).toBe(scope)
  expect(current.all).toBe(all)
  expect(current.bus).toBe(bus)
  expect(current.bus.getSnapshot().hoverGhost).toBe(7)
})
it('default saver uses the existing API transport with an abortable private operation', async () => {
  vi.useFakeTimers()
  auth.put.mockImplementation(async (_path, prefs) => prefs)
  mount()
  act(() => current.actions.add('airlines', 'TK'))
  await advance()
  expect(api.put).toHaveBeenCalledWith(
    '/api/me/overview/prefs',
    expect.objectContaining({ filter: { airlines: ['TK'] } }),
    { signal: expect.any(AbortSignal) },
  )
})
it('data revalidation publishes a new scope, preserves 304/errors and detaches on reset', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ ...payload, etag: 'W/"ov3-owner-2-0"', rows: payload.rows.slice(0, 1) }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 304 }))
    .mockRejectedValueOnce(new Error('offline'))
  vi.stubGlobal('fetch', fetcher)
  mount(undefined, true)
  const all = current.all
  await act(async () => {
    await current.revalidate()
  })
  expect(current.scope?.figures.flights).toBe(1)
  expect(current.all).not.toBe(all)
  const updated = current.all
  await act(async () => {
    await current.revalidate()
    await current.revalidate()
  })
  expect(current.all).toBe(updated)
  act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
  expect(screen.queryByRole('status')).toBeNull()
  act(() => {
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(fetcher).toHaveBeenCalledTimes(3)
})
it.each(['reset', 'generation', 'owner', 'timeout'])(
  'raw private data cannot publish after %s while its body is pending',
  async (boundary) => {
    const body = deferred<OverviewPayload>()
    const timeout = new AbortController()
    if (boundary === 'timeout') vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    const response = Response.json(payload)
    response.json = () => body.promise
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetcher)
    const view = mount(undefined, true)
    let pending!: ReturnType<typeof current.revalidate>
    await act(async () => {
      pending = current.revalidate()
      await Promise.resolve()
    })
    const signal = fetcher.mock.calls[0][1]?.signal
    if (boundary === 'owner')
      view.rerender(
        <OverviewProvider payload={payload} prefs={DEFAULT_PREFS} ownerKey="other" locale="en" live>
          <Capture />
        </OverviewProvider>,
      )
    else if (boundary === 'reset')
      act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
    else if (boundary === 'timeout') timeout.abort()
    else advanceAuthGeneration()
    await act(async () => {
      body.resolve({ ...payload, etag: 'W/"ov3-owner-3-0"', rows: [] })
      expect(await pending).toBe('failed')
    })
    expect(current.payload?.etag).toBe(payload.etag)
    expect(current.all?.figures.flights).toBe(10)
    if (boundary !== 'generation') expect(signal?.aborted).toBe(true)
  },
)
it('fixture mode and noop saver make no production preference or data requests', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetcher)
  render(
    <OverviewProvider
      payload={payload}
      prefs={DEFAULT_PREFS}
      ownerKey="dev"
      locale="en"
      live={false}
      saver={async (prefs) => prefs}
    >
      <Capture />
    </OverviewProvider>,
  )
  act(() => current.actions.add('airlines', 'TK'))
  await advance()
  act(() => {
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))
  })
  await current.revalidate()
  expect(fetcher).not.toHaveBeenCalled()
  expect(api.put).not.toHaveBeenCalled()
})
it('UI bus snapshots are stable, no-op setters do not notify, and unsubscribe works', () => {
  const bus = createUIBus(),
    other = createUIBus(),
    initial = bus.getSnapshot(),
    notify = vi.fn()
  const stop = bus.subscribe(notify)
  expect(bus.getServerSnapshot()).toBe(initial)
  expect(bus.getSnapshot()).toBe(initial)
  bus.setHoverRoute(null)
  expect(notify).not.toHaveBeenCalled()
  bus.setHoverGhost(7)
  const updated = bus.getSnapshot()
  expect(updated).not.toBe(initial)
  expect(bus.getSnapshot()).toBe(updated)
  expect(bus.getServerSnapshot()).toBe(initial)
  expect(other.getSnapshot().hoverGhost).toBeNull()
  bus.setHoverGhost(7)
  expect(notify).toHaveBeenCalledTimes(1)
  stop()
  bus.setFocusRoute('TBS-IST')
  expect(notify).toHaveBeenCalledTimes(1)
})
it('two same-owner providers isolate hover/focus subscriptions', () => {
  const buses: ReturnType<typeof useOverview>['bus'][] = []
  function Subscriber({ index }: { index: number }) {
    const bus = useOverview().bus
    useEffect(() => {
      buses[index] = bus
    }, [index, bus])
    const ui = useOverviewUI()
    return <output data-testid={`bus-${index}`}>{ui.hoverRoute ?? 'none'}</output>
  }
  render(
    <>
      {[0, 1].map((index) => (
        <OverviewProvider
          key={index}
          payload={payload}
          prefs={DEFAULT_PREFS}
          ownerKey="owner"
          locale="en"
          live={false}
        >
          <Subscriber index={index} />
        </OverviewProvider>
      ))}
    </>,
  )
  act(() => buses[0].setHoverRoute('TBS-IST'))
  expect(screen.getByTestId('bus-0').textContent).toBe('TBS-IST')
  expect(screen.getByTestId('bus-1').textContent).toBe('none')
})

function URLControls() {
  const open = useOpenFlight(),
    [metric, setMetric] = useMakerMetric()
  return (
    <>
      <main>
        <h1 tabIndex={-1}>Overview</h1>
        <button onClick={() => open(7)}>open</button>
        <svg
          role="button"
          aria-label="chart opener"
          tabIndex={0}
          onClick={() => open(7)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') open(7)
          }}
        />
        <button
          onClick={() => {
            for (const id of [0, -1, 1.5, NaN, Infinity, 9007199254740992]) open(id)
          }}
        >
          invalid open
        </button>
        <button
          onClick={() => {
            setMetric('hours')
            open(7)
            setMetric('km')
          }}
        >
          rapid
        </button>
        <button onClick={() => setMetric('flights')}>flights</button>
        <button onClick={() => setMetric('hours')}>hours</button>
        <output data-testid="metric">{metric}</output>
      </main>
      <OverviewFlightSheet />
    </>
  )
}
function urlView(ownerKey = 'owner', data = payload, live = false) {
  const element = () => (
    <OverviewProvider
      payload={data}
      prefs={DEFAULT_PREFS}
      ownerKey={ownerKey}
      locale="en"
      live={live}
      saver={async (prefs) => prefs}
    >
      <Capture />
      <URLControls />
    </OverviewProvider>
  )
  const view = render(element())
  return {
    ...view,
    navigate(target: string, traverse = false) {
      const url = new URL(target, window.location.href)
      auth.pathname = url.pathname
      auth.query = url.search.slice(1)
      window.history.replaceState(null, '', target)
      if (traverse) act(() => window.dispatchEvent(new PopStateEvent('popstate')))
      view.rerender(element())
    },
  }
}
it('rapid flight and maker changes compose, preserve repeated query/hash and never save prefs', async () => {
  vi.useFakeTimers()
  auth.pathname = '/dev/overview'
  auth.query = 'tag=a&tag=b&makers=invalid'
  window.history.replaceState(null, '', '/dev/overview?tag=a&tag=b&makers=invalid#rankings')
  urlView()
  expect(screen.getByTestId('metric').textContent).toBe('flights')
  act(() => screen.getByText('rapid').click())
  expect(window.history.pushState).toHaveBeenLastCalledWith(
    null,
    '',
    '/dev/overview?tag=a&tag=b&makers=hours&flight=7#rankings',
  )
  expect(window.history.replaceState).toHaveBeenLastCalledWith(
    null,
    '',
    '/dev/overview?tag=a&tag=b&makers=km&flight=7#rankings',
  )
  act(() => screen.getByRole('button', { name: 'flights' }).click())
  expect(window.history.replaceState).toHaveBeenLastCalledWith(
    null,
    '',
    '/dev/overview?tag=a&tag=b&flight=7#rankings',
  )
  await advance()
  expect(api.put).not.toHaveBeenCalled()
})
it('an intermediate URL commit does not discard a more recent requested change', () => {
  const view = urlView()
  act(() => screen.getByText('rapid').click())
  view.navigate('/overview?makers=hours')
  act(() => screen.getByRole('button', { name: 'flights' }).click())
  expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '/overview?flight=7')
})
it.each(['aggregate', 'dev'])(
  '%s prevents both opening and a direct flight private read',
  (mode) => {
    auth.query = 'flight=7'
    urlView(
      mode === 'dev' ? 'dev' : 'owner',
      mode === 'aggregate' ? ({ ...payload, mode: 'aggregate' } as OverviewPayload) : payload,
    )
    act(() => {
      screen.getByText('open').focus()
      screen.getByText('open').click()
    })
    expect(window.history.pushState).not.toHaveBeenCalled()
    expect(auth.getFlight).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  },
)
it.each(['0', '-1', '1.5', '9007199254740992', 'foo', '1e2', ''])(
  'invalid direct flight %s cannot start a private read',
  (raw) => {
    auth.query = `flight=${raw}`
    urlView()
    expect(auth.getFlight).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  },
)
it('Back/Forward updates metric and sheet, restores the opener and revalidates the retained store on close', async () => {
  auth.getFlight.mockResolvedValue({
    id: 7,
    date: '2026-10-05',
    origin: 'TBS',
    destination: 'IST',
    airline_iata: 'TK',
    aircraft_icao: 'B738',
    flight_number: 'TK123',
    lifecycle_state: 'logged',
  })
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ ...payload, etag: 'W/"ov3-owner-4-0"', rows: payload.rows.slice(0, 1) }),
    )
  vi.stubGlobal('fetch', fetcher)
  const view = urlView('owner', payload, true)
  const opener = screen.getByText('open')
  act(() => {
    opener.focus()
    opener.click()
  })
  view.navigate('/overview?tag=a&tag=b&flight=7&makers=km#fleet')
  await screen.findByRole('article', { name: /TBS.*IST/ })
  expect(auth.getFlight).toHaveBeenCalledWith(
    7,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
  expect(screen.getByTestId('metric').textContent).toBe('km')
  await userEvent.click(screen.getByRole('button', { name: 'Close flight' }))
  expect(window.history.replaceState).toHaveBeenLastCalledWith(
    null,
    '',
    '/overview?tag=a&tag=b&makers=km#fleet',
  )
  view.navigate('/overview?tag=a&tag=b&makers=km#fleet')
  await waitFor(() => expect(opener).toHaveFocus())
  await waitFor(() => expect(current.scope?.figures.flights).toBe(1))
  expect(fetcher).toHaveBeenCalledTimes(1)
  view.navigate('/overview?makers=hours&flight=7', true)
  await screen.findByRole('article', { name: /TBS.*IST/ })
  expect(screen.getByTestId('metric').textContent).toBe('hours')
  view.navigate('/overview', true)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Overview' })).toHaveFocus())
  expect(screen.getByTestId('metric').textContent).toBe('flights')
})
it('a foreign/missing flight stays an error without displaying private content', async () => {
  auth.query = 'flight=7'
  auth.getFlight.mockRejectedValue(new Error('not found'))
  urlView()
  await screen.findByRole('alert')
  expect(screen.queryByRole('article')).toBeNull()
})
it('confirmed sheet deletion closes and revalidates Overview instead of navigating to Journal', async () => {
  auth.query = 'flight=7'
  auth.getFlight.mockResolvedValue({
    id: 7,
    date: '2026-10-05',
    origin: 'TBS',
    destination: 'IST',
    lifecycle_state: 'logged',
  })
  auth.remove.mockResolvedValue({ derived_state: 'ready' })
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ ...payload, etag: 'W/"ov3-owner-5-0"', rows: [] }))
  vi.stubGlobal('fetch', fetcher)
  const view = urlView('owner', payload, true)
  await screen.findByRole('button', { name: 'Edit flight' })
  await userEvent.click(screen.getByRole('button', { name: 'Delete flight' }))
  const confirmation = await screen.findByRole('dialog', { name: 'Delete TBS → IST, Oct 5, 2026?' })
  await userEvent.click(within(confirmation).getByRole('button', { name: 'Delete flight' }))
  await waitFor(() => expect(auth.remove).toHaveBeenCalledWith(7))
  expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '/overview')
  view.navigate('/overview')
  await waitFor(() => expect(current.scope?.figures.flights).toBe(0))
  expect(window.history.pushState).not.toHaveBeenCalled()
})

it('identity reset retires an open sheet and cannot admit a later private read', async () => {
  auth.query = 'flight=7'
  const result = deferred<never>()
  auth.getFlight.mockReturnValue(result.promise)
  urlView()
  await waitFor(() => expect(auth.getFlight).toHaveBeenCalledTimes(1))
  const signal = auth.getFlight.mock.calls[0][1].signal as AbortSignal
  act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
  expect(signal.aborted).toBe(true)
  expect(screen.queryByRole('dialog')).toBeNull()
  await act(async () => result.reject(new Error('old account')))
  expect(announceShellNotice).not.toHaveBeenCalled()
})

it('invalid opener IDs do not navigate', () => {
  urlView()
  act(() => screen.getByText('invalid open').click())
  expect(window.history.pushState).not.toHaveBeenCalled()
  expect(auth.getFlight).not.toHaveBeenCalled()
})
it('SSR and hydration begin with a stable null UI bus and no private requests', async () => {
  function Snapshot() {
    const ui = useOverviewUI()
    return <output>{JSON.stringify(ui)}</output>
  }
  const element = (
    <OverviewProvider
      payload={payload}
      prefs={DEFAULT_PREFS}
      ownerKey="owner"
      locale="en"
      live={false}
    >
      <Snapshot />
    </OverviewProvider>
  )
  const fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetcher)
  const html = renderToString(element)
  const container = document.createElement('div')
  document.body.appendChild(container)
  container.innerHTML = html
  const errors = vi.spyOn(console, 'error')
  render(element, { container, hydrate: true })
  expect(container.textContent).toBe(
    '{"hoverRoute":null,"hoverGhost":null,"focusRoute":null,"replayStarted":false}',
  )
  expect(fetcher).not.toHaveBeenCalled()
  expect(api.put).not.toHaveBeenCalled()
  expect(errors).not.toHaveBeenCalled()
})

it('lifecycle publication refreshes the retained scope without a router refresh', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ ...payload, etag: 'W/"ov3-owner-6-0"', rows: [] }))
  vi.stubGlobal('fetch', fetcher)
  mount(undefined, true)
  await act(async () => {
    window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))
    await current.revalidate()
  })
  expect(current.all?.figures.flights).toBe(0)
  expect(auth.refresh).not.toHaveBeenCalled()
})

it('hash-only navigation becomes the base for later metric changes', () => {
  const view = urlView()
  view.navigate('/overview#fleet')
  act(() => window.dispatchEvent(new HashChangeEvent('hashchange')))
  act(() => screen.getByRole('button', { name: 'hours' }).click())
  expect(window.history.replaceState).toHaveBeenLastCalledWith(
    null,
    '',
    '/overview?makers=hours#fleet',
  )
})

it('a disappeared opener falls back to the heading, and a late sheet response cannot steal focus', async () => {
  const result = deferred<never>()
  auth.getFlight.mockReturnValue(result.promise)
  const view = urlView()
  const opener = screen.getByText('open')
  act(() => {
    opener.focus()
    opener.click()
  })
  view.navigate('/overview?flight=7')
  await waitFor(() => expect(auth.getFlight).toHaveBeenCalledTimes(1))
  opener.remove()
  await userEvent.click(screen.getByRole('button', { name: 'Close flight' }))
  view.navigate('/overview')
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Overview' })).toHaveFocus())
  const other = screen.getByRole('button', { name: 'hours' })
  act(() => other.focus())
  await act(async () => result.reject(new Error('late read')))
  expect(other).toHaveFocus()
})

it('restores an actual focused SVG chart opener', async () => {
  auth.getFlight.mockResolvedValue({
    id: 7,
    date: '2026-10-05',
    origin: 'TBS',
    destination: 'IST',
    lifecycle_state: 'logged',
  })
  const view = urlView()
  const opener = screen.getByRole('button', { name: 'chart opener' })
  act(() => {
    opener.focus()
    opener.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  expect(document.activeElement).toBe(opener)
  view.navigate('/overview?flight=7')
  await screen.findByRole('button', { name: 'Edit flight' })
  await userEvent.click(screen.getByRole('button', { name: 'Close flight' }))
  view.navigate('/overview')
  await waitFor(() => expect(opener).toHaveFocus())
})

it('same-owner incoming privacy changes survive the next full PUT without a mount or prop-only save', async () => {
  vi.useFakeTimers()
  const saver = vi.fn(async (prefs: OverviewPrefs) => prefs)
  const initialPrefs = { ...DEFAULT_PREFS, publicSections: { records: true, fleet: true } }
  const view = render(
    <OverviewProvider
      payload={payload}
      prefs={initialPrefs}
      ownerKey="owner"
      locale="en"
      saver={saver}
      live={false}
    >
      <Capture />
    </OverviewProvider>,
  )
  act(() => current.actions.add('airlines', 'TK'))
  await advance()
  view.rerender(
    <OverviewProvider
      payload={payload}
      prefs={DEFAULT_PREFS}
      ownerKey="owner"
      locale="en"
      saver={saver}
      live={false}
    >
      <Capture />
    </OverviewProvider>,
  )
  await advance()
  expect(saver).toHaveBeenCalledTimes(1)
  expect(current.filter).toEqual({ airlines: ['TK'] })
  act(() => current.setReplayPaused(true))
  await advance()
  expect(saver.mock.calls[1][0].publicSections).toEqual({ records: false, fleet: false })
})

// Uses the real account orchestration and generation authority; failure never resets the provider.
async function rejectSignout() {
  const generation = getAuthGeneration()
  await expect(
    withIdentityMutation(
      (token) => api.post('/api/auth/signout', {}, { identityToken: token }),
      '/signin',
    ),
  ).rejects.toThrow('signout failed')
  expect(getAuthGeneration()).toBe(generation + 1)
}
function accountReply(input: RequestInfo | URL) {
  if (input === '/api/auth/me') return Response.json({ user: { id: 'owner' } })
  if (input === '/api/auth/signout')
    return Response.json({ error: 'signout failed' }, { status: 500 })
  throw new Error(`Unexpected request: ${input}`)
}
it.each(['resolve', 'reject'])(
  'failed real signout rejects old read/save %s and pending edits, then serializes new same-owner work',
  async (completion) => {
    vi.useFakeTimers()
    const oldSave = deferred<OverviewPrefs>(),
      oldBody = deferred<OverviewPayload>()
    const response = Response.json(payload)
    response.json = () => oldBody.promise
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        input === '/api/me/overview/data' ? response : accountReply(input),
      )
    vi.stubGlobal('fetch', fetcher)
    const saver = vi
      .fn<(prefs: OverviewPrefs, signal: AbortSignal) => Promise<OverviewPrefs>>()
      .mockReturnValueOnce(oldSave.promise)
      .mockImplementation(async (prefs) => prefs)
    mount(saver, true)
    act(() => current.actions.add('airlines', 'TK'))
    await advance()
    act(() => current.actions.add('countries', 'JP'))
    await advance()
    let pending!: ReturnType<typeof current.revalidate>
    await act(async () => {
      pending = current.revalidate()
      await Promise.resolve()
    })
    await act(rejectSignout)
    act(() => current.setReplayPaused(true))
    await advance()
    expect(saver.mock.calls[0][1].aborted).toBe(true)
    await act(async () => {
      oldBody.resolve({ ...payload, etag: 'W/"ov3-owner-9-0"', rows: [] })
      expect(await pending).toBe('failed')
    })
    expect(current.payload).toBe(payload)
    expect(saver).toHaveBeenCalledTimes(1) // Abort cannot authorize an overlapping endpoint write.
    await act(async () =>
      completion === 'resolve'
        ? oldSave.resolve(DEFAULT_PREFS)
        : oldSave.reject(new Error('late old failure')),
    )
    expect(saver).toHaveBeenCalledTimes(2)
    expect(saver.mock.calls[1][0]).toMatchObject({
      filter: { airlines: ['TK'], countries: ['JP'] },
      replayPaused: true,
    })
    expect(current.filter).toEqual({ airlines: ['TK'], countries: ['JP'] })
    expect(announceShellNotice).not.toHaveBeenCalled()
    fetcher.mockImplementation(async (input) =>
      input === '/api/me/overview/data'
        ? Response.json({ ...payload, etag: 'W/"ov3-owner-10-0"', rows: payload.rows.slice(0, 1) })
        : accountReply(input),
    )
    await act(async () => {
      expect(await current.revalidate()).toBe('updated')
    })
    expect(current.all?.figures.flights).toBe(1)
  },
)
it.each([false, true])(
  'failed real signout drops an old queued snapshot without a new edit (in-flight: %s)',
  async (inFlight) => {
    vi.useFakeTimers()
    const oldSave = deferred<OverviewPrefs>()
    const saver = vi
      .fn<(prefs: OverviewPrefs, signal: AbortSignal) => Promise<OverviewPrefs>>()
      .mockReturnValue(oldSave.promise)
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input) => accountReply(input)),
    )
    mount(saver)
    act(() => current.actions.add('airlines', 'TK'))
    if (inFlight) {
      await advance()
      act(() => current.actions.add('countries', 'JP'))
      await advance()
    }
    await act(rejectSignout)
    await act(async () => oldSave.resolve(DEFAULT_PREFS))
    await advance(2000)
    expect(saver).toHaveBeenCalledTimes(inFlight ? 1 : 0)
    expect(current.isCurrent()).toBe(true)
  },
)
it('failed real signout keeps metric, flight URL and real sheet close usable; actual reset retires them', async () => {
  auth.getFlight.mockResolvedValue({
    id: 7,
    date: '2026-10-05',
    origin: 'TBS',
    destination: 'IST',
    lifecycle_state: 'logged',
  })
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (input) =>
      input === '/api/me/overview/data'
        ? Response.json({ ...payload, etag: 'W/"ov3-owner-2-0"', rows: [] })
        : accountReply(input),
    )
  vi.stubGlobal('fetch', fetcher)
  const view = urlView('owner', payload, true)
  await act(rejectSignout)
  act(() => screen.getByText('hours').click())
  expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '/overview?makers=hours')
  act(() => screen.getByText('open').click())
  expect(window.history.pushState).toHaveBeenLastCalledWith(
    null,
    '',
    '/overview?makers=hours&flight=7',
  )
  view.navigate('/overview?makers=hours&flight=7')
  await screen.findByRole('button', { name: 'Edit flight' })
  await userEvent.click(screen.getByRole('button', { name: 'Close flight' }))
  expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '/overview?makers=hours')
  view.navigate('/overview?makers=hours')
  await waitFor(() => expect(current.all?.figures.flights).toBe(0))
  const requests = fetcher.mock.calls.length
  act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
  expect(screen.queryByText('open')).toBeNull()
  expect(current.isCurrent()).toBe(false)
  expect(await current.revalidate()).toBe('unchanged')
  expect(fetcher).toHaveBeenCalledTimes(requests)
})
it.each([
  ['owner', 'W/"ov3-other-2-0"'],
  ['owner', 'W/"ov4-day-other-2-0"'],
  ['owner-a', 'W/"ov4-day-owner-a-1-2-0"'],
  ['owner/a-b', 'W/"ov4-day-owner/a-b-2-0"'],
  ['owner', 'W/"ov4-day-owner-2-invalid"'],
  ['owner-a', 'W/"ov3-owner-a-1-2-0"'],
  ['owner/a-b', 'W/"ov3-owner/a-b-2-0"'],
  ['owner', 'W/"ov3-owner-2-invalid"'],
  ['owner', 'W/"ov3-owner--2-0"'],
  ['owner', 'W/"ov3-owner-2-0-extra"'],
  ['owner', undefined],
])(
  'raw refresh retains %s data when response owner/revisions are unproven (%s), then recovers',
  async (ownerKey, etag) => {
    const initial = { ...payload, etag: `W/"ov3-${encodeURIComponent(ownerKey)}-1-0"` }
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ...payload, etag, rows: [] }))
      .mockResolvedValueOnce(
        Response.json({
          ...payload,
          etag: `W/"ov4-day-${encodeURIComponent(ownerKey)}-2-0"`,
          rows: payload.rows.slice(0, 1),
        }),
      )
    vi.stubGlobal('fetch', fetcher)
    render(
      <OverviewProvider
        payload={initial}
        prefs={DEFAULT_PREFS}
        ownerKey={ownerKey}
        locale="en"
        live
      >
        <Capture />
      </OverviewProvider>,
    )
    const generation = getAuthGeneration(),
      all = current.all
    await act(async () => {
      expect(await current.revalidate()).toBe('failed')
    })
    expect(getAuthGeneration()).toBe(generation)
    expect(current.ownerKey).toBe(ownerKey)
    expect(current.payload).toBe(initial)
    expect(current.all).toBe(all)
    expect(screen.getByRole('status').textContent).toBe('10')
    expect(announceShellNotice).not.toHaveBeenCalled()
    await act(async () => {
      expect(await current.revalidate()).toBe('updated')
    })
    expect(current.all?.figures.flights).toBe(1)
  },
)

it('rejects a body admitted before failed real signout advances generation at the store publication boundary, then recovers', async () => {
  const create = dataStores.createOverviewDataStore
  let store!: dataStores.OverviewDataStore
  vi.spyOn(dataStores, 'createOverviewDataStore').mockImplementation((...args) => {
    store = create(...args)
    return store
  })
  const body = deferred<OverviewPayload>(),
    response = Response.json(payload)
  response.json = () => body.promise
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (input) =>
      input === '/api/me/overview/data' ? response : accountReply(input),
    )
  vi.stubGlobal('fetch', fetcher)
  mount(undefined, true)
  const all = current.all,
    scope = current.scope,
    generation = getAuthGeneration()
  const notified = vi.fn()
  store.subscribe(notified)
  let admittedGeneration: number | undefined
  await act(async () => {
    const pending = current.revalidate()
    for (let i = 0; i < 3; i++) await Promise.resolve()
    const signout = withIdentityMutation(
      (token) => api.post('/api/auth/signout', {}, { identityToken: token }),
      '/signin',
    ).catch((error) => error)
    for (let i = 0; i < 4; i++) await Promise.resolve()
    body.resolve({
      ...payload,
      rows: [],
      get etag() {
        admittedGeneration ??= getAuthGeneration()
        return 'W/"ov3-owner-2-0"'
      },
    })
    const outcome = await pending
    expect(await signout).toMatchObject({ message: 'signout failed' })
    expect(admittedGeneration).toBe(generation)
    expect(getAuthGeneration()).toBe(generation + 1)
    expect(outcome).toBe('failed')
  })
  expect(store.get()).toBe(payload)
  expect(current.payload).toBe(payload)
  expect(current.all).toBe(all)
  expect(current.scope).toBe(scope)
  expect(notified).not.toHaveBeenCalled()
  fetcher.mockImplementation(async (input) =>
    input === '/api/me/overview/data'
      ? Response.json({ ...payload, etag: 'W/"ov3-owner-3-0"', rows: payload.rows.slice(0, 1) })
      : accountReply(input),
  )
  await act(async () => {
    expect(await current.revalidate()).toBe('updated')
  })
  expect(current.all?.figures.flights).toBe(1)
  expect(notified).toHaveBeenCalledTimes(1)
})

it.each(['reset', 'owner', 'timeout'])(
  'rejects %s between JSON admission and store publication without notifying',
  async (boundary) => {
    const create = dataStores.createOverviewDataStore
    let store!: dataStores.OverviewDataStore
    vi.spyOn(dataStores, 'createOverviewDataStore').mockImplementation((...args) => {
      store = create(...args)
      return store
    })
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    const body = deferred<OverviewPayload>(),
      response = Response.json(payload)
    response.json = () => body.promise
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response))
    const view = mount(undefined, true),
      originalStore = store
    const all = dataStores.scopeFor(originalStore, {}),
      notified = vi.fn()
    originalStore.subscribe(notified)
    let admitted = false
    await act(async () => {
      const pending = current.revalidate()
      for (let i = 0; i < 3; i++) await Promise.resolve()
      body.resolve({
        ...payload,
        rows: [],
        get etag() {
          admitted = true
          return 'W/"ov3-owner-2-0"'
        },
      })
      // The JSON producer runs first; the store continuation has not consumed its result yet.
      await Promise.resolve()
      expect(admitted).toBe(true)
      if (boundary === 'reset') window.dispatchEvent(new Event('kuuki:identity-reset'))
      else if (boundary === 'timeout') timeout.abort()
      else
        flushSync(() =>
          view.rerender(
            <OverviewProvider
              payload={payload}
              prefs={DEFAULT_PREFS}
              ownerKey="other"
              locale="en"
              live
            >
              <Capture />
            </OverviewProvider>,
          ),
        )
      expect(await pending).toBe('failed')
    })
    expect(originalStore.get()).toBe(payload)
    expect(dataStores.scopeFor(originalStore, {})).toBe(all)
    expect(notified).not.toHaveBeenCalled()
  },
)
