// Synthetic journeys for the ground-travel tests. Clearly fake ids and places; nothing here is a live record.
import type {
  GroundJourneyDto,
  GroundJourneyList,
  GroundPlaceSnapshot,
  JourneyMetrics,
  ModeTotals,
} from '@kuuki/shared/groundTravel'

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const place = (
  id: string,
  name: string,
  countryCode: string,
  coords: [number, number] | null = null,
): GroundPlaceSnapshot => ({
  source: 'geonames',
  id,
  name,
  nameRu: null,
  nameEn: null,
  countryCode,
  region: null,
  lat: coords ? coords[0] : null,
  lon: coords ? coords[1] : null,
  timezone: null,
  catalogVersion: 'test',
})

export const tbilisi = place('611717', 'Tbilisi', 'GE', [41.69, 44.8])
export const kars = place('745042', 'Kars', 'TR', [40.6, 43.1])
export const baku = place('587084', 'Baku', 'AZ', [40.4, 49.87])
export const nowhere = place('1', 'Nowhere', 'GE')

const knownMetrics = (overrides: Partial<JourneyMetrics> = {}): JourneyMetrics => ({
  distanceKm: 321,
  distanceCoverage: { known: 1, total: 1 },
  trainMinutes: 130,
  trainMinutesCoverage: { known: 1, total: 1 },
  uniqueCities: null,
  ...overrides,
})

type Base = {
  id: number
  status?: GroundJourneyDto['status']
  startDate?: string | null
  endDate?: string | null
  createdAt?: string
  version?: number
  metrics?: Partial<JourneyMetrics>
  note?: string | null
}

export function rail(base: Base, from = tbilisi, to = kars): GroundJourneyDto {
  return {
    id: uuid(base.id),
    mode: 'rail',
    status: base.status ?? 'completed',
    version: base.version ?? 1,
    title: null,
    note: base.note ?? null,
    startDate: base.startDate ?? null,
    endDate: base.endDate ?? base.startDate ?? null,
    createdAt: base.createdAt ?? '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    confirmedAt: null,
    countries: base.status === 'completed' || base.status === undefined ? ['GE', 'TR'] : [],
    metrics: knownMetrics(base.metrics),
    legs: [
      {
        id: uuid(base.id + 5000),
        from,
        to,
        fromStation: null,
        toStation: null,
        trainNumber: null,
        operator: null,
        departureDate: base.startDate ?? null,
        departureTime: null,
        arrivalDate: null,
        arrivalTime: null,
        durationMinutes: 130,
        durationSource: 'manual',
        distanceKm: 321,
      },
    ],
  }
}

export function road(base: Base, stops = [tbilisi, kars, tbilisi]): GroundJourneyDto {
  return {
    id: uuid(base.id),
    mode: 'road',
    status: base.status ?? 'completed',
    version: base.version ?? 1,
    title: null,
    note: base.note ?? null,
    startDate: base.startDate ?? null,
    endDate: base.endDate ?? base.startDate ?? null,
    createdAt: base.createdAt ?? '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    confirmedAt: null,
    countries: [],
    metrics: knownMetrics({
      trainMinutes: null,
      trainMinutesCoverage: null,
      uniqueCities: new Set(stops.map((stop) => stop.id)).size,
      ...base.metrics,
    }),
    points: stops.map((stop, index) => ({
      id: uuid(base.id + 6000 + index),
      place: stop,
      arrivalDate: null,
      departureDate: null,
      nights: null,
      note: null,
    })),
  }
}

const noTotals = (mode: 'rail' | 'road'): ModeTotals => ({
  journeys: 0,
  distanceKm: 0,
  distanceCoverage: { known: 0, total: 0 },
  trainMinutes: null,
  trainMinutesCoverage: mode === 'rail' ? { known: 0, total: 0 } : null,
  uniqueCities: mode === 'road' ? 0 : null,
})

const totalsOf = (journeys: GroundJourneyDto[], mode: 'rail' | 'road'): ModeTotals => {
  const done = journeys.filter((j) => j.mode === mode && j.status === 'completed')
  const known = done.filter((j) => j.metrics.distanceKm !== null)
  return {
    ...noTotals(mode),
    journeys: done.length,
    distanceKm: known.reduce((sum, j) => sum + (j.metrics.distanceKm ?? 0), 0),
    distanceCoverage: { known: known.length, total: done.length },
  }
}

export const listOf = (
  journeys: GroundJourneyDto[],
  overrides: Partial<GroundJourneyList> = {},
): GroundJourneyList => ({
  journeys,
  totals: { rail: totalsOf(journeys, 'rail'), road: totalsOf(journeys, 'road') },
  derivedState: 'ready',
  revision: 1,
  publishedRevision: 1,
  ...overrides,
})
