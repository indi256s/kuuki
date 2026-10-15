// The same import form as @kuuki/data's own lookups: a JSON file imported both with and without the attribute is
// bundled twice (ESM and CommonJS copies).
import airports from '@kuuki/data/airports' with { type: 'json' }
import airlines from '@kuuki/data/airlines' with { type: 'json' }
import aircraft from '@kuuki/data/aircraft' with { type: 'json' }
import { airportAliases } from '@kuuki/shared'
import type { Choice } from '../ui/combobox'
import type { Locale } from '../../lib/format'

const airportCache = new Map<Locale, Choice[]>()
/** Built once per locale: the list is large, and a stable array lets searches memoise on it. */
export function airportChoices(locale: Locale): Choice[] {
  const cached = airportCache.get(locale)
  if (cached) return cached
  const choices = airports
    .filter((row) => row.iata)
    .map((row) => {
      const alias = airportAliases[row.iata]
      return {
        code: row.iata,
        label: locale === 'ru' && alias ? alias.name : row.name,
        detail: locale === 'ru' && alias ? alias.city : row.city,
        search: `${row.city} ${row.name} ${alias ? `${alias.city} ${alias.name} ${alias.native}` : ''}`,
        fallback: locale === 'ru' && !alias,
      }
    })
  airportCache.set(locale, choices)
  return choices
}
export const airlineChoices: Choice[] = airlines
  .filter((row) => row.iata)
  .map((row) => ({ code: row.iata, label: row.name, fallback: true }))
// Certified designations: EASA.IM.A.071, https://www.easa.europa.eu/en/downloads/7382/en.
const aircraftAliases: Record<string, string> = {
  E290: 'ERJ 190-300',
  E295: 'ERJ 190-400',
}
export const aircraftChoices: Choice[] = aircraft
  .filter((row) => row.icao)
  .map((row) => ({
    code: row.icao,
    label: row.name,
    search: `${row.iata ?? ''} ${row.manufacturer} ${row.model} ${aircraftAliases[row.icao] ?? ''}`,
    fallback: true,
  }))
