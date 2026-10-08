import aircraft from './aircraft.json' with { type: 'json' }
import { findAircraft } from './aircraft-lookup'

export type MakerSlot = 'airbus' | 'boeing' | 'embraer' | 'atr' | 'other'
export type MakerKey = MakerSlot | 'unknown'
export const MAKER_SLOTS: readonly MakerKey[] = ['airbus', 'boeing', 'embraer', 'atr', 'other', 'unknown']

const eJets = new Set(['E170', 'E190', 'E195', 'E290', 'E295', 'E75L', 'E75S'])

// Current type designation: A220 supersedes the reference's Bombardier label.
// Only E-Jets count as Embraer here; its regional turboprops and business jets are Other.
export const AIRCRAFT_MAKERS: Readonly<Record<string, MakerSlot>> = Object.fromEntries(
  aircraft.map(({ icao, manufacturer }) => [icao,
    icao === 'BCS1' || icao === 'BCS3' || manufacturer === 'Airbus' ? 'airbus'
      : manufacturer === 'Boeing' ? 'boeing'
        : eJets.has(icao) ? 'embraer'
          : manufacturer === 'ATR' ? 'atr' : 'other',
  ]),
)

export function makerOf(icao: string | null | undefined): MakerKey {
  const ref = icao ? findAircraft(icao) : undefined
  return ref ? AIRCRAFT_MAKERS[ref.icao] : 'unknown'
}
