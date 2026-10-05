// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newestAwaiting, OverviewHero } from './hero'
import { busySummary } from './fixtures'

const queue = vi.hoisted(() => ({ value: { data: null as unknown, error: false, reload: () => {} } }))
vi.mock('../awaiting', () => ({ useAwaiting: () => queue.value }))

const flight = (id: number, date: string, origin = 'TBS', destination = 'IST') => ({ flight: { id, date, origin, destination, flight_number: null } })
const awaiting = (flights: ReturnType<typeof flight>[]) => ({ awaitingFlights: flights, awaitingFlightCount: flights.length })
const upcoming = busySummary(10).nextFlight

beforeEach(() => { queue.value = { data: null, error: false, reload: () => {} } })
afterEach(cleanup)

describe('newestAwaiting', () => {
  it('takes the newest date and breaks ties with the later id', () => {
    const rows = [flight(1, '2026-03-01'), flight(7, '2026-04-01'), flight(9, '2026-04-01'), flight(3, '2026-02-01')].map(entry => entry.flight)
    expect(newestAwaiting(rows as never)?.id).toBe(9)
    expect(newestAwaiting([])).toBeNull()
  })
})

describe('OverviewHero', () => {
  it('an awaiting flight beats the upcoming one, and says how many more wait', () => {
    queue.value.data = awaiting([flight(1, '2026-03-01'), flight(2, '2026-04-01', 'LHR', 'JFK')])
    render(<OverviewHero locale="en" upcoming={upcoming} />)
    expect(document.querySelector('[data-hero=awaiting]')).not.toBeNull()
    expect(document.querySelector('[data-hero=upcoming]')).toBeNull()
    expect(screen.getByRole('link', { name: /Review/ })).toHaveAttribute('href', '/journal?queue=awaiting')
    expect(screen.getByText(/1 flight/)).toBeInTheDocument()
  })
  it('falls back to the upcoming flight when nothing awaits, independent of any period', () => {
    queue.value.data = awaiting([])
    render(<OverviewHero locale="en" upcoming={upcoming} />)
    expect(document.querySelector('[data-hero=upcoming]')).not.toBeNull()
    expect(screen.getByRole('link', { name: /Edit/ })).toHaveAttribute('href', '/journal/99/edit')
  })
  it('shows the upcoming flight while the queue is still loading', () => {
    render(<OverviewHero locale="ru" upcoming={upcoming} />)
    expect(document.querySelector('[data-hero=upcoming]')).not.toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('says out loud that the queue is unavailable, with a retry, and still shows the upcoming flight', async () => {
    const reload = vi.fn()
    queue.value = { data: null, error: true, reload }
    render(<OverviewHero locale="en" upcoming={upcoming} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/queue/i)
    await userEvent.click(screen.getByRole('button', { name: /Retry|Try again/ }))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-hero=upcoming]')).not.toBeNull()
  })
  it('renders nothing when there is neither an awaiting nor an upcoming flight', () => {
    queue.value.data = awaiting([])
    const { container } = render(<OverviewHero locale="en" upcoming={null} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('keeps a stale queue rather than flagging an error when a refresh fails', () => {
    queue.value = { data: awaiting([flight(2, '2026-04-01')]), error: true, reload: () => {} }
    render(<OverviewHero locale="en" upcoming={null} />)
    expect(document.querySelector('[data-hero=awaiting]')).not.toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
