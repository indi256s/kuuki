// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AircraftApi } from '../import/aircraft-panel'
import { MissingAircraftReview, REVIEW_LIMIT, readMissingAircraft } from './missing-aircraft'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))
const apiGet = vi.hoisted(() => vi.fn())
vi.mock('../../../../web/src/lib/apiClient', () => ({ api: { get: apiGet, post: vi.fn() }, getAuthGeneration: () => 0 }))
afterEach(() => { cleanup(); refresh.mockClear(); apiGet.mockClear() })

const flight = (id: number) => ({ id, flight_number: String(100 + id), airline_iata: 'AA', date: '2026-03-01', origin: 'JFK', destination: 'BOS' })
const answer = (ids: number[], total = ids.length) => async () => ({ flights: ids.map(flight), total })
const aircraftApi = (accept: AircraftApi['accept'] = vi.fn()): AircraftApi => ({
  enrich: vi.fn(async () => ({ results: [{ flight_id: '1', aircraft_icao: 'B738', aircraft_name: null, confidence: 0.9 }] })), accept,
})

describe('MissingAircraftReview', () => {
  it('shows the count with an action, not a sort link, and reads nothing until opened', () => {
    const read = vi.fn(answer([1]))
    render(<MissingAircraftReview locale="ru" period="2026" count={69} read={read} />)
    expect(screen.getByText('У 69 рейсов не указан самолёт')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Проверить самолёты' })).toBeInTheDocument()
    expect(document.querySelector('a')).toBeNull()
    expect(read).not.toHaveBeenCalled()
  })

  it('opens the retained review in a sheet for the period, with the loaded flights as targets', async () => {
    const read = vi.fn(answer([1, 2, 3]))
    render(<MissingAircraftReview locale="en" period="2026" count={3} read={read} aircraftApi={aircraftApi()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Review aircraft' }))
    expect(read).toHaveBeenCalledWith('2026', expect.any(AbortSignal))
    expect(await screen.findByRole('dialog', { name: 'Aircraft for flights without one' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeEnabled()
    expect(screen.queryByText(/Showing the newest/)).toBeNull()
  })

  it('says when only the newest flights are loaded and the total is larger', async () => {
    render(<MissingAircraftReview locale="en" period="all" count={500} read={answer(Array.from({ length: REVIEW_LIMIT }, (_, i) => i + 1), 500)} />)
    await userEvent.click(screen.getByRole('button', { name: 'Review aircraft' }))
    expect(await screen.findByText(`Showing the newest ${REVIEW_LIMIT} of 500. Save these to review the rest.`)).toBeInTheDocument()
  })

  it('a failed read is an alert with a retry, and the retry reads again', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('down')).mockImplementation(answer([1]))
    render(<MissingAircraftReview locale="en" period="all" count={1} read={read} aircraftApi={aircraftApi()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Review aircraft' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('an empty set says so instead of showing an empty review', async () => {
    render(<MissingAircraftReview locale="en" period="all" count={1} read={answer([])} />)
    await userEvent.click(screen.getByRole('button', { name: 'Review aircraft' }))
    expect(await screen.findByText('Every flight in this period has an aircraft.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /identify aircraft/i })).toBeNull()
  })

  it('re-reads the server summary after a confirmed save, and not before', async () => {
    const accept = vi.fn(async () => ({ results: [{ id: 1, status: 'accepted' as const, flight: { id: 1, aircraft_icao: 'B738' } }], derived_state: 'ready' as const, revision: 3 }))
    render(<MissingAircraftReview locale="en" period="2026" count={1} read={answer([1])} aircraftApi={aircraftApi(accept)} />)
    await userEvent.click(screen.getByRole('button', { name: 'Review aircraft' }))
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    expect(refresh).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: /save 1 aircraft/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('closing the sheet drops the loaded targets, so the next open reads the current set', async () => {
    const read = vi.fn(answer([1]))
    render(<MissingAircraftReview locale="en" period="all" count={1} read={read} aircraftApi={aircraftApi()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Review aircraft' }))
    await screen.findByRole('button', { name: /identify aircraft/i })
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'Review aircraft' }))
    await screen.findByRole('button', { name: /identify aircraft/i })
    expect(read).toHaveBeenCalledTimes(2)
  })
})

describe('readMissingAircraft', () => {
  it('asks the flight list for completed flights with no aircraft in the period, newest first, bounded', async () => {
    const signal = new AbortController().signal
    apiGet.mockResolvedValue({ flights: [], total: 0 })
    await readMissingAircraft('2026', signal)
    await readMissingAircraft('all', signal)
    expect(apiGet).toHaveBeenNthCalledWith(1, '/api/flights', { status: 'completed', missing: 'aircraft', year: '2026', limit: REVIEW_LIMIT, sort: 'date', order: 'desc' }, { signal })
    expect(apiGet.mock.calls[1][1]).toEqual({ status: 'completed', missing: 'aircraft', limit: REVIEW_LIMIT, sort: 'date', order: 'desc' })
  })
})
