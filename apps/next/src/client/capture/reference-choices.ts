import airports from '@kuuki/data/airports'
import airlines from '@kuuki/data/airlines'
import aircraft from '@kuuki/data/aircraft'
import type { Choice } from '../ui/combobox'
import type { Locale } from '../../lib/format'

// Russian names: Russian Wikipedia airport articles «Шереметьево», «Домодедово»,
// «Внуково», «Тбилиси (аэропорт)», «Стамбул (аэропорт)».
// Native names: Tbilisi Airport (tbilisiairport.com) and İstanbul Airport (istairport.com).
// The catalog itself has English names only; these five aliases are curated offline.
const airportAliases: Record<string, { city: string; name: string; native: string }> = {
  SVO: { city: 'Москва', name: 'Шереметьево', native: 'Москва Шереметьево' },
  DME: { city: 'Москва', name: 'Домодедово', native: 'Москва Домодедово' },
  VKO: { city: 'Москва', name: 'Внуково', native: 'Москва Внуково' },
  TBS: { city: 'Тбилиси', name: 'Международный аэропорт Тбилиси', native: 'თბილისი თბილისის საერთაშორისო აეროპორტი' },
  IST: { city: 'Стамбул', name: 'Аэропорт Стамбул', native: 'İstanbul İstanbul Havalimanı' },
}
export function airportChoices(locale: Locale): Choice[] {
  return airports.filter(row => row.iata).map(row => {
    const alias = airportAliases[row.iata]
    return { code: row.iata, label: locale === 'ru' && alias ? alias.name : row.name,
      detail: locale === 'ru' && alias ? alias.city : row.city,
      search: `${row.city} ${row.name} ${alias ? `${alias.city} ${alias.name} ${alias.native}` : ''}`,
      fallback: locale === 'ru' && !alias }
  })
}
export const airlineChoices: Choice[] = airlines.filter(row => row.iata).map(row => ({ code: row.iata, label: row.name }))
export const aircraftChoices: Choice[] = aircraft.filter(row => row.icao).map(row => ({ code: row.icao, label: row.name }))
