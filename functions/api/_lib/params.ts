// Shared request-parameter parsers. Each throws HttpError(400) on bad input.

import { HttpError } from './http'

/** ISO 3166-1 alpha-2 country code, uppercase only. */
export function parseCountryCode(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z]{2}$/.test(value)) throw new HttpError(400, 'Invalid country code', 'INVALID_COUNTRY')
  return value
}
