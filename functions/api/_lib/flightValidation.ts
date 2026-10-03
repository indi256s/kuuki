import { validateFlightInput, type FlightInput } from '../../../packages/shared/src/flightValidation'
import { HttpError } from './http'

export async function parseFlightBody(db: D1Database, raw: unknown, mode: 'create' | 'patch', existing?: { origin: string; destination: string; aircraft_icao: string | null }): Promise<FlightInput> {
  let input: FlightInput
  try {
    input = validateFlightInput(raw, mode)
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid flight', 'INVALID_FLIGHT')
  }
  for (const key of ['origin', 'destination'] as const) {
    const value = input[key]
    if (!value) continue
    if (mode === 'patch' && value === existing?.[key]) continue
    const exists = await db.prepare('SELECT 1 AS found FROM airports_reference WHERE iata = ?').bind(value).first()
    if (!exists) throw new HttpError(400, `${key} airport does not exist`, 'UNKNOWN_AIRPORT')
  }
  if (input.aircraft_icao && !(mode === 'patch' && input.aircraft_icao === existing?.aircraft_icao)) {
    const exists = await db.prepare('SELECT 1 AS found FROM aircraft_reference WHERE icao = ?').bind(input.aircraft_icao).first()
    if (!exists) throw new HttpError(400, 'aircraft_icao does not exist', 'UNKNOWN_AIRCRAFT')
  }
  return input
}
