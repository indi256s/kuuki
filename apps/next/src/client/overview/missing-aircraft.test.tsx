// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OverviewRow } from '@kuuki/shared/overview/model'
import type { MissingAircraftPage } from '@kuuki/shared/overview'
import type { AircraftApi } from '../import/aircraft-panel'
import { MissingAircraftReview, payloadMissingAircraft } from './missing-aircraft'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))
const apiGet = vi.hoisted(() => vi.fn())
const apiPost = vi.hoisted(() => vi.fn())
vi.mock('@kuuki/client/apiClient', () => ({
  api: { get: apiGet, post: apiPost },
  getAuthGeneration: () => 0,
}))
afterEach(() => {
  cleanup()
  refresh.mockClear()
  apiGet.mockReset()
  apiPost.mockReset()
})

const flight = (id: number) => ({
  id,
  flight_number: String(100 + id),
  airline_iata: 'AA',
  date: '2026-03-01',
  origin: 'JFK',
  destination: 'BOS',
})
/** A page of the server's set: `ids` on this page, `total` in the whole set, `offset` flights before it, `next` the cursor or null. */
const page = (
  ids: number[],
  total = ids.length,
  offset = 0,
  next: string | null = null,
): MissingAircraftPage => ({
  period: 'all',
  total,
  limit: 100,
  offset,
  flights: ids.map(flight),
  nextCursor: next,
})
const answer = (...pages: MissingAircraftPage[]) => {
  let call = 0
  return vi.fn(async () => pages[Math.min(call++, pages.length - 1)])
}
const aircraftApi = (accept: AircraftApi['accept'] = vi.fn(), offered = 1): AircraftApi => ({
  enrich: vi.fn(async () => ({
    results: Array.from({ length: offered }, (_, i) => ({
      flight_id: String(i + 1),
      aircraft_icao: 'B738',
      aircraft_name: null,
      confidence: 0.9,
    })),
  })),
  accept,
})
const open = async (name = 'Review aircraft') =>
  userEvent.click(screen.getByRole('button', { name }))

describe('MissingAircraftReview', () => {
  it('shows the count with an action, not a sort link, and reads nothing until opened', () => {
    const read = answer(page([1]))
    render(<MissingAircraftReview locale="ru" count={69} read={read} />)
    expect(screen.getByText('У 69 рейсов не указан самолёт')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Проверить самолёты' })).toBeInTheDocument()
    expect(document.querySelector('a')).toBeNull()
    expect(read).not.toHaveBeenCalled()
  })

  it('opens the retained review in a sheet for the period, with the first page as targets and no disclosure when it is everything', async () => {
    const read = answer(page([1, 2, 3]))
    render(<MissingAircraftReview locale="en" count={3} read={read} aircraftApi={aircraftApi()} />)
    await open()
    expect(read).toHaveBeenCalledWith(null, expect.any(AbortSignal))
    expect(await screen.findByRole('dialog', { name: 'Missing aircraft' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeEnabled()
    expect(screen.queryByText(/without an aircraft\.$/)).toBeNull()
    expect(screen.queryByRole('button', { name: /show the next/i })).toBeNull()
  })

  it('discloses the exact range and total, and offers the next flights with their real number', async () => {
    render(
      <MissingAircraftReview
        locale="en"
        count={1500}
        read={answer(
          page(
            Array.from({ length: 100 }, (_, i) => i + 1),
            1500,
            0,
            '2026-01-01:1',
          ),
        )}
      />,
    )
    await open()
    expect(
      await screen.findByText('Flights 1–100 of 1,500 without an aircraft.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show the next 100 flights' })).toBeInTheDocument()
  })

  it('names the last page with its own size, in Russian with a plural form', async () => {
    render(
      <MissingAircraftReview
        locale="ru"
        count={203}
        read={answer(
          page(
            Array.from({ length: 100 }, (_, i) => i + 1),
            203,
            100,
            'c',
          ),
        )}
      />,
    )
    await open('Проверить самолёты')
    expect(
      await screen.findByText('Перелёты 101–200 из 203 без указанного самолёта.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Показать следующие 3 перелёта' }),
    ).toBeInTheDocument()
  })

  it('continues past a first page that stays unidentified: the next page replaces it and is read after the cursor', async () => {
    const read = answer(page([1, 2], 3, 0, 'cursor-1'), page([3], 3, 2))
    render(
      <MissingAircraftReview
        locale="en"
        count={3}
        read={read}
        aircraftApi={{ enrich: vi.fn(async () => ({ results: [] })), accept: vi.fn() }}
      />,
    )
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    expect(await screen.findAllByText('The service gave no answer for this flight.')).toHaveLength(
      2,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 1 flight' }))
    expect(await screen.findByText('Flights 3–3 of 3 without an aircraft.')).toBeInTheDocument()
    expect(read).toHaveBeenNthCalledWith(2, 'cursor-1', expect.any(AbortSignal))
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeEnabled() // a fresh panel for the new page
    expect(screen.queryByRole('button', { name: /show the next/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the newest' }))
    await waitFor(() => expect(read).toHaveBeenNthCalledWith(3, null, expect.any(AbortSignal)))
  })

  it('a failed continuation keeps the page, says so, and can be pressed again', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(page([1], 2, 0, 'c'))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(page([2], 2, 1))
    render(<MissingAircraftReview locale="en" count={2} read={read} aircraftApi={aircraftApi()} />)
    await open()
    await userEvent.click(await screen.findByRole('button', { name: 'Show the next 1 flight' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The next flights could not be loaded.',
    )
    expect(screen.getByRole('button', { name: /identify aircraft/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 1 flight' }))
    expect(await screen.findByText('Flights 2–2 of 2 without an aircraft.')).toBeInTheDocument()
  })

  it('a failed read is an alert with a retry, and the retry reads again', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockImplementation(async () => page([1]))
    render(<MissingAircraftReview locale="en" count={1} read={read} aircraftApi={aircraftApi()} />)
    await open()
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(2)
    expect(read).toHaveBeenLastCalledWith(null, expect.any(AbortSignal))
  })

  it('an empty set says so instead of showing an empty review', async () => {
    render(<MissingAircraftReview locale="en" count={1} read={answer(page([]))} />)
    await open()
    expect(
      await screen.findByText('Every flight in this period has an aircraft.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /identify aircraft/i })).toBeNull()
  })

  it('after a confirmed save re-reads the open targets at the same position and refreshes the summary, and not before', async () => {
    const accept = vi.fn(async () => ({
      results: [{ id: 1, status: 'accepted' as const, flight: { id: 1, aircraft_icao: 'B738' } }],
      derived_state: 'ready' as const,
      revision: 3,
    }))
    // Before the save: flights 1 and 2 of three. After it: flight 1 has left the set, so the same page now holds 2 and 3.
    const read = answer(page([1, 2], 3, 0, null), page([2, 3], 2, 0))
    render(
      <MissingAircraftReview locale="en" count={3} read={read} aircraftApi={aircraftApi(accept)} />,
    )
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    expect(refresh).not.toHaveBeenCalled()
    expect(read).toHaveBeenCalledTimes(1)
    await userEvent.click(await screen.findByRole('button', { name: /save 1 aircraft/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(read).toHaveBeenLastCalledWith(null, expect.any(AbortSignal))
    expect(await screen.findByText('1 aircraft saved.')).toBeInTheDocument()
    // The saved flight is gone and the one that moved up is offered: a fresh panel with the new targets.
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeEnabled()
  })

  it('keeps partial outcomes and unselected suggestions after rereading, and retries only the failed row', async () => {
    const accept = vi
      .fn()
      .mockResolvedValueOnce({
        results: [
          { id: 1, status: 'accepted', flight: { id: 1, aircraft_icao: 'B738' } },
          { id: 2, status: 'error', http_status: 503, code: 'DOWN', error: 'Unavailable' },
        ],
      })
      .mockResolvedValueOnce({
        results: [{ id: 2, status: 'accepted', flight: { id: 2, aircraft_icao: 'B738' } }],
      })
    const read = answer(
      page([1, 2, 3], 4, 0, 'cursor'),
      page([2, 3, 4], 3, 0, 'refreshed-cursor'),
      page([3, 4], 2),
      page([4], 2, 1),
    )
    render(
      <MissingAircraftReview
        locale="en"
        count={4}
        read={read}
        aircraftApi={aircraftApi(accept, 3)}
      />,
    )
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
    expect(read).toHaveBeenLastCalledWith('cursor', expect.any(AbortSignal))
    expect(await screen.findByRole('button', { name: /identify aircraft/i })).toBeInTheDocument()
  })

  it('counts the cursor suffix from the refreshed missing set, excluding already saved review rows', async () => {
    const accept = vi.fn(async () => ({
      results: [{ id: 1, status: 'accepted' as const, flight: { id: 1, aircraft_icao: 'B738' } }],
    }))
    const read = answer(
      page([1, 2, 3], 5, 0, 'cursor'),
      page([2, 3, 4], 4, 0, 'new-cursor'),
      page([4, 5], 4, 2),
    )
    render(
      <MissingAircraftReview
        locale="en"
        count={5}
        read={read}
        aircraftApi={aircraftApi(accept, 3)}
      />,
    )
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /102/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /103/ }))
    await userEvent.click(screen.getByRole('button', { name: /save 1 aircraft/i }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 2 flights' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard and continue' }))
    expect(await screen.findByText('Flights 3–4 of 4 without an aircraft.')).toBeInTheDocument()
    expect(read).toHaveBeenLastCalledWith('cursor', expect.any(AbortSignal))
  })

  it('blocks paging and close during a save, then requires explicit discard of unresolved review work', async () => {
    let finish!: (value: Awaited<ReturnType<AircraftApi['accept']>>) => void
    const accept = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<AircraftApi['accept']>>>((resolve) => {
          finish = resolve
        }),
    )
    const read = answer(page([1], 2, 0, 'cursor'), page([2], 2, 1))
    render(
      <MissingAircraftReview locale="en" count={2} read={read} aircraftApi={aircraftApi(accept)} />,
    )
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    await userEvent.click(screen.getByRole('button', { name: /save 1 aircraft/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 1 flight' }))
    expect(read).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    finish({
      results: [{ id: 1, status: 'error', http_status: 503, code: 'DOWN', error: 'Unavailable' }],
    })
    await screen.findByText(/Not saved.*DOWN/)
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 1 flight' }))
    expect(read).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Unsaved suggestions will be lost.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep reviewing' }))
    expect(screen.getByText(/Not saved.*DOWN/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show the next 1 flight' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard and continue' }))
    expect(await screen.findByText('Flights 2–2 of 2 without an aircraft.')).toBeInTheDocument()
  })

  it('a failed re-read after a save says the save worked and offers a retry of the list', async () => {
    const accept = vi.fn(async () => ({
      results: [{ id: 1, status: 'accepted' as const, flight: { id: 1, aircraft_icao: 'B738' } }],
      derived_state: 'ready' as const,
      revision: 3,
    }))
    const read = vi
      .fn()
      .mockResolvedValueOnce(page([1]))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(page([], 0))
    render(
      <MissingAircraftReview locale="en" count={1} read={read} aircraftApi={aircraftApi(accept)} />,
    )
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /identify aircraft/i }))
    await userEvent.click(await screen.findByRole('button', { name: /save 1 aircraft/i }))
    expect(
      await screen.findByText('Saved, but the list could not be refreshed.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByText('Every flight in this period has an aircraft.'),
    ).toBeInTheDocument()
  })

  it('when the page after the cursor is empty but newer flights remain, says so and goes back to the newest', async () => {
    const read = answer(page([], 4, 4))
    render(<MissingAircraftReview locale="en" count={4} read={read} />)
    await open()
    expect(
      await screen.findByText(
        'There are no older flights after these. Newer ones still have no aircraft.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to the newest' })).toBeInTheDocument()
  })

  it('closing the sheet drops the loaded page, so the next open reads from the newest again', async () => {
    const read = answer(page([1]))
    render(<MissingAircraftReview locale="en" count={1} read={read} aircraftApi={aircraftApi()} />)
    await open()
    await screen.findByRole('button', { name: /identify aircraft/i })
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await open()
    await screen.findByRole('button', { name: /identify aircraft/i })
    expect(read).toHaveBeenCalledTimes(2)
    expect(read).toHaveBeenLastCalledWith(null, expect.any(AbortSignal))
  })
})

describe('active review across payload refreshes', () => {
  it('keeps uncertain recovery at zero missing until explicit discard and close, without a zero-count CTA', async () => {
    const read = answer(page([1, 2]), page([], 0))
    const { rerender } = render(<MissingAircraftReview locale="en" count={2} read={read} />)
    apiPost.mockResolvedValueOnce({
      results: [1, 2].map((id) => ({
        flight_id: String(id),
        aircraft_icao: 'B738',
        aircraft_name: null,
        confidence: 0.9,
      })),
    })
    // Both saves committed, but the answer for flight 2 is absent: the real accept reconciler marks it uncertain.
    apiPost.mockResolvedValueOnce({
      results: [{ id: 1, status: 'accepted', flight: { id: 1, aircraft_icao: 'B738' } }],
    })
    refresh.mockImplementationOnce(() =>
      rerender(<MissingAircraftReview locale="en" count={0} read={read} />),
    )
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

describe('payload missing-aircraft adapter', () => {
  const source = (id: number, extra: Partial<OverviewRow> = {}): OverviewRow => ({
    id,
    weight: 1,
    date: '2026-03-01',
    state: 'logged',
    origin: 'JFK',
    destination: 'BOS',
    airline: 'AA',
    aircraft: null,
    flightNumber: '123',
    depMinute: null,
    arrMinute: null,
    distanceKm: null,
    durationMinutes: null,
    zonesOverflown: null,
    durationSource: null,
    originTz: null,
    destTz: null,
    departureUtc: null,
    suppressed: 0,
    ...extra,
  })
  it('pages newest-first with a stable missing-only boundary after confirmed saves', () => {
    const rows = Array.from({ length: 103 }, (_, i) => source(i + 1))
    rows.push(
      source(200, { state: 'upcoming' }),
      source(201, { aircraft: 'B738' }),
      source(202, { weight: 5 }),
    )
    const signal = new AbortController().signal
    const first = payloadMissingAircraft(rows, null, signal)
    expect(first.total).toBe(103)
    expect(first.flights.map((row) => row.id)).toEqual(
      Array.from({ length: 100 }, (_, i) => 103 - i),
    )
    expect(first.nextCursor).toBe('2026-03-01:4')
    const next = payloadMissingAircraft(
      rows.filter((row) => row.id !== 103),
      first.nextCursor,
      signal,
    )
    expect(next.flights.map((row) => row.id)).toEqual([3, 2, 1])
    expect(next.offset).toBe(99)
    expect(next.total).toBe(102)
    expect(next.nextCursor).toBeNull()
  })
  it('aborted owner reads produce no page', () => {
    const controller = new AbortController()
    controller.abort()
    expect(() => payloadMissingAircraft([source(1)], null, controller.signal)).toThrow()
  })
  it('opens payload rows without the legacy read and removes confirmed saves before rereading', async () => {
    let rows = [source(1)]
    const confirmed = vi.fn((run: import('../import/aircraft-review').AircraftRun) => {
      rows = rows.filter((row) => run.rows.get(row.id)?.status !== 'saved')
    })
    const read = vi.fn(async (after: string | null, signal: AbortSignal) =>
      payloadMissingAircraft(rows, after, signal),
    )
    render(
      <MissingAircraftReview
        locale="en"
        count={1}
        read={read}
        aircraftApi={aircraftApi(
          vi.fn(async () => ({
            results: [
              { id: 1, status: 'accepted' as const, flight: { id: 1, aircraft_icao: 'B738' } },
            ],
            derived_state: 'ready' as const,
            revision: 3,
          })),
        )}
        onConfirmedSaved={confirmed}
        actionLabel="Add aircraft →"
      />,
    )
    await open('Add aircraft →')
    expect(apiGet).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: /Identify aircraft/i }))
    await userEvent.click(await screen.findByRole('button', { name: 'Save 1 aircraft' }))
    await waitFor(() => expect(confirmed).toHaveBeenCalledTimes(1))
    expect(
      await screen.findByText('Every flight in this period has an aircraft.'),
    ).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(2)
  })
})
