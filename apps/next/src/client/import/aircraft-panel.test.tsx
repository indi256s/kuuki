// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AircraftPanel, type AircraftApi } from './aircraft-panel'
import type { AircraftAccept, AircraftTarget } from './aircraft-review'

const target = (id: number): AircraftTarget => ({ id, flight_number: String(100 + id), airline_iata: 'AA', date: '2026-03-01', origin: 'JFK', destination: 'BOS' })
const targets = [target(1), target(2), target(3), target(4)]
const found = (id: number, icao: string | null, confidence: number) => ({ flight_id: String(id), aircraft_icao: icao, aircraft_name: null, confidence })

const api = (accept: AircraftApi['accept']): AircraftApi => ({
  enrich: vi.fn(async () => ({ results: [found(1, 'B738', 0.9), found(2, 'A320', 0.75), found(3, 'B77W', 0.5)] })),
  accept,
})

describe('AircraftPanel', () => {
  it('offers only reliable suggestions, selects them all and diagnoses the rest instead of hiding them', async () => {
    const user = userEvent.setup()
    render(<AircraftPanel locale="en" targets={targets} onSaved={vi.fn()} api={api(vi.fn())} />)
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: /aircraft suggestions/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /save 2 aircraft/i })).toBeInTheDocument()
    expect(screen.getByText(/under 70%/i)).toBeInTheDocument()
    expect(screen.getByText(/gave no answer for this flight/i)).toBeInTheDocument()
  })

  it('deselect-all clears the selection and disables saving with a reason', async () => {
    const user = userEvent.setup()
    render(<AircraftPanel locale="en" targets={targets} onSaved={vi.fn()} api={api(vi.fn())} />)
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    await user.click(await screen.findByRole('checkbox', { name: /deselect all/i }))
    expect(screen.getByRole('checkbox', { name: /select all/i })).not.toBeChecked()
    expect(screen.getByRole('button', { name: /save 0 aircraft/i })).toHaveAttribute('aria-disabled', 'true')
  })

  it('attaches a failure to its own flight, keeps the saved one, and still refreshes after a partial success', async () => {
    const user = userEvent.setup()
    const accept = vi.fn(async (): Promise<AircraftAccept> => ({ results: [
      { id: 1, status: 'accepted', flight: { id: 1, aircraft_icao: 'B738' } },
      { id: 2, status: 'error', http_status: 400, code: 'UNKNOWN_AIRCRAFT', error: 'no' },
    ], derived_state: 'pending', revision: 4 }))
    const onSaved = vi.fn()
    render(<AircraftPanel locale="en" targets={targets} onSaved={onSaved} api={api(accept)} />)
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    await user.click(await screen.findByRole('button', { name: /save 2 aircraft/i }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved.mock.calls[0][0].acks).toEqual([{ derived_state: 'pending', revision: 4 }])
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('Saved')).toBeInTheDocument()
    expect(within(rows[1]).getByText(/not saved · UNKNOWN_AIRCRAFT/i)).toBeInTheDocument()
  })

  it('marks a lost answer as uncertain, never as saved, and does not refresh', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<AircraftPanel locale="en" targets={targets} onSaved={onSaved} api={api(vi.fn(async () => { throw new TypeError('Failed to fetch') }))} />)
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    await user.click(await screen.findByRole('button', { name: /save 2 aircraft/i }))
    await waitFor(() => expect(screen.getAllByText(/may not be saved/i).length).toBe(2))
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('names the cause when the search itself fails', async () => {
    const user = userEvent.setup()
    const failing: AircraftApi = { enrich: vi.fn(async () => { throw Object.assign(new Error('x'), { status: 429, code: 'RATE_LIMITED' }) }), accept: vi.fn() }
    render(<AircraftPanel locale="en" targets={targets} onSaved={vi.fn()} api={failing} />)
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i)
    expect(screen.getByRole('button', { name: /search again/i })).toBeInTheDocument()
  })
})
