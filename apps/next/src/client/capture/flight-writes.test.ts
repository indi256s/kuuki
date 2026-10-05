// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearFlightCreateOperations } from '../../../../web/src/lib/flightCreateOperations'
import { browserTimezone, createFlight, createFlights, updateFlight } from './flight-writes'

const post = vi.fn()
const patch = vi.fn()
vi.mock('../../../../web/src/lib/apiClient', () => ({
  api: { post: (...args: unknown[]) => post(...args), patch: (...args: unknown[]) => patch(...args) },
  ApiError: class ApiError extends Error { constructor(public status: number, message: string, public code?: string) { super(message) } },
}))

const input = { date: '2026-10-05', origin: 'TBS', destination: 'IST', source: 'manual' as const }
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

describe('flight writes carry the browser IANA timezone (ADR 0001 §1)', () => {
  beforeEach(() => { post.mockReset(); patch.mockReset(); clearFlightCreateOperations(); localStorage.clear() })

  it('reads the zone from Intl', () => {
    expect(browserTimezone()).toBe(zone())
    expect(browserTimezone()).toMatch(/^[A-Za-z_]+(\/[A-Za-z_+\-0-9]+)*$/)
  })

  it('sends timezone next to the flight fields on create and keeps it out of the stored retry payload', async () => {
    post.mockResolvedValue({ id: 7, date: input.date, origin: 'TBS', destination: 'IST', lifecycle_state: 'logged', derived_state: 'ready' })
    const saved = await createFlight({ ...input, user_id: 'u1' } as never, 'op-1')
    const [path, body, options] = post.mock.calls[0]
    expect(path).toBe('/api/flights')
    expect(body).toEqual({ date: '2026-10-05', origin: 'TBS', destination: 'IST', source: 'manual', timezone: zone() })
    expect(options.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(saved).toMatchObject({ id: 7, user_id: 'u1', lifecycle_state: 'logged' })
    expect(localStorage.length).toBe(0) // receipt completed
  })

  it('stores the payload without the zone so a retry from another zone is the same operation', async () => {
    post.mockRejectedValueOnce(new Error('network'))
    await expect(createFlight({ ...input, user_id: 'u1' } as never, 'op-2')).rejects.toThrow('network')
    const stored = JSON.parse(localStorage.getItem(localStorage.key(0)!)!) as { payload: string }
    expect(JSON.parse(stored.payload)).not.toHaveProperty('timezone')
    post.mockResolvedValueOnce({ id: 8, date: input.date, origin: 'TBS', destination: 'IST' })
    await createFlight({ ...input, user_id: 'u1' } as never, 'op-2')
    expect(post.mock.calls[1][2].headers['Idempotency-Key']).toBe(post.mock.calls[0][2].headers['Idempotency-Key'])
  })

  it('sends one top-level timezone per bulk request, not one per item', async () => {
    post.mockResolvedValue({ derived_state: 'ready', results: [{ status: 'created' }, { status: 'error', http_status: 400, code: 'UNKNOWN_AIRPORT', error: 'nope' }] })
    const outcomes = await createFlights('u1', [
      { operationId: 'a', flight: { ...input } as never }, { operationId: 'b', flight: { ...input, destination: 'JFK' } as never },
    ])
    const [path, body] = post.mock.calls[0]
    expect(path).toBe('/api/flights/bulk')
    expect(body.timezone).toBe(zone())
    expect(body.items).toHaveLength(2)
    for (const item of body.items) expect(item.flight).not.toHaveProperty('timezone')
    expect(outcomes[0]).toBeNull()
    expect(outcomes[1]).toMatchObject({ code: 'UNKNOWN_AIRPORT' })
  })

  it('sends timezone with an edit and never sends lifecycle or owner fields', async () => {
    patch.mockResolvedValue({ id: 3, date: '2026-10-06', origin: 'TBS', destination: 'IST', lifecycle_state: 'upcoming' })
    await updateFlight(3, { date: '2026-10-06', is_upcoming: true, user_id: 'u1', id: 3, created_at: 'x' } as never)
    expect(patch).toHaveBeenCalledWith('/api/flights/3', { date: '2026-10-06', timezone: zone() })
  })

  it('omits the field when the browser cannot name a zone', async () => {
    const original = Intl.DateTimeFormat
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({ resolvedOptions: () => ({ timeZone: undefined }) }) as never)
    try {
      patch.mockResolvedValue({ id: 3 })
      await updateFlight(3, { flight_number: 'KU1' } as never)
      expect(patch).toHaveBeenCalledWith('/api/flights/3', { flight_number: 'KU1' })
    } finally { vi.restoreAllMocks(); expect(Intl.DateTimeFormat).toBe(original) }
  })
})
