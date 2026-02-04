import { countries, type CountryData } from '@kuuki/data'

/**
 * Get country data by ISO alpha-2 code
 */
export function getCountryData(code: string): CountryData | undefined {
  return countries[code.toUpperCase()]
}

/**
 * Get country name by ISO alpha-2 code
 */
export function getCountryName(code: string): string {
  return countries[code.toUpperCase()]?.name || code
}

/**
 * Get country's dominant flag color
 */
export function getCountryColor(code: string): string {
  return countries[code.toUpperCase()]?.dominantColor || '#6b7280'
}

/**
 * Get country's continent
 */
export function getCountryContinent(code: string): string | undefined {
  return countries[code.toUpperCase()]?.continent
}

/**
 * Get all countries in a continent
 */
export function getCountriesByContinent(continent: string): string[] {
  return Object.entries(countries)
    .filter(([, data]) => data.continent === continent.toLowerCase())
    .map(([code]) => code)
}

/**
 * Get total country count
 */
export function getTotalCountryCount(): number {
  return Object.keys(countries).length
}

/**
 * Calculate world completion percentage
 */
export function calculateWorldCompletion(visitedCodes: string[]): number {
  const total = getTotalCountryCount()
  const visited = new Set(visitedCodes.map(c => c.toUpperCase())).size
  return (visited / total) * 100
}

/**
 * Get continent breakdown from visited countries
 */
export function getContinentBreakdown(visitedCodes: string[]): Record<string, number> {
  const breakdown: Record<string, number> = {
    europe: 0,
    asia: 0,
    africa: 0,
    americas: 0,
    oceania: 0,
  }

  for (const code of visitedCodes) {
    const continent = getCountryContinent(code)
    if (continent && continent in breakdown) {
      breakdown[continent]++
    }
  }

  return breakdown
}

/**
 * Get continent totals
 */
export function getContinentTotals(): Record<string, number> {
  const totals: Record<string, number> = {
    europe: 0,
    asia: 0,
    africa: 0,
    americas: 0,
    oceania: 0,
  }

  for (const data of Object.values(countries)) {
    if (data.continent in totals) {
      totals[data.continent]++
    }
  }

  return totals
}
