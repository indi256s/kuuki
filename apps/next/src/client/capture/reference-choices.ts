import airports from '@kuuki/data/airports'
import airlines from '@kuuki/data/airlines'
import aircraft from '@kuuki/data/aircraft'
import { airportAliases } from '@kuuki/shared'
import type { Choice } from '../ui/combobox'
import type { Locale } from '../../lib/format'

export function airportChoices(locale: Locale): Choice[] {
  return airports.filter(row => row.iata).map(row => {
    const alias = airportAliases[row.iata]
    return { code: row.iata, label: locale === 'ru' && alias ? alias.name : row.name,
      detail: locale === 'ru' && alias ? alias.city : row.city,
      search: `${row.city} ${row.name} ${alias ? `${alias.city} ${alias.name} ${alias.native}` : ''}`,
      fallback: locale === 'ru' && !alias }
  })
}
export const airlineChoices: Choice[] = airlines.filter(row => row.iata).map(row => ({ code: row.iata, label: row.name, fallback: true }))
export const aircraftChoices: Choice[] = aircraft.filter(row => row.icao).map(row => ({ code: row.icao, label: row.name, fallback: true }))
