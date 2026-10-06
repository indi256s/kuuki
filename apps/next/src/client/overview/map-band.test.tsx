// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectedPair, RouteProjection } from '@kuuki/shared'
import { BUCKET_LABELS, BUCKET_TOKENS } from '../../lib/map-buckets'
import { busySummary, fakeLabels } from './fixtures'

const mocks = vi.hoisted(() => ({ get: vi.fn(), refresh: vi.fn() }))
vi.mock('../../../../web/src/lib/apiClient', () => ({ api: { get: mocks.get } }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }) }))
import { OverviewMap } from './map-band'

// Seven undirected pairs with known positions: the busy fixture's `map.routeCount`.
const airports: Record<string, [number, number]> = { TBS: [44.95, 41.67], IST: [28.75, 41.26], JFK: [-73.78, 40.64], SYD: [151.18, -33.95], LHR: [-0.45, 51.47], HND: [139.78, 35.55], BOS: [-71, 42.36] }
const pairOf = (a: string, b: string): ProjectedPair => ({ a, b, aCountry: null, bCountry: null, count: 1, forward: 1, reverse: 0, lastDate: '2026-05-01', from: airports[a], to: airports[b] })
const pairs = [pairOf('IST', 'TBS'), pairOf('JFK', 'SYD'), pairOf('IST', 'LHR'), pairOf('HND', 'IST'), pairOf('BOS', 'JFK'), pairOf('LHR', 'TBS'), pairOf('HND', 'SYD')]
const summary = busySummary(10)
const projection = (patch: Partial<RouteProjection> = {}): RouteProjection => ({
  schemaVersion: 1, ownerId: 'u1', period: '2026', revision: summary.revision, publishedRevision: summary.publishedRevision, derivedState: 'ready', countryState: 'ready',
  routeCount: summary.map.routeCount, limit: 5000, truncated: false, routes: [], pairs, countries: summary.map.countries, ...patch,
})
const arcs = () => [...document.querySelectorAll('path[data-route]')]
const view = (locale: 'en' | 'ru' = 'en', s = summary) => render(<OverviewMap ownerId="u1" summary={s} locale={locale} labels={fakeLabels} />)

beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue(projection()) })
afterEach(cleanup)

describe('Overview map arcs from the route projection', () => {
  it('draws one arc per canonical pair of the period: arcs == projection.routeCount == map.routeCount', async () => {
    view()
    await waitFor(() => expect(arcs()).toHaveLength(7))
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(mocks.get.mock.calls[0][0]).toBe('/api/flights/route-projection?period=2026')
    expect(arcs()).toHaveLength(projection().routeCount)
    expect(arcs()).toHaveLength(summary.map.routeCount)
    expect(new Set(arcs().map(arc => arc.getAttribute('data-route'))).size).toBe(7)
    expect(screen.queryByText(/Showing the first/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Passport map/ })).toHaveAttribute('href', '/passport?view=map&year=2026')
  })

  it('draws the bounded set and says so when the projection is truncated', async () => {
    const big = { ...summary, map: { ...summary.map, routeCount: 5003 } }
    mocks.get.mockResolvedValue(projection({ routeCount: 5003, truncated: true, pairs: pairs.slice(0, 3) }))
    view('en', big)
    await screen.findByText('Showing the first 3 of 5,003 routes.')
    expect(arcs()).toHaveLength(3)
    cleanup()
    view('ru', big)
    await screen.findByText('Показаны первые 3 из 5 003 маршрутов.')
  })

  it('names pairs without a known airport position instead of drawing fewer arcs silently', async () => {
    mocks.get.mockResolvedValue(projection({ pairs: [...pairs.slice(0, 6), { ...pairs[6], to: null }] }))
    view()
    await screen.findByText('1 route has no known airport position and is not drawn.')
    expect(arcs()).toHaveLength(6)
  })

  it('keeps countries and the real route figure while the route read is pending', () => {
    mocks.get.mockReturnValue(new Promise(() => {}))
    view()
    expect(document.querySelector('circle[data-country="JP"]')).toBeInTheDocument()
    expect(arcs()).toHaveLength(0)
    expect(document.querySelector('.ov-legend-line')).toHaveTextContent('7 routes')
    expect(screen.queryByText(/0 routes/)).not.toBeInTheDocument()
  })

  it.each([
    ['a failed read', () => mocks.get.mockRejectedValue(new Error('offline'))],
    ['an unprepared projection', () => mocks.get.mockResolvedValue(projection({ derivedState: 'error' }))],
    ['another owner', () => mocks.get.mockResolvedValue(projection({ ownerId: 'u2' }))],
  ])('keeps the country preview usable after %s', async (_, arrange) => {
    arrange()
    view()
    await screen.findByText('Route lines are unavailable right now. Countries are still shown.')
    expect(arcs()).toHaveLength(0)
    expect(document.querySelector('circle[data-country="JP"]')).toBeInTheDocument()
    expect(document.querySelector('.ov-legend-line')).toHaveTextContent('7 routes')
  })

  it.each([{ revision: 2 }, { derivedState: 'pending' as const }, { routeCount: 8 }])('does not combine a projection that disagrees with the summary (%j)', async patch => {
    mocks.get.mockResolvedValue(projection(patch))
    view()
    await screen.findByText('Route lines are updating.')
    expect(arcs()).toHaveLength(0)
    expect(document.querySelector('circle[data-country="JP"]')).toBeInTheDocument()
  })

  it('asks for a fresh summary once when the projection is newer', async () => {
    mocks.get.mockResolvedValue(projection({ revision: 2, publishedRevision: 2 }))
    const { rerender } = view()
    await screen.findByText('Route lines are updating.')
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    rerender(<OverviewMap ownerId="u1" summary={summary} locale="en" labels={fakeLabels} />)
    await act(async () => {})
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('does not read routes for a period without any', async () => {
    view('en', { ...summary, map: { ...summary.map, routeCount: 0 } })
    await act(async () => {})
    expect(mocks.get).not.toHaveBeenCalled()
    expect(screen.queryByText(/Route lines/)).not.toBeInTheDocument()
  })

  it('keeps a pending ring distinct from a pressed dot with arcs drawn', async () => {
    view()
    await waitFor(() => expect(arcs()).toHaveLength(7))
    const pending = document.querySelector('circle[data-country="AU"]')!
    const pressed = document.querySelector('circle[data-country="JP"]')!
    expect(pending).toHaveAttribute('data-pending', 'true')
    expect(pending).toHaveAttribute('fill', 'none')
    expect(pending).toHaveAttribute('stroke-dasharray', '2 2')
    expect(pressed).not.toHaveAttribute('data-pending')
    expect(pressed.getAttribute('fill')).toBe(`var(${BUCKET_TOKENS[2]})`)
    expect(pressed).not.toHaveAttribute('stroke-dasharray')
  })

  it.each(['en', 'ru'] as const)('keeps the %s legend equal to the shared buckets', async locale => {
    view(locale)
    await waitFor(() => expect(arcs()).toHaveLength(7))
    const items = [...document.querySelectorAll('.ov-legend li')]
    expect(items.map(item => item.textContent)).toEqual([...BUCKET_LABELS[locale]])
    expect(items.map(item => (item.querySelector('.ov-swatch') as HTMLElement).style.background)).toEqual(BUCKET_TOKENS.slice(1).map(token => `var(${token})`))
  })
})
