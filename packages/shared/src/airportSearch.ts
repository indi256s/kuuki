// One source for airport search aliases and text folding, used by the capture combobox and by the
// Journal search predicate on the server, so a city typed in Russian finds the same airports in both.

export interface AirportAlias { city: string; name: string; native: string }

// Russian names: Russian Wikipedia airport articles «Шереметьево», «Домодедово»,
// «Внуково», «Тбилиси (аэропорт)», «Стамбул (аэропорт)».
// Native names: Tbilisi Airport (tbilisiairport.com) and İstanbul Airport (istairport.com).
// The catalog itself has English names only; these five aliases are curated offline.
export const airportAliases: Record<string, AirportAlias> = {
  SVO: { city: 'Москва', name: 'Шереметьево', native: 'Москва Шереметьево' },
  DME: { city: 'Москва', name: 'Домодедово', native: 'Москва Домодедово' },
  VKO: { city: 'Москва', name: 'Внуково', native: 'Москва Внуково' },
  TBS: { city: 'Тбилиси', name: 'Международный аэропорт Тбилиси', native: 'თბილისი თბილისის საერთაშორისო აეროპორტი' },
  IST: { city: 'Стамбул', name: 'Аэропорт Стамбул', native: 'İstanbul İstanbul Havalimanı' },
}

/** Unicode-aware case and diacritic folding: «Тбилиси» = «тБиЛиСи», «İstanbul» = «istanbul», «ё» = «е». */
export function foldSearchText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '')
}

export interface AirportSearchRow { iata: string; name: string; city: string }

/** Text a search word is matched against: code, English city and name, then the curated aliases. */
export function airportSearchText(row: AirportSearchRow): string {
  const alias = airportAliases[row.iata]
  return foldSearchText(`${row.iata} ${row.city} ${row.name}${alias ? ` ${alias.city} ${alias.name} ${alias.native}` : ''}`)
}

/**
 * IATA codes of every airport whose city, name or alias contains `word`. A word shorter than two
 * characters resolves to nothing: it would match most of the catalog and the plain text match covers it.
 */
export function resolveAirportCodes(word: string, rows: readonly AirportSearchRow[], limit = 400): string[] {
  const needle = foldSearchText(word.trim())
  if (needle.length < 2) return []
  const codes: string[] = []
  for (const row of rows) {
    if (!row.iata || !airportSearchText(row).includes(needle)) continue
    codes.push(row.iata.toUpperCase())
    if (codes.length >= limit) break
  }
  return codes
}
