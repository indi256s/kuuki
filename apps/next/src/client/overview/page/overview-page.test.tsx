// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import { aggregateRows } from '@kuuki/shared/overview/aggregate'
import board from '../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { OverviewPage } from './overview-page'

vi.mock('next/navigation', () => ({ usePathname: () => '/dev/overview', useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
const payload = board as OverviewPayload
const saver = async (prefs: typeof DEFAULT_PREFS) => prefs
beforeEach(() => vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('saved exact-day preferences show unavailable monthly detail and recover after a real day-payload refresh', async () => {
  const rows = [{ ...payload.rows[0], id: 1, date: '2024-03-01', state: 'logged' as const },
    { ...payload.rows[0], id: 2, date: '2024-03-02', state: 'logged' as const }]
  const legacy: OverviewPayload = { ...payload, mode: 'aggregate', etag: 'W/"ov3-range-owner-1-0"', rows: aggregateRows(rows) }
  const daily: OverviewPayload = { ...legacy, aggregateResolution: 'day', etag: 'W/"ov4-day-range-owner-1-0"', rows: aggregateRows(rows, 'day') }
  const prefs = { ...structuredClone(DEFAULT_PREFS), filter: { period: { from: '2024-03-02', to: '2024-03-02' } } }
  const save = vi.fn(saver), fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(daily))
  vi.stubGlobal('fetch', fetcher)
  render(<OverviewPage payload={legacy} prefs={prefs} ownerKey="range-owner" name="" locale="en" live={true} saver={save} />)
  expect(screen.getByRole('alert')).toHaveTextContent('This older summary has no exact-day detail.')
  expect(screen.queryByRole('region', { name: 'Totals for the period' })).toBeNull()
  expect(screen.queryByText('Loading overview')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Import flights' })).toBeNull()
  expect(save).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Try again' })))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  expect(within(screen.getByRole('region', { name: 'Totals for the period' })).getByLabelText('Flights')).toHaveTextContent('1')
  expect(fetcher.mock.calls.filter(call => String(call[0]) === '/api/me/overview/data')).toHaveLength(1)
  expect(save).not.toHaveBeenCalled()
})

it('lets the owner clear a kept reference after revalidation removes the last flight', async () => {
  const one: OverviewPayload = { ...payload, rows: [payload.rows[0]], etag: 'W/"ov3-last-owner-1-0"', derivedReady: true,
    passport: { ...payload.passport, countries: 0, countryCodes: [], regions: 0 } }
  const empty: OverviewPayload = { ...one, rows: [], etag: 'W/"ov3-last-owner-2-0"' }
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(Response.json(empty)))
  render(<OverviewPage payload={one} prefs={DEFAULT_PREFS} ownerKey="last-owner" name="" locale="en" live={true} saver={saver} />)
  fireEvent.click(screen.getByRole('button', { name: 'Keep for comparison' }))
  await act(async () => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(screen.getByRole('region', { name: 'Compare chapters' })).toHaveTextContent('The reference has no flights'))
  expect(screen.getByRole('link', { name: 'Import flights' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Clear comparison' }))
  expect(screen.queryByRole('region', { name: 'Compare chapters' })).toBeNull()
})
