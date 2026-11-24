export interface AirportAlias {
  city: string
  name: string
  native: string
}

export const airportAliases: Record<string, AirportAlias> = {
  SVO: { city: 'Москва', name: 'Шереметьево', native: 'Москва Шереметьево' },
  DME: { city: 'Москва', name: 'Домодедово', native: 'Москва Домодедово' },
  VKO: { city: 'Москва', name: 'Внуково', native: 'Москва Внуково' },
  TBS: {
    city: 'Тбилиси',
    name: 'Международный аэропорт Тбилиси',
    native: 'თბილისი თბილისის საერთაშორისო აეროპორტი',
  },
  IST: { city: 'Стамбул', name: 'Аэропорт Стамбул', native: 'İstanbul İstanbul Havalimanı' },
}

export function foldSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
}

export interface AirportSearchRow {
  iata: string
  name: string
  city: string
}

export function airportSearchText(row: AirportSearchRow): string {
  const alias = airportAliases[row.iata]
  return foldSearchText(
    `${row.iata} ${row.city} ${row.name}${alias ? ` ${alias.city} ${alias.name} ${alias.native}` : ''}`,
  )
}

export function resolveAirportCodes(
  word: string,
  rows: readonly AirportSearchRow[],
  limit = 400,
): string[] {
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
