// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MissingAircraftPage } from '../../../../../packages/shared/src/overview'
import type { AircraftApi } from '../import/aircraft-panel'
import { OverviewRankings } from './rankings'
import { busySummary, fakeLabels } from './fixtures'
import { MissingAircraftReview, readMissingAircraft } from './missing-aircraft'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))
const apiGet = vi.hoisted(() => vi.fn())
const apiPost = vi.hoisted(() => vi.fn())
vi.mock('../../../../web/src/lib/apiClient', () => ({ api: { get: apiGet, post: apiPost }, getAuthGeneration: () => 0 }))
afterEach(() => { cleanup(); refresh.mockClear(); apiGet.mockReset(); apiPost.mockReset() })

const flight = (id: number) => ({ id, flight_number: String(100 + id), airline_iata: 'AA', date: '2026-03-01', origin: 'JFK', destination: 'BOS' })
/** A page of the server's set: `ids` on this page, `total` in the whole set, `offset` flights before it, `next` the cursor or null. */
const page = (ids: number[], total = ids.length, offset = 0, next: string | null = null): MissingAircraftPage =>
  ({ period: 'all', total, limit: 100, offset, flights: ids.map(flight), nextCursor: next })
const answer = (...pages: MissingAircraftPage[]) => {
  let call = 0
  return vi.fn(async () => pages[Math.min(call++, pages.length - 1)])
}
const aircraftApi = (accept: AircraftApi['accept'] = vi.fn(), offered = 1): AircraftApi => ({
  enrich: vi.fn(async () => ({ results: Array.from({ length: offered }, (_, i) => ({ flight_id: String(i + 1), aircraft_icao: 'B738', aircraft_name: null, confidence: 0.9 })) })), accept,
})
const open = async (name = 'Review aircraft') => userEvent.click(screen.getByRole('button', { name }))

describe('MissingAircraftReview', () => {
  it('shows the count with an action, not a sort link, and reads nothing until opened', () => {
    const read = answer(page([1]))
    render(<MissingAircraftReview locale="ru" period="2026" count={69} read={read} />)
    expect(screen.getByText('У 69 рейсов не указан самолёт')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Проверить самолёты' })).toBeInTheDocument()
    expect(document.querySelector('a')).toBeNull()
    expect(read).not.toHaveBeenCalled()
  })

  it('opens the retained review in a sheet for the period, with the first page as targets and no disclosure when it is everything', async () => {
    const read = answer(page([1, 2, 3]))
    render(<MissingAircraftReview locale="en" period="2026" count={3} read={read} aircraftApi={aircraftApi()} />)
    await open()
    expect(read).toHaveBeenCalledWith('2026', null, expect.any(AbortSignal))
    expect(await screen.findByRole('dialog', { name: 'Aircraft for flights without one' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeEnabled()
    expect(screen.queryByText(/without an aircraft\.$/)).toBeNull()
    expect(screen.queryByRole('button', { name: /show the next/i })).toBeNull()
  })

  it('discloses the exact range and total, and offers the next flights with their real number', async () => {
    render(<MissingAircraftReview locale="en" period="all" count={1500} read={answer(page(Array.from({ length: 100 }, (_, i) => i + 1), 1500, 0, '2026-01-01:1'))} />)
    await open()
    expect(await screen.findByText('Flights 1–100 of 1,500 without an aircraft.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show the next 100 flights' })).toBeInTheDocument()
  })

  it('names the last page with its own size, in Russian with a plural form', async () => {
    render(<MissingAircraftReview locale="ru" period="all" count={203} read={answer(page(Array.from({ length: 100 }, (_, i) => i + 1), 203, 100, 'c'))} />)
    await open('Проверить самолёты')
    expect(await screen.findByText('Перелёты 101–200 из 203 без указанного самолёта.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Показать следующие 3 перелёта' })).toBeInTheDocument()
  })

  it('continues past a first page that stays unidentified: the next page replaces it and is read after the cursor', async () => {
    const read = answer(page([1, 2], 3, 0, 'cursor-1'), page([3], 3, 2))
    render(<MissingAircraftReview locale="en" period="2026" count={3} read={read} aircraftApi={{ enrich: vi.fn(async () => ({ results: [] })), accept: vi.fn() }} />)
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    expect(await screen.findAllByText('The service gave no answer for this flight.')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 1 flight' }))
    expect(await screen.findByText('Flights 3–3 of 3 without an aircraft.')).toBeInTheDocument()
    expect(read).toHaveBeenNthCalledWith(2, '2026', 'cursor-1', expect.any(AbortSignal))
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeEnabled() // a fresh panel for the new page
    expect(screen.queryByRole('button', { name: /show the next/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the newest' }))
    await waitFor(() => expect(read).toHaveBeenNthCalledWith(3, '2026', null, expect.any(AbortSignal)))
  })

  it('a failed continuation keeps the page, says so, and can be pressed again', async () => {
    const read = vi.fn().mockResolvedValueOnce(page([1], 2, 0, 'c')).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(page([2], 2, 1))
    render(<MissingAircraftReview locale="en" period="all" count={2} read={read} aircraftApi={aircraftApi()} />)
    await open()
    await userEvent.click(await screen.findByRole('button', { name: 'Show the next 1 flight' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The next flights could not be loaded.')
    expect(screen.getByRole('button', { name: /identify aircraft/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 1 flight' }))
    expect(await screen.findByText('Flights 2–2 of 2 without an aircraft.')).toBeInTheDocument()
  })

  it('a failed read is an alert with a retry, and the retry reads again', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('down')).mockImplementation(async () => page([1]))
    render(<MissingAircraftReview locale="en" period="all" count={1} read={read} aircraftApi={aircraftApi()} />)
    await open()
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(2)
    expect(read).toHaveBeenLastCalledWith('all', null, expect.any(AbortSignal))
  })

  it('an empty set says so instead of showing an empty review', async () => {
    render(<MissingAircraftReview locale="en" period="all" count={1} read={answer(page([]))} />)
    await open()
    expect(await screen.findByText('Every flight in this period has an aircraft.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /identify aircraft/i })).toBeNull()
  })

  it('after a confirmed save re-reads the open targets at the same position and refreshes the summary, and not before', async () => {
    const accept = vi.fn(async () => ({ results: [{ id: 1, status: 'accepted' as const, flight: { id: 1, aircraft_icao: 'B738' } }], derived_state: 'ready' as const, revision: 3 }))
    // Before the save: flights 1 and 2 of three. After it: flight 1 has left the set, so the same page now holds 2 and 3.
    const read = answer(page([1, 2], 3, 0, null), page([2, 3], 2, 0))
    render(<MissingAircraftReview locale="en" period="2026" count={3} read={read} aircraftApi={aircraftApi(accept)} />)
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    expect(refresh).not.toHaveBeenCalled()
    expect(read).toHaveBeenCalledTimes(1)
    await userEvent.click(await screen.findByRole('button', { name: /save 1 aircraft/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(read).toHaveBeenLastCalledWith('2026', null, expect.any(AbortSignal))
    expect(await screen.findByText('1 aircraft saved.')).toBeInTheDocument()
    // The saved flight is gone and the one that moved up is offered: a fresh panel with the new targets.
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeEnabled()
  })

  it('keeps partial outcomes and unselected suggestions after rereading, and retries only the failed row', async () => {
    const accept = vi.fn().mockResolvedValueOnce({ results: [
      { id: 1, status: 'accepted', flight: { id: 1, aircraft_icao: 'B738' } },
      { id: 2, status: 'error', http_status: 503, code: 'DOWN', error: 'Unavailable' },
    ] }).mockResolvedValueOnce({ results: [{ id: 2, status: 'accepted', flight: { id: 2, aircraft_icao: 'B738' } }] })
    const read = answer(page([1, 2, 3], 4, 0, 'cursor'), page([2, 3, 4], 3, 0, 'refreshed-cursor'), page([3, 4], 2), page([4], 2, 1))
    render(<MissingAircraftReview locale="en" period="all" count={4} read={read} aircraftApi={aircraftApi(accept, 3)} />)
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /103/ }))
    await userEvent.click(screen.getByRole('button', { name: /save 2 aircraft/i }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Not saved.*DOWN/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /103/ })).not.toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Try again for the rest' }))
    expect(accept).toHaveBeenLastCalledWith([{ id: 2, aircraft_icao: 'B738' }])
    await waitFor(() => expect(read).toHaveBeenCalledTimes(3))
    expect(screen.getByRole('checkbox', { name: /103/ })).not.toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 1 flight' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard and continue' }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(4))
    // Continue after the reviewed boundary, not after unseen flights that filled the refreshed page.
    expect(read).toHaveBeenLastCalledWith('all', 'cursor', expect.any(AbortSignal))
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeInTheDocument()
  })

  it('counts the cursor suffix from the refreshed missing set, excluding already saved review rows', async () => {
    const accept = vi.fn(async () => ({ results: [{ id: 1, status: 'accepted' as const, flight: { id: 1, aircraft_icao: 'B738' } }] }))
    const read = answer(page([1, 2, 3], 5, 0, 'cursor'), page([2, 3, 4], 4, 0, 'new-cursor'), page([4, 5], 4, 2))
    render(<MissingAircraftReview locale="en" period="all" count={5} read={read} aircraftApi={aircraftApi(accept, 3)} />)
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /102/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /103/ }))
    await userEvent.click(screen.getByRole('button', { name: /save 1 aircraft/i }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 2 flights' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard and continue' }))
    expect(await screen.findByText('Flights 3–4 of 4 without an aircraft.')).toBeInTheDocument()
    expect(read).toHaveBeenLastCalledWith('all', 'cursor', expect.any(AbortSignal))
  })

  it('blocks paging and close during a save, then requires explicit discard of unresolved review work', async () => {
    let finish!: (value: Awaited<ReturnType<AircraftApi['accept']>>) => void
    const accept = vi.fn(() => new Promise<Awaited<ReturnType<AircraftApi['accept']>>>(resolve => { finish = resolve }))
    const read = answer(page([1], 2, 0, 'cursor'), page([2], 2, 1))
    render(<MissingAircraftReview locale="en" period="all" count={2} read={read} aircraftApi={aircraftApi(accept)} />)
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    await userEvent.click(screen.getByRole('button', { name: /save 1 aircraft/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 1 flight' }))
    expect(read).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    finish({ results: [{ id: 1, status: 'error', http_status: 503, code: 'DOWN', error: 'Unavailable' }] })
    await screen.findByText(/Not saved.*DOWN/)
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 1 flight' }))
    expect(read).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Leaving this review discards unsaved suggestions and retry outcomes.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep reviewing' }))
    expect(screen.getByText(/Not saved.*DOWN/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 1 flight' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard and continue' }))
    expect(await screen.findByText('Flights 2–2 of 2 without an aircraft.')).toBeInTheDocument()
  })

  it('a failed re-read after a save says the save worked and offers a retry of the list', async () => {
    const accept = vi.fn(async () => ({ results: [{ id: 1, status: 'accepted' as const, flight: { id: 1, aircraft_icao: 'B738' } }], derived_state: 'ready' as const, revision: 3 }))
    const read = vi.fn().mockResolvedValueOnce(page([1])).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(page([], 0))
    render(<MissingAircraftReview locale="en" period="all" count={1} read={read} aircraftApi={aircraftApi(accept)} />)
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    await userEvent.click(await screen.findByRole('button', { name: /save 1 aircraft/i }))
    expect(await screen.findByText('Saved, but the list could not be refreshed.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Every flight in this period has an aircraft.')).toBeInTheDocument()
  })

  it('when the page after the cursor is empty but newer flights remain, says so and goes back to the newest', async () => {
    const read = answer(page([], 4, 4))
    render(<MissingAircraftReview locale="en" period="all" count={4} read={read} />)
    await open()
    expect(await screen.findByText('There are no older flights after these. Newer ones still have no aircraft.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to the newest' })).toBeInTheDocument()
  })

  it('closing the sheet drops the loaded page, so the next open reads from the newest again', async () => {
    const read = answer(page([1]))
    render(<MissingAircraftReview locale="en" period="all" count={1} read={read} aircraftApi={aircraftApi()} />)
    await open()
    await screen.findByRole('button', { name: /identify aircraft/i })
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await open()
    await screen.findByRole('button', { name: /identify aircraft/i })
    expect(read).toHaveBeenCalledTimes(2)
    expect(read).toHaveBeenLastCalledWith('all', null, expect.any(AbortSignal))
  })
})

describe('readMissingAircraft', () => {
  it('asks the dedicated owner-scoped read for the period and the cursor, never the Journal list', async () => {
    const signal = new AbortController().signal
    apiGet.mockResolvedValue(page([]))
    await readMissingAircraft('2026', null, signal)
    await readMissingAircraft('all', '2026-03-01:9', signal)
    expect(apiGet).toHaveBeenNthCalledWith(1, '/api/me/overview/missing-aircraft', { period: '2026' }, { signal })
    expect(apiGet).toHaveBeenNthCalledWith(2, '/api/me/overview/missing-aircraft', { period: 'all', after: '2026-03-01:9' }, { signal })
  })
})

describe('Rankings owns an active review across summary refreshes', () => {
  it('keeps uncertain recovery at zero missing until explicit discard and close, without a zero-count CTA', async () => {
    const before = busySummary(10, 'all')
    const after = { ...before, dataAvailability: { ...before.dataAvailability, missingAircraft: 0 } }
    const { rerender } = render(<OverviewRankings summary={{ ...before, dataAvailability: { ...before.dataAvailability, missingAircraft: 2 } }} locale="en" labels={fakeLabels} />)
    apiGet.mockResolvedValueOnce(page([1, 2])).mockResolvedValueOnce(page([], 0))
    apiPost.mockResolvedValueOnce({ results: [1, 2].map(id => ({ flight_id: String(id), aircraft_icao: 'B738', aircraft_name: null, confidence: 0.9 })) })
    // Both saves committed, but the answer for flight 2 is absent: the real accept reconciler marks it uncertain.
    apiPost.mockResolvedValueOnce({ results: [{ id: 1, status: 'accepted', flight: { id: 1, aircraft_icao: 'B738' } }] })
    refresh.mockImplementationOnce(() => rerender(<OverviewRankings summary={after} locale="en" labels={fakeLabels} />))
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    await userEvent.click(screen.getByRole('button', { name: /save 2 aircraft/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('May not be saved')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again for the rest' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Review aircraft' })).toBeNull()
    expect(screen.queryByText('0 flights have no aircraft listed')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Discard and continue' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Review aircraft' })).toBeNull()
  })
})
