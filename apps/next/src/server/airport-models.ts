import 'server-only'
import { airportCatalog } from '../lib/airport-models/catalog.generated'
import { decodeAirportScope } from '../lib/airport-models/scope'

export function airportEntry(iata: string) {
  return airportCatalog.find((entry) => entry.iata === iata)
}
export function airportQuery(query: Record<string, string | string[] | undefined>) {
  const scope = typeof query.scope === 'string' ? query.scope : null
  let invalidScope = query.scope !== undefined && scope === null
  if (scope !== null) {
    try {
      decodeAirportScope(scope)
    } catch {
      invalidScope = true
    }
  }
  return {
    scope,
    invalidScope,
    backToken: typeof query.back === 'string' ? query.back : null,
    compare: typeof query.compare === 'string' ? query.compare.toUpperCase() : null,
  }
}
