import {
  validateFlightInput,
  type FlightInput,
} from '../../../packages/shared/src/flightValidation'
import { HttpError } from './http'

export async function parseFlightBody(
  db: D1Database,
  raw: unknown,
  mode: 'create' | 'patch',
  existing?: { origin: string; destination: string; aircraft_icao: string | null },
): Promise<FlightInput> {
  let input: FlightInput
  try {
    input = validateFlightInput(raw, mode)
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : 'Invalid flight',
      'INVALID_FLIGHT',
    )
  }
  for (const key of ['origin', 'destination'] as const) {
    const value = input[key]
    if (!value) continue
    if (mode === 'patch' && value === existing?.[key]) continue
    const exists = await db
      .prepare('SELECT 1 AS found FROM airports_reference WHERE iata = ?')
      .bind(value)
      .first()
    if (!exists) throw new HttpError(400, `${key} airport does not exist`, 'UNKNOWN_AIRPORT')
  }
  if (
    input.aircraft_icao &&
    !(mode === 'patch' && input.aircraft_icao === existing?.aircraft_icao)
  ) {
    const exists = await db
      .prepare('SELECT 1 AS found FROM aircraft_reference WHERE icao = ?')
      .bind(input.aircraft_icao)
      .first()
    if (!exists) throw new HttpError(400, 'aircraft_icao does not exist', 'UNKNOWN_AIRCRAFT')
  }
  return input
}

/** Validate create bodies independently, with one reference lookup per table for the whole set. */
export async function parseFlightBodies(
  db: D1Database,
  raws: unknown[],
): Promise<Array<FlightInput | HttpError>> {
  const parsed: Array<FlightInput | HttpError> = raws.map((raw) => {
    try {
      return validateFlightInput(raw, 'create')
    } catch (error) {
      return new HttpError(
        400,
        error instanceof Error ? error.message : 'Invalid flight',
        'INVALID_FLIGHT',
      )
    }
  })
  const inputs = parsed.filter((item): item is FlightInput => !(item instanceof HttpError))
  const known = async (table: string, column: string, values: string[]) => {
    if (values.length === 0) return new Set<string>()
    const rows = await db
      .prepare(
        `SELECT ${column} AS code FROM ${table} WHERE ${column} IN (SELECT value FROM json_each(?))`,
      )
      .bind(JSON.stringify([...new Set(values)]))
      .all<{ code: string }>()
    return new Set(rows.results.map((row) => row.code))
  }
  const airports = await known(
    'airports_reference',
    'iata',
    inputs.flatMap((input) => [input.origin!, input.destination!]),
  )
  const aircraft = await known(
    'aircraft_reference',
    'icao',
    inputs.flatMap((input) => (input.aircraft_icao ? [input.aircraft_icao] : [])),
  )
  return parsed.map((input) => {
    if (input instanceof HttpError) return input
    for (const key of ['origin', 'destination'] as const) {
      if (!airports.has(input[key]!))
        return new HttpError(400, `${key} airport does not exist`, 'UNKNOWN_AIRPORT')
    }
    if (input.aircraft_icao && !aircraft.has(input.aircraft_icao))
      return new HttpError(400, 'aircraft_icao does not exist', 'UNKNOWN_AIRCRAFT')
    return input
  })
}
