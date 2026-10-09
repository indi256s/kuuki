// Spec D2: journal firsts over the whole journal, ordered by date, departure instant and id.
import { describe, expect, it } from 'vitest'
import { journalFirsts, type FirstsFlight, type FirstsInput } from '../api/_services/firsts'

const COUNTRY: Record<string, string> = { TBS: 'GE', KUT: 'GE', IST: 'TR', JFK: 'US', LHR: 'GB' }

function flight(id: number, date: string, origin: string, destination: string, extra: Partial<FirstsFlight> = {}): FirstsFlight {
  return {
    id, date, origin, destination, lifecycle_state: 'logged', arrival_transit: null, arrival_transit_leg_id: null,
    departure_utc: null, arrival_utc: null, origin_country: COUNTRY[origin] ?? null, origin_city: null,
    destination_country: COUNTRY[destination] ?? null, destination_city: null, airline_iata: null, aircraft_icao: null, ...extra,
  }
}

const firsts = (flights: FirstsFlight[], evidence: Partial<Omit<FirstsInput, 'flights'>> = {}) =>
  journalFirsts({ flights, claims: [], ground: [], legacy: [], ...evidence })

describe('journalFirsts', () => {
  it('gives a transit-suppressed endpoint no country first', () => {
    const result = firsts([
      flight(1, '2025-01-01', 'TBS', 'IST', { arrival_transit: 1, arrival_transit_leg_id: 2 }),
      flight(2, '2025-01-01', 'IST', 'JFK'),
    ])
    expect(result[1].countries).toEqual(['GE'])
    expect(result[2].countries).toEqual(['US'])
    expect(Object.values(result).flatMap(entry => entry.countries)).not.toContain('TR')
  })

  it('marks the firsts of an awaiting flight pending', () => {
    const result = firsts([flight(1, '2025-01-01', 'TBS', 'IST', { lifecycle_state: 'awaiting', airline_iata: 'TK', aircraft_icao: 'A321' })])
    expect(result[1]).toEqual({ countries: ['GE', 'TR'], airline: true, aircraft: true, pending: true })
  })

  it('moves every first to the next flight when the first flight is gone', () => {
    const first = flight(1, '2025-01-01', 'TBS', 'IST', { airline_iata: 'TK', aircraft_icao: 'A321' })
    const second = flight(2, '2025-02-01', 'TBS', 'IST', { airline_iata: 'TK', aircraft_icao: 'A321' })
    expect(firsts([first, second])[2]).toBeUndefined()
    expect(firsts([second])[2]).toEqual({ countries: ['GE', 'TR'], airline: true, aircraft: true, pending: false })
  })

  it('lets a claim block its country even when it was entered after the flight', () => {
    const flights = [flight(1, '2025-03-01', 'TBS', 'IST')]
    expect(firsts(flights, { claims: [{ country_code: 'TR' }] })[1].countries).toEqual(['GE'])
  })

  it('lets undated non-flight evidence block a country first', () => {
    const flights = [flight(1, '2025-03-01', 'TBS', 'IST')]
    expect(firsts(flights, { claims: [{ country_code: 'TR' }] })[1].countries).toEqual(['GE'])
    expect(firsts(flights, { ground: [{ country_code: 'GE', visit_year: null }] })[1].countries).toEqual(['TR'])
    expect(firsts(flights, { legacy: [{ country_code: null, reference_country_code: 'TR', first_visit: 'garbage' }] })[1].countries).toEqual(['GE'])
  })

  it('dates a ground visit to its year and legacy evidence to its first visit', () => {
    const flights = [flight(1, '2025-03-01', 'TBS', 'IST')]
    expect(firsts(flights, { ground: [{ country_code: 'TR', visit_year: 2025 }] })[1].countries).toEqual(['GE'])
    expect(firsts(flights, { ground: [{ country_code: 'TR', visit_year: 2026 }] })[1].countries).toEqual(['GE', 'TR'])
    expect(firsts(flights, { legacy: [{ country_code: 'GE', reference_country_code: 'GE', first_visit: '2019-05-01' }] })[1].countries).toEqual(['TR'])
  })

  it('breaks a same-day tie by departure instant, unknown last, then by id', () => {
    const byInstant = firsts([
      flight(5, '2025-01-01', 'TBS', 'IST', { departure_utc: '2025-01-01T12:00:00.000Z', airline_iata: 'TK' }),
      flight(6, '2025-01-01', 'TBS', 'IST', { departure_utc: '2025-01-01T08:00:00.000Z', airline_iata: 'TK' }),
      flight(4, '2025-01-01', 'TBS', 'IST', { airline_iata: 'TK' }),
    ])
    expect(Object.keys(byInstant)).toEqual(['6'])
    const byId = firsts([flight(8, '2025-01-01', 'TBS', 'IST', { airline_iata: 'TK' }), flight(7, '2025-01-01', 'TBS', 'IST', { airline_iata: 'TK' })])
    expect(Object.keys(byId)).toEqual(['7'])
  })

  it('never gives an upcoming flight a first', () => {
    const result = firsts([
      flight(1, '2025-01-01', 'TBS', 'IST', { lifecycle_state: 'upcoming', airline_iata: 'TK', aircraft_icao: 'A321' }),
      flight(2, '2025-02-01', 'TBS', 'IST', { airline_iata: 'TK', aircraft_icao: 'A321' }),
    ])
    expect(result[1]).toBeUndefined()
    expect(result[2]).toEqual({ countries: ['GE', 'TR'], airline: true, aircraft: true, pending: false })
  })

  it('never earns an airline or aircraft first without a code', () => {
    const result = firsts([flight(1, '2025-01-01', 'TBS', 'IST'), flight(2, '2025-02-01', 'TBS', 'IST', { airline_iata: 'TK' })])
    expect(result[1]).toEqual({ countries: ['GE', 'TR'], airline: false, aircraft: false, pending: false })
    expect(result[2]).toEqual({ countries: [], airline: true, aircraft: false, pending: false })
  })

  it('skips malformed rows instead of throwing', () => {
    const result = firsts([flight(1, 'not-a-date', 'TBS', 'IST', { airline_iata: 'TK' }), flight(2, '2025-02-01', 'TBS', 'LHR', { airline_iata: 'TK' })], {
      claims: [{ country_code: null }], ground: [{ country_code: 'TOOLONG', visit_year: 2020 }],
      legacy: [{ country_code: null, reference_country_code: null, first_visit: null }],
    })
    expect(result[1]).toBeUndefined()
    // The undatable flight still supports GE and TR in the Passport, so the dated flight cannot claim GE first.
    expect(result[2]).toEqual({ countries: ['GB'], airline: true, aircraft: false, pending: false })
  })
})
