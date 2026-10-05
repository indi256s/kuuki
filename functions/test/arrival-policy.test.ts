// ADR 0001 §4 "Effective arrival policy": explicit decision, prospective default for awaiting flights, existing policy.
import { describe, expect, it } from 'vitest'
import { arrivalSuppressions, effectiveArrivalPolicies, type EvidenceFlight } from '../api/_services/countryEvidence'

const COUNTRY: Record<string, string> = { TBS: 'GE', IST: 'TR', JFK: 'US', LHR: 'GB', ADB: 'TR' }
const HOUR = 3_600_000
const T0 = Date.parse('2026-03-01T22:00:00.000Z')
const iso = (hours: number) => new Date(T0 + hours * HOUR).toISOString()

function flight(id: number, origin: string, destination: string, over: Partial<EvidenceFlight> = {}): EvidenceFlight {
  return {
    id, date: '2026-03-01', origin, destination, lifecycle_state: 'awaiting', arrival_transit: null, arrival_transit_leg_id: null,
    departure_utc: null, arrival_utc: null, origin_country: COUNTRY[origin] ?? null, origin_city: origin,
    destination_country: COUNTRY[destination] ?? null, destination_city: destination, ...over,
  }
}
const timed = (id: number, o: string, d: string, dep: number, arr: number, over: Partial<EvidenceFlight> = {}) =>
  flight(id, o, d, { departure_utc: iso(dep), arrival_utc: iso(arr), ...over })

const policy = (flights: EvidenceFlight[], id: number) => effectiveArrivalPolicies(flights).get(id)

describe('effectiveArrivalPolicies', () => {
  it('rule 2: an awaiting flight with a precise third-country connection defaults to transit with the matched leg', () => {
    const flights = [timed(1, 'TBS', 'IST', -4, 0), timed(2, 'IST', 'JFK', 3, 12, { lifecycle_state: 'upcoming' })]
    expect(policy(flights, 1)).toEqual({ transit: true, source: 'default', legId: 2, label: 'precise' })
    expect(policy(flights, 2)).toBeUndefined() // upcoming flights have no arrival policy
  })

  it('rule 2: a unique date-only same or next day candidate is a default, labelled estimated', () => {
    const flights = [flight(1, 'TBS', 'IST'), flight(2, 'IST', 'JFK', { date: '2026-03-02', lifecycle_state: 'upcoming' })]
    expect(policy(flights, 1)).toEqual({ transit: true, source: 'default', legId: 2, label: 'estimated' })
  })

  it('rule 2: ambiguity or a non-third-country hub never defaults to transit', () => {
    const ambiguous = [flight(1, 'TBS', 'IST'), flight(2, 'IST', 'JFK'), flight(3, 'IST', 'LHR')]
    expect(policy(ambiguous, 1)).toEqual({ transit: false, source: 'existing', legId: null, label: null })
    const domesticFinal = [timed(1, 'TBS', 'IST', -4, 0), timed(2, 'IST', 'ADB', 3, 5)]
    expect(policy(domesticFinal, 1)?.transit).toBe(false)
  })

  it('rule 1: an explicit decision always wins over the live chain, in both directions', () => {
    const chain = [timed(1, 'TBS', 'IST', -4, 0), timed(2, 'IST', 'JFK', 3, 12)]
    expect(policy([{ ...chain[0], arrival_transit: 0 }, chain[1]], 1)).toEqual({ transit: false, source: 'explicit', legId: null, label: null })
    const alone = [timed(1, 'TBS', 'IST', -4, 0, { arrival_transit: 1, arrival_transit_leg_id: null })]
    expect(policy(alone, 1)).toEqual({ transit: true, source: 'explicit', legId: null, label: null })
  })

  it('rule 1: transit consumes the stored leg, never a different live one, and not a leg that no longer departs from the hub', () => {
    const stored = timed(1, 'TBS', 'IST', -4, 0, { lifecycle_state: 'logged', arrival_transit: 1, arrival_transit_leg_id: 2 })
    const live = [stored, timed(2, 'IST', 'JFK', 3, 12, { lifecycle_state: 'logged' }), timed(3, 'IST', 'LHR', 4, 8, { lifecycle_state: 'logged' })]
    expect(policy(live, 1)?.legId).toBe(2)
    expect(arrivalSuppressions(live).map(row => `${row.flight_id}:${row.endpoint}`)).toEqual(['1:destination', '2:origin'])
    // The stored leg was edited to depart elsewhere: only the destination stays suppressed, nothing moves to leg 3.
    const moved = [stored, { ...live[1], origin: 'LHR', origin_country: 'GB' }, live[2]]
    expect(policy(moved, 1)?.legId).toBeNull()
    expect(arrivalSuppressions(moved).map(row => `${row.flight_id}:${row.endpoint}`)).toEqual(['1:destination'])
    // The stored leg was deleted.
    expect(policy([stored, live[2]], 1)?.legId).toBeNull()
  })

  it('rule 3: a logged flight with no decision keeps the existing include policy, even inside a connection', () => {
    const flights = [timed(1, 'TBS', 'IST', -4, 0, { lifecycle_state: 'logged' }), timed(2, 'IST', 'JFK', 3, 12)]
    expect(policy(flights, 1)).toEqual({ transit: false, source: 'existing', legId: null, label: null })
    expect(arrivalSuppressions(flights)).toEqual([])
  })

  it('suppresses nothing for countries of unknown airports', () => {
    const flights = [timed(1, 'TBS', 'ZZZ', -4, 0), timed(2, 'ZZZ', 'JFK', 3, 12)]
    expect(arrivalSuppressions(flights)).toEqual([])
  })
})
