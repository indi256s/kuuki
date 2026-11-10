// Catalog lookups for the Flighty mapper (ADR 0008). One definition for the API and the offline evaluator.
// Airports come from the offline catalog with its IANA zone; the zone of an airport without one is derived from its
// coordinates, as flight metrics do. Final airport existence is still checked against D1 when a flight is written.
import airlineCatalog from '../../../packages/data/src/airlines.json'
import aircraftCatalog from '../../../packages/data/src/aircraft.json'
import { findAirport } from '../../../packages/data/src/airport-lookup'
import type { FlightyRefs } from '../../../packages/shared/src/flighty'
import { zoneAt } from '../_lib/zones'

let byIcao: Map<string, string[]> | undefined
let airlineIatas: Set<string> | undefined
let aircraftByName: Map<string, string[]> | undefined

function airlines() {
  if (!byIcao || !airlineIatas) {
    byIcao = new Map()
    airlineIatas = new Set()
    for (const airline of airlineCatalog as Array<{ iata: string; icao: string | null }>) {
      airlineIatas.add(airline.iata)
      if (!airline.icao) continue
      byIcao.set(airline.icao, [...(byIcao.get(airline.icao) ?? []), airline.iata])
    }
  }
  return { byIcao, airlineIatas }
}

function aircraft() {
  if (!aircraftByName) {
    aircraftByName = new Map()
    for (const type of aircraftCatalog as Array<{ icao: string; name: string; model: string }>)
      for (const label of new Set([type.name, type.model].map((value) => value.toLowerCase())))
        aircraftByName.set(label, [...(aircraftByName.get(label) ?? []), type.icao])
  }
  return aircraftByName
}

export const catalogFlightyRefs: FlightyRefs = {
  airlinesByIcao: (icao) => airlines().byIcao.get(icao) ?? [],
  airlineExists: (iata) => airlines().airlineIatas.has(iata),
  airport(iata) {
    const airport = findAirport(iata)
    if (!airport) return null
    if (airport.timezone) return { timezone: airport.timezone }
    const { latitude, longitude } = airport
    return {
      timezone:
        Number.isFinite(latitude) && Number.isFinite(longitude)
          ? zoneAt({ lat: latitude, lon: longitude })
          : null,
    }
  },
  aircraftByName: (name) => aircraft().get(name.trim().toLowerCase()) ?? [],
}
