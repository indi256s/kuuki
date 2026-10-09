// Display names for ids the summary carries. The summary stays free of localized text; the page resolves names
// from the bundled reference data on the server and passes them in, and tests pass plain fakes.
import { findAircraft } from '@kuuki/data/aircraft-lookup'
import { findAirport } from '@kuuki/data/airport-lookup'
import { airlineName } from '../import/reference'
import type { Locale } from '../../lib/format'

export interface OverviewLabels {
  airline(code: string): string
  aircraft(icao: string): string
  airport(iata: string): string
  country(code: string): string
}

export function referenceLabels(locale: Locale): OverviewLabels {
  const regions = new Intl.DisplayNames([locale], { type: 'region' })
  return {
    airline: (code) => airlineName(code) ?? code,
    aircraft: (icao) => findAircraft(icao)?.name ?? icao,
    airport: (iata) => {
      const city = findAirport(iata)?.city
      return city ? `${iata} · ${city}` : iata
    },
    country: (code) => {
      try {
        return regions.of(code) ?? code
      } catch {
        return code
      }
    },
  }
}
