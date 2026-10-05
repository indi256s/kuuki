import { describe, expect, it, vi } from 'vitest'
import { acceptAircraft, diagnose, retryableAircraft, toggleAll, type AircraftAccept } from './aircraft-review'

const result = (flight_id: string, aircraft_icao: string | null, confidence: number) => ({ flight_id, aircraft_icao, aircraft_name: null, confidence })
const accepted = (id: number): AircraftAccept['results'][number] => ({ id, status: 'accepted', flight: { id, aircraft_icao: 'B738' } })
const refused = (id: number | null, code: string, http_status = 400): AircraftAccept['results'][number] => ({ id, status: 'error', http_status, code, error: 'no' })
const items = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ id: from + i, aircraft_icao: 'B738' }))

describe('diagnose', () => {
  it('lists suggestions at 0.7 and above as selectable and explains every other flight', () => {
    const view = diagnose([1, 2, 3, 4], [result('1', 'B738', 0.9), result('2', 'A320', 0.69), result('3', null, 0.2)])
    expect(view.suggested.map(row => row.flightId)).toEqual([1])
    expect(view.unidentified).toEqual([
      { flightId: 2, reason: 'low', confidence: 0.69, icao: 'A320' },
      { flightId: 3, reason: 'none', confidence: 0.2, icao: null },
      { flightId: 4, reason: 'missing', confidence: null, icao: null },
    ])
  })
  it('treats exactly 0.7 as reliable', () => {
    expect(diagnose([1], [result('1', 'B738', 0.7)]).suggested).toHaveLength(1)
  })
})

describe('toggleAll', () => {
  it('selects everything, then deselects everything', () => {
    const ids = [1, 2, 3]
    expect(toggleAll(new Set([1]), ids)).toEqual(new Set([1, 2, 3]))
    expect(toggleAll(new Set([1, 2, 3]), ids)).toEqual(new Set())
  })
})

describe('acceptAircraft', () => {
  it('sends 20-flight requests one at a time and records each outcome per flight', async () => {
    let active = 0, peak = 0
    const send = vi.fn(async (chunk: Array<{ id: number }>) => {
      active++; peak = Math.max(peak, active); await Promise.resolve(); active--
      return { results: chunk.map(item => accepted(item.id)), derived_state: 'ready' as const, revision: 2 }
    })
    const outcome = await acceptAircraft(items(45), send)
    expect(send.mock.calls.map(call => call[0].length)).toEqual([20, 20, 5])
    expect(peak).toBe(1)
    expect([...outcome.rows.values()].every(row => row.status === 'saved')).toBe(true)
    expect(outcome.acks).toHaveLength(3)
  })

  it('attaches a failure to its own flight and keeps the others saved', async () => {
    const send = async () => ({ results: [accepted(1), refused(2, 'UNKNOWN_AIRCRAFT'), refused(3, 'NOT_FOUND', 404)] })
    const outcome = await acceptAircraft(items(3), send)
    expect(outcome.rows.get(1)?.status).toBe('saved')
    expect(outcome.rows.get(2)).toMatchObject({ status: 'failed', code: 'UNKNOWN_AIRCRAFT' })
    expect(outcome.rows.get(3)).toMatchObject({ status: 'failed', code: 'NOT_FOUND' })
  })

  it('marks a lost answer uncertain, never saved or failed, and leaves later flights unsent', async () => {
    const send = vi.fn().mockResolvedValueOnce({ results: items(20).map(item => accepted(item.id)) }).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const outcome = await acceptAircraft(items(45), send)
    expect(outcome.rows.get(1)?.status).toBe('saved')
    expect(outcome.rows.get(21)?.status).toBe('uncertain')
    expect(outcome.rows.get(41)?.status).toBe('unsent')
    expect(outcome.uncertain).toBe(true)
    expect(retryableAircraft(outcome)).toHaveLength(25)
  })

  it('treats an item the answer omitted as uncertain', async () => {
    const outcome = await acceptAircraft(items(2), async () => ({ results: [accepted(1)] }))
    expect(outcome.rows.get(2)?.status).toBe('uncertain')
  })

  it('retries only server-transient failures, not refusals', async () => {
    const outcome = await acceptAircraft(items(3), async () => ({ results: [accepted(1), refused(2, 'UNKNOWN_AIRCRAFT'), refused(3, 'UPDATE_MISSING', 500)] }))
    expect(retryableAircraft(outcome)).toEqual([3])
  })
})
