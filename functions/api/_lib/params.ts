import { HttpError } from './http'
import { isCatalogCountry } from './regions'

export function parseCountryCode(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z]{2}$/.test(value))
    throw new HttpError(400, 'Invalid country code', 'INVALID_COUNTRY')
  return value
}

export function parseCatalogCountryCode(value: unknown): string {
  const code = parseCountryCode(value)
  if (!isCatalogCountry(code)) throw new HttpError(400, 'Unknown country code', 'INVALID_COUNTRY')
  return code
}
