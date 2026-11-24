import { countryContributions, type EvidenceFlight } from './countryEvidence'
import type { FlightFirsts } from './journalPayload'

export type FirstsFlight = EvidenceFlight & {
  airline_iata: string | null
  aircraft_icao: string | null
}

export interface FirstsInput {
  flights: FirstsFlight[]
  claims: Array<{ country_code: string | null }>
  ground: Array<{ country_code: string | null; visit_year: number | null }>
  legacy: Array<{
    country_code: string | null
    reference_country_code: string | null
    first_visit: string | null
  }>
}

const DAY = /^\d{4}-\d{2}-\d{2}/
const isCountry = (code: unknown): code is string => typeof code === 'string' && code.length === 2
const dayOf = (value: unknown): string | null =>
  typeof value === 'string' && DAY.test(value) ? value.slice(0, 10) : null
const yearDay = (year: unknown): string | null =>
  typeof year === 'number' && Number.isInteger(year) && year >= 1 && year <= 9999
    ? `${String(year).padStart(4, '0')}-01-01`
    : null

function compareFlights(a: FirstsFlight, b: FirstsFlight): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.departure_utc !== b.departure_utc) {
    if (a.departure_utc === null) return 1
    if (b.departure_utc === null) return -1
    return a.departure_utc < b.departure_utc ? -1 : 1
  }
  return a.id - b.id
}

export function journalFirsts(input: FirstsInput): Record<number, FlightFirsts> {
  const flights = input.flights.filter(
    (flight) => flight && typeof flight.id === 'number' && typeof flight.date === 'string',
  )

  const evidence = new Map<string, string | null>()
  const note = (country: unknown, day: string | null) => {
    if (!isCountry(country)) return
    const prior = evidence.get(country)
    if (prior === null) return
    if (prior === undefined || day === null || day < prior) evidence.set(country, day)
  }
  for (const claim of input.claims) note(claim?.country_code, null)
  for (const visit of input.ground) note(visit?.country_code, yearDay(visit?.visit_year))
  for (const row of input.legacy)
    note(row?.country_code ?? row?.reference_country_code, dayOf(row?.first_visit))

  const countriesOf = new Map<number, string[]>()
  for (const contribution of countryContributions(flights).contributions) {
    const list = countriesOf.get(contribution.flight_id) ?? []
    if (!list.includes(contribution.country_code)) list.push(contribution.country_code)
    countriesOf.set(contribution.flight_id, list)
  }
  for (const flight of flights) {
    if (dayOf(flight.date) === null)
      for (const country of countriesOf.get(flight.id) ?? []) note(country, null)
  }

  const seenCountries = new Set<string>()
  const seenAirlines = new Set<string>()
  const seenAircraft = new Set<string>()
  const firsts: Record<number, FlightFirsts> = {}
  for (const flight of [...flights].sort(compareFlights)) {
    const day = dayOf(flight.date)
    if (flight.lifecycle_state === 'upcoming' || day === null) continue
    const countries: string[] = []
    for (const country of countriesOf.get(flight.id) ?? []) {
      if (seenCountries.has(country)) continue
      seenCountries.add(country)
      const blocker = evidence.get(country)
      if (blocker === undefined || (blocker !== null && blocker > day)) countries.push(country)
    }
    const airline =
      typeof flight.airline_iata === 'string' &&
      flight.airline_iata !== '' &&
      !seenAirlines.has(flight.airline_iata)
    if (airline) seenAirlines.add(flight.airline_iata!)
    const aircraft =
      typeof flight.aircraft_icao === 'string' &&
      flight.aircraft_icao !== '' &&
      !seenAircraft.has(flight.aircraft_icao)
    if (aircraft) seenAircraft.add(flight.aircraft_icao!)
    if (countries.length > 0 || airline || aircraft) {
      firsts[flight.id] = {
        countries,
        aircraft,
        airline,
        pending: flight.lifecycle_state !== 'logged',
      }
    }
  }
  return firsts
}
