// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AircraftPanel, type AircraftApi } from './aircraft-panel'
import type { AircraftAccept, AircraftTarget } from './aircraft-review'

const target = (id: number): AircraftTarget => ({
  id,
  flight_number: String(100 + id),
  airline_iata: 'AA',
  date: '2026-03-01',
  origin: 'JFK',
  destination: 'BOS',
})
const targets = [target(1), target(2), target(3), target(4)]
const found = (id: number, icao: string | null, confidence: number) => ({
  flight_id: String(id),
  aircraft_icao: icao,
  aircraft_name: null,
  confidence,
})

const api = (accept: AircraftApi['accept']): AircraftApi => ({
  enrich: vi.fn(async () => ({
    results: [found(1, 'B738', 0.9), found(2, 'A320', 0.75), found(3, 'B77W', 0.5)],
  })),
  accept,
})

describe('AircraftPanel', () => {
  it('offers only reliable suggestions, selects them all and diagnoses the rest instead of hiding them', async () => {
    const user = userEvent.setup()
    render(<AircraftPanel locale="en" targets={targets} onSaved={vi.fn()} api={api(vi.fn())} />)
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /aircraft suggestions/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /save 2 aircraft/i })).toBeInTheDocument()
    expect(screen.getByText(/under 70%/i)).toBeInTheDocument()
    expect(screen.getByText(/gave no answer for this flight/i)).toBeInTheDocument()
  })

  it('starts schedule and unknown suggestions unchecked while select all still includes them', async () => {
    const user = userEvent.setup()
    const accept = vi.fn(async (): Promise<AircraftAccept> => ({ results: [] }))
    const enrich: AircraftApi['enrich'] = vi.fn(async () => ({
      results: [
        { ...found(1, 'B738', 0.9), equipment_basis: 'actual' as const },
        { ...found(2, 'A320', 0.9), equipment_basis: 'scheduled' as const },
        { ...found(3, 'B77W', 0.9), equipment_basis: 'unknown' as const },
      ],
    }))
    render(
      <AircraftPanel locale="en" targets={targets} onSaved={vi.fn()} api={{ enrich, accept }} />,
    )
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]).getByRole('checkbox')).toBeChecked()
    expect(within(rows[1]).getByRole('checkbox')).not.toBeChecked()
    expect(within(rows[2]).getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('button', { name: /save 1 aircraft/i })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /select all/i }))
    expect(screen.getByRole('button', { name: /save 3 aircraft/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /save 3 aircraft/i }))
    expect(accept).toHaveBeenCalledWith([
      { id: 1, aircraft_icao: 'B738' },
      { id: 2, aircraft_icao: 'A320' },
      { id: 3, aircraft_icao: 'B77W' },
    ])
  })

  it('shows search context and only links to HTTP sources', async () => {
    const user = userEvent.setup()
    const enrich: AircraftApi['enrich'] = vi.fn(async () => ({
      results: [
        {
          ...found(1, 'B738', 0.9),
          equipment_basis: 'actual' as const,
          evidence_date: '2026-03-01',
          registration: 'N123AA',
          operating_airline: 'Example Air',
          sources: [
            { url: 'https://example.com/flight', title: 'Flight record' },
            { url: 'javascript:alert(1)', title: 'Unsafe' },
          ],
        },
      ],
    }))
    render(
      <AircraftPanel
        locale="en"
        targets={[target(1)]}
        onSaved={vi.fn()}
        api={{ enrich, accept: vi.fn() }}
      />,
    )
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    const row = within((await screen.findAllByRole('listitem'))[0])
    expect(row.getByText(/search suggests an actual-flight record/i)).toBeInTheDocument()
    expect(row.getByText('Flight date in source:')).toBeInTheDocument()
    expect(row.getByText('Mar 1, 2026')).toBeInTheDocument()
    expect(row.getByText('N123AA')).toBeInTheDocument()
    expect(row.getByText('Example Air')).toBeInTheDocument()
    expect(row.getByRole('link', { name: 'Flight record' })).toHaveAttribute(
      'href',
      'https://example.com/flight',
    )
    expect(row.getByRole('link', { name: 'Flight record' })).toHaveAttribute('target', '_blank')
    expect(row.getByRole('link', { name: 'Flight record' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
    expect(row.queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument()
  })

  it('isolates Search Suggestions HTML in restricted iframes across batches', async () => {
    const user = userEvent.setup()
    const html =
      '<div id="injected-host-node">Search Suggestions</div><script>window.injected = true</script>'
    const enrich: AircraftApi['enrich'] = vi
      .fn()
      .mockResolvedValueOnce({ results: [], search_suggestions_html: html })
      .mockResolvedValueOnce({
        results: [],
        search_suggestions_html: '<a href="https://example.com">Search</a>',
      })
    render(
      <AircraftPanel
        locale="en"
        targets={Array.from({ length: 21 }, (_, index) => target(index + 1))}
        onSaved={vi.fn()}
        api={{ enrich, accept: vi.fn() }}
      />,
    )
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    const frames = await screen.findAllByTitle('Google Search Suggestions for aircraft research')
    expect(frames).toHaveLength(2)
    expect(frames[0]).toHaveAttribute('srcdoc', html)
    expect(frames[0]).toHaveAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox')
    expect(document.getElementById('injected-host-node')).toBeNull()
  })

  it('deselect-all clears the selection and disables saving with a reason', async () => {
    const user = userEvent.setup()
    render(<AircraftPanel locale="en" targets={targets} onSaved={vi.fn()} api={api(vi.fn())} />)
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    await user.click(await screen.findByRole('checkbox', { name: /deselect all/i }))
    expect(screen.getByRole('checkbox', { name: /select all/i })).not.toBeChecked()
    expect(screen.getByRole('button', { name: /save 0 aircraft/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('attaches a failure to its own flight, keeps the saved one, and still refreshes after a partial success', async () => {
    const user = userEvent.setup()
    const accept = vi.fn(async (): Promise<AircraftAccept> => ({
      results: [
        { id: 1, status: 'accepted', flight: { id: 1, aircraft_icao: 'B738' } },
        { id: 2, status: 'error', http_status: 503, code: 'UNAVAILABLE', error: 'later' },
      ],
      derived_state: 'pending',
      revision: 4,
    }))
    const onSaved = vi.fn()
    render(<AircraftPanel locale="en" targets={targets} onSaved={onSaved} api={api(accept)} />)
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    await user.click(await screen.findByRole('button', { name: /save 2 aircraft/i }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved.mock.calls[0][0].acks).toEqual([{ derived_state: 'pending', revision: 4 }])
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('Saved')).toBeInTheDocument()
    expect(within(rows[1]).getByText(/not saved · UNAVAILABLE/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Saved: 1 · Not saved: 1')
    let finish!: (value: AircraftAccept) => void
    accept.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await user.click(screen.getByRole('button', { name: /try again for the rest/i }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    finish({
      results: [{ id: 2, status: 'error', http_status: 503, code: 'UNAVAILABLE', error: 'later' }],
    })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not saved: 1'))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(accept).toHaveBeenLastCalledWith([{ id: 2, aircraft_icao: 'A320' }])
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('marks a lost answer as uncertain, never as saved, and does not refresh', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(
      <AircraftPanel
        locale="en"
        targets={targets}
        onSaved={onSaved}
        api={api(
          vi.fn(async () => {
            throw new TypeError('Failed to fetch')
          }),
        )}
      />,
    )
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    await user.click(await screen.findByRole('button', { name: /save 2 aircraft/i }))
    await waitFor(() =>
      expect(within(screen.getAllByRole('list')[0]).getAllByText(/may not be saved/i).length).toBe(
        2,
      ),
    )
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('names the cause when the search itself fails', async () => {
    const user = userEvent.setup()
    const failing: AircraftApi = {
      enrich: vi.fn(async () => {
        throw Object.assign(new Error('x'), { status: 429, code: 'RATE_LIMITED' })
      }),
      accept: vi.fn(),
    }
    render(<AircraftPanel locale="en" targets={targets} onSaved={vi.fn()} api={failing} />)
    await user.click(screen.getByRole('button', { name: /identify aircraft/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i)
    expect(screen.getByRole('button', { name: /search again/i })).toBeInTheDocument()
  })
})
