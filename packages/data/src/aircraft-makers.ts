import aircraft from './aircraft.json' with { type: 'json' }
import { findAircraft } from './aircraft-lookup'

export const MAKER_NAMES = {
  airbus: 'Airbus',
  boeing: 'Boeing',
  embraer: 'Embraer',
  atr: 'ATR',
  aerospatiale: 'Aerospatiale',
  antonov: 'Antonov',
  'bae-systems': 'BAE Systems',
  beechcraft: 'Beechcraft',
  bombardier: 'Bombardier',
  cessna: 'Cessna',
  concorde: 'Concorde',
  dassault: 'Dassault',
  'de-havilland': 'De Havilland',
  douglas: 'Douglas',
  'fairchild-dornier': 'Fairchild Dornier',
  fokker: 'Fokker',
  gulfstream: 'Gulfstream',
  harbin: 'Harbin',
  'hawker-siddeley': 'Hawker Siddeley',
  ilyushin: 'Ilyushin',
  learjet: 'Learjet',
  lockheed: 'Lockheed',
  'mcdonnell-douglas': 'McDonnell Douglas',
  namc: 'NAMC',
  partenavia: 'Partenavia',
  pilatus: 'Pilatus',
  piper: 'Piper',
  saab: 'Saab',
  shorts: 'Shorts',
  sukhoi: 'Sukhoi',
  tupolev: 'Tupolev',
  yakovlev: 'Yakovlev',
} as const

export type MakerSlot = keyof typeof MAKER_NAMES | 'other'
export type MakerKey = MakerSlot | 'unknown'
export const MAKER_SLOTS: readonly MakerKey[] = [
  ...(Object.keys(MAKER_NAMES) as Array<keyof typeof MAKER_NAMES>),
  'other',
  'unknown',
]

const byManufacturer = new Map<string, MakerSlot>(
  Object.entries(MAKER_NAMES).map(([key, name]) => [name, key as MakerSlot]),
)

// Current type designation: A220 supersedes the reference's Bombardier label.
export const AIRCRAFT_MAKERS: Readonly<Record<string, MakerSlot>> = Object.fromEntries(
  aircraft.map(({ icao, manufacturer }) => [
    icao,
    icao === 'BCS1' || icao === 'BCS3' ? 'airbus' : (byManufacturer.get(manufacturer) ?? 'other'),
  ]),
)

export function makerOf(icao: string | null | undefined): MakerKey {
  const ref = icao ? findAircraft(icao.trim()) : undefined
  return ref ? AIRCRAFT_MAKERS[ref.icao] : 'unknown'
}
