// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteProjection } from '@kuuki/shared'
const mocks = vi.hoisted(() => ({ get: vi.fn(), renderer: vi.fn() }))
vi.mock('../../../../web/src/lib/apiClient', () => ({ api: { get: mocks.get } }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('./renderer', () => ({ FullRouteMap: (props: unknown) => { mocks.renderer(props); return <div>Interactive map</div> } }))
import { RouteMapPanel } from './panel'
const pair = { a: 'BOS', b: 'JFK', aCountry: 'US', bCountry: 'US', count: 3, forward: 1, reverse: 2, lastDate: '2026-03-01', from: [-71, 42] as [number, number], to: [-74, 40] as [number, number] }
const projection = (patch: Partial<RouteProjection> = {}): RouteProjection => ({ schemaVersion: 1, ownerId: 'u1', period: '2026', revision: 4, publishedRevision: 4, derivedState: 'ready', countryState: 'ready', routeCount: 1, limit: 5000, truncated: false, routes: [], pairs: [pair], countries: [{ id: 'US', visits: 2, pending: false }, { id: 'PT', visits: 1, pending: true }], ...patch })
const props = { ownerId: 'u1', locale: 'en' as const, period: '2026' as const, revision: 4, publishedRevision: 4, initiallyOpen: true, layer: 'routes' as const, onRefresh: vi.fn(), countryVisits: [{ countryCode: 'US', count: 20 }, { countryCode: 'DE', count: 6 }, { countryCode: 'FR', count: 0, claimed: true }] }
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue(projection()) })
describe('opened map publication contract', () => {
  it('uses one undirected pair and server transit/pending counts, preserving collection claims', async () => {
    render(<RouteMapPanel {...props} />)
    await screen.findByText('Interactive map')
    const last = mocks.renderer.mock.lastCall![0]
    expect(last.routes).toHaveLength(1)
    expect(last.routes[0]).toMatchObject({ origin: 'BOS', destination: 'JFK', count: 3 })
    expect(last.visits).toEqual([{ countryCode: 'US', count: 2, pending: false, claimed: false }, { countryCode: 'PT', count: 1, pending: true, claimed: false }, { countryCode: 'FR', count: 0, claimed: true, pending: false }])
    expect(screen.getByRole('button', { name: 'BOS ↔ JFK · 3' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Visited countries' })).not.toHaveTextContent('Germany')
  })
  it('keeps a ground visit pressed when the period has only awaiting flights in that country', async () => {
    render(<RouteMapPanel {...props} countryVisits={[{ countryCode: 'PT', count: 8, groundCount: 1, claimed: true }]} />)
    await screen.findByText('Interactive map')
    expect(mocks.renderer.mock.lastCall![0].visits).toContainEqual({ countryCode: 'PT', count: 2, pending: false, claimed: true })
  })
  it.each([{ revision: 5 }, { publishedRevision: 3 }, { countryState: 'updating' as const, countries: null }])('refreshes stale Passport data without combining projection %j', async patch => {
    mocks.get.mockResolvedValue(projection(patch))
    const { rerender } = render(<RouteMapPanel {...props} />)
    await screen.findByText(/Updating the map/)
    expect(mocks.renderer).not.toHaveBeenCalled()
    expect(props.onRefresh).toHaveBeenCalledTimes(1)
    rerender(<RouteMapPanel {...props} onRefresh={() => props.onRefresh()} />)
    expect(props.onRefresh).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /BOS ↔ JFK/ })).not.toBeInTheDocument()
  })
  it('reports preparation failure and retries without calling it loading', async () => {
    mocks.get.mockResolvedValueOnce(projection({ derivedState: 'error' })).mockResolvedValueOnce(projection())
    render(<RouteMapPanel {...props} />)
    await screen.findByRole('alert')
    expect(screen.queryByText('Loading routes…')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Interactive map')
  })
  it('states bounded geometry and keeps unknown endpoints in the equivalent route list', async () => {
    mocks.get.mockResolvedValue(projection({ truncated: true, routeCount: 5001, pairs: [{ ...pair, from: null }] }))
    render(<RouteMapPanel {...props} />)
    await screen.findByText('Showing the first 1 of 5001 routes.')
    expect(screen.getByRole('button', { name: /BOS ↔ JFK · 3 · line unavailable/ })).toBeInTheDocument()
  })
  it('drops a late response for a superseded period', async () => {
    let resolve!: (value: RouteProjection) => void
    mocks.get.mockReturnValueOnce(new Promise<RouteProjection>(done => { resolve = done })).mockResolvedValueOnce(projection({ period: 'all' }))
    const { rerender } = render(<RouteMapPanel {...props} />)
    rerender(<RouteMapPanel {...props} period="all" />)
    await screen.findByText('Interactive map')
    await act(async () => resolve(projection({ pairs: [{ ...pair, a: 'LAX' }] })))
    await waitFor(() => expect(mocks.renderer.mock.lastCall![0].viewportKey).toBe('u1:all'))
    expect(screen.queryByRole('button', { name: /LAX ↔ JFK/ })).not.toBeInTheDocument()
  })
})
