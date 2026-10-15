// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import { aggregateRows } from '@kuuki/shared/overview/aggregate'
import board from '../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { OverviewPage } from './overview-page'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dev/overview',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
const payload = board as OverviewPayload
const saver = async (prefs: typeof DEFAULT_PREFS) => prefs
beforeEach(() =>
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  ),
)
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('saved exact-day preferences show unavailable monthly detail and recover after a real day-payload refresh', async () => {
  const rows = [
    { ...payload.rows[0], id: 1, date: '2024-03-01', state: 'logged' as const },
    { ...payload.rows[0], id: 2, date: '2024-03-02', state: 'logged' as const },
  ]
  const legacy: OverviewPayload = {
    ...payload,
    mode: 'aggregate',
    etag: 'W/"ov3-range-owner-1-0"',
    rows: aggregateRows(rows),
  }
  const daily: OverviewPayload = {
    ...legacy,
    aggregateResolution: 'day',
    etag: 'W/"ov5-day-range-owner-1-0"',
    rows: aggregateRows(rows, 'day'),
  }
  const prefs = {
    ...structuredClone(DEFAULT_PREFS),
    filter: { period: { from: '2024-03-02', to: '2024-03-02' } },
  }
  const save = vi.fn(saver),
    fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(daily))
  vi.stubGlobal('fetch', fetcher)
  render(
    <OverviewPage
      payload={legacy}
      prefs={prefs}
      ownerKey="range-owner"
      name=""
      locale="en"
      live={true}
      saver={save}
    />,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('This summary has no exact dates.')
  expect(screen.queryByRole('region', { name: 'Totals for the period' })).toBeNull()
  expect(screen.queryByText('Loading overview')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Import flights' })).toBeNull()
  expect(save).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Try again' })))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  expect(
    within(screen.getByRole('region', { name: 'Totals for the period' })).getByLabelText('Flights'),
  ).toHaveTextContent('1')
  expect(
    fetcher.mock.calls.filter((call) => String(call[0]) === '/api/me/overview/data'),
  ).toHaveLength(1)
  expect(save).not.toHaveBeenCalled()
})

it('shows the first-run state after revalidation removes the last flight', async () => {
  const one: OverviewPayload = {
    ...payload,
    rows: [payload.rows[0]],
    etag: 'W/"ov3-last-owner-1-0"',
    derivedReady: true,
    passport: {
      ...payload.passport,
      countries: 0,
      countryCodes: [],
      regions: 0,
    },
  }
  const empty: OverviewPayload = {
    ...one,
    rows: [],
    etag: 'W/"ov3-last-owner-2-0"',
  }
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(Response.json(empty)))
  render(
    <OverviewPage
      payload={one}
      prefs={DEFAULT_PREFS}
      ownerKey="last-owner"
      name=""
      locale="en"
      live={true}
      saver={saver}
    />,
  )
  await act(async () => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(screen.getByRole('link', { name: 'Import flights' })).toBeVisible())
})

it('omits unavailable chapters without a goal band, keeping the saved layout', async () => {
  const few: OverviewPayload = {
    ...payload,
    rows: payload.rows.slice(0, 4).map((row, index) => ({ ...row, id: index + 1, weight: 1 })),
    etag: 'W/"ov3-few-owner-1-0"',
  }
  const save = vi.fn(saver)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })),
  )
  const { container } = render(
    <OverviewPage
      payload={few}
      prefs={DEFAULT_PREFS}
      ownerKey="few-owner"
      name=""
      locale="en"
      live={true}
      saver={save}
    />,
  )
  await screen.findByRole('heading', { level: 1 })
  expect(screen.queryByRole('region', { name: 'Next up' })).toBeNull()
  expect(container.querySelector('[data-section="routes"]')).toBeNull()
  expect(container.querySelector('[data-section="records"]')).not.toBeNull()
  expect(save).not.toHaveBeenCalled()
})

it('keeps a chapter in the grid when only the filter drops it below its gate', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })),
  )
  const { container } = render(
    <OverviewPage
      payload={payload}
      prefs={{ ...DEFAULT_PREFS, filter: { airlines: ['BA'] } }}
      ownerKey="gate-owner"
      name=""
      locale="en"
      live={true}
      saver={saver}
    />,
  )
  await screen.findByRole('heading', { level: 1 })
  const order = [...container.querySelectorAll('[data-surface="sections"] > [data-section]')].map(
    (node) => node.getAttribute('data-section'),
  )
  expect(order).toEqual(DEFAULT_PREFS.layout.order)
})

it('renders no aviation chapter under the ground scope', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })),
  )
  const ground: OverviewPayload = {
    ...payload,
    ground: [
      {
        id: 'g1',
        mode: 'rail',
        status: 'completed',
        startDate: '2024-05-01',
        endDate: null,
        runs: [
          [
            [13.4, 52.5],
            [11.6, 48.1],
          ],
        ],
        countries: ['DE'],
        distanceKm: 500,
      },
    ],
  }
  const { container } = render(
    <OverviewPage
      payload={ground}
      prefs={{ ...DEFAULT_PREFS, filter: { scope: 'ground' } }}
      ownerKey="ground-owner"
      name=""
      locale="en"
      live={true}
      saver={saver}
    />,
  )
  await screen.findByRole('heading', { level: 1 })
  expect(container.querySelector('[data-section]')).toBeNull()
  expect(container.querySelector('[data-surface]')).toBeNull()
})

it('reads mobile controls and facts before the map while upcoming bookings remain global in a filtered scope', () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(max-width: 700px)',
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })),
  )
  const { container } = render(
    <OverviewPage
      payload={payload}
      prefs={{ ...DEFAULT_PREFS, filter: { period: { years: [2025] } } }}
      ownerKey="mobile-order-owner"
      name="Aviator"
      locale="en"
      live={false}
      saver={saver}
    />,
  )
  const heading = screen.getByRole('heading', { level: 1, name: 'Overview' })
  expect(heading).toHaveAttribute('tabindex', '-1')
  const next = screen.getByRole('button', { name: /^Open flight/ })
  const controls = screen.getByLabelText('Overview filters')
  const facts = screen.getByRole('region', { name: 'Totals for the period' })
  const map = screen.getByRole('region', { name: 'Places by air' })
  for (const [before, after] of [
    [next, controls],
    [controls, facts],
    [facts, map],
  ]) {
    expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
  expect(screen.getByRole('link', { name: /more booked/ })).toHaveAttribute(
    'href',
    '/journal?status=upcoming',
  )
  expect(container.querySelectorAll('[aria-label="Overview filters"]')).toHaveLength(1)
})
