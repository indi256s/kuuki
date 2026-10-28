import airlines from '@kuuki/data/airlines' with { type: 'json' }
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import type { Locale } from '../../lib/format'

export interface OverviewLabels {
  airline(code: string): string
  aircraft(icao: string): string
  airport(iata: string): string
  country(code: string): string
}

const airlineNames = new Map(airlines.filter((row) => row.iata).map((row) => [row.iata, row.name]))

// Airport and aircraft labels travel with the summary. The offline capture catalogs belong to the editor.
export function referenceLabels(
  locale: Locale,
  refs: OverviewPayload['refs'] | undefined,
): OverviewLabels {
  const regions = new Intl.DisplayNames([locale], { type: 'region' })
  return {
    airline: (code) => airlineNames.get(code.toUpperCase()) ?? code,
    aircraft: (icao) => refs?.aircraft[icao]?.name ?? icao,
    airport: (iata) => {
      const city = refs?.airports[iata]?.city
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
