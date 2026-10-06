import { countries, type CountryData } from '@kuuki/data'

/** Get country data by ISO alpha-2 code. */
export function getCountryData(code: string): CountryData | undefined {
  return countries[code.toUpperCase()]
}
