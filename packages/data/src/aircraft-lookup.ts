import type { Aircraft } from '@kuuki/shared/types'
import aircraftData from './aircraft.json' with { type: 'json' }

const aircraft = aircraftData as Aircraft[]
let byIcao: Map<string, Aircraft> | undefined

export function findAircraft(icao: string): Aircraft | undefined {
  byIcao ??= new Map(aircraft.map((item) => [item.icao.toUpperCase(), item]))
  return byIcao.get(icao.toUpperCase())
}

export function familyOf(icao: string, ref?: { model: string | null }): string | null {
  return findAircraft(icao)?.family ?? ref?.model ?? null
}
