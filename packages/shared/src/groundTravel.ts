import { coordinates, greatCircleKm, type LatLon } from './geo'

export type GroundMode = 'rail' | 'road'
export type GroundStatus = 'planned' | 'completed' | 'cancelled'

export const GROUND_LIMITS = {
  children: 100,
  title: 200,
  note: 10_000,
  placeName: 200,
  station: 200,
  trainNumber: 40,
  operator: 200,
  receiptDays: 37,
  searchResults: 10,
  searchMinChars: 3,
} as const

export interface GroundPlaceSnapshot {
  source: 'geonames' | 'manual'
  id: string
  name: string
  nameRu: string | null
  nameEn: string | null
  countryCode: string
  region: string | null
  lat: number | null
  lon: number | null
  timezone: string | null
  catalogVersion: string | null
}

export type GroundPlaceOption = GroundPlaceSnapshot & { regionRu?: string | null }

export interface ManualPlaceInput {
  id: string
  name: string
  countryCode: string
  lat: number | null
  lon: number | null
  timezone: string | null
}

export const placeKey = (place: Pick<GroundPlaceSnapshot, 'source' | 'id'>) =>
  `${place.source}:${place.id}`

export function railRouteRuns<T extends Pick<GroundPlaceSnapshot, 'source' | 'id'> | null>(
  legs: readonly { from: T; to: T }[],
): T[][] {
  const runs: T[][] = []
  let previous: T | undefined
  for (const leg of legs) {
    if (previous && leg.from && placeKey(previous) === placeKey(leg.from))
      runs[runs.length - 1].push(leg.to)
    else runs.push([leg.from, leg.to])
    previous = leg.to
  }
  return runs
}

export function placeLabel(place: GroundPlaceSnapshot, locale: 'ru' | 'en'): string {
  return (locale === 'ru' ? place.nameRu : place.nameEn) ?? place.name
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export const isLocalTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const isCountryCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z]{2}$/.test(value)

const optionalText = (value: unknown, max: number): string | null | undefined => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if ([...trimmed].length > max) return undefined
  return trimmed.length === 0 ? null : trimmed
}

export function parsePlaceSnapshot(value: unknown): GroundPlaceSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (v.source !== 'geonames' && v.source !== 'manual') return null
  if (typeof v.id !== 'string') return null
  if (v.source === 'geonames' && !/^[1-9]\d{0,11}$/.test(v.id)) return null
  if (v.source === 'manual' && !isUuid(v.id)) return null
  const name = optionalText(v.name, GROUND_LIMITS.placeName)
  if (!name) return null
  if (!isCountryCode(v.countryCode)) return null
  const nameRu = optionalText(v.nameRu, GROUND_LIMITS.placeName)
  const nameEn = optionalText(v.nameEn, GROUND_LIMITS.placeName)
  const region = optionalText(v.region, GROUND_LIMITS.placeName)
  const timezone = optionalText(v.timezone, 64)
  const catalogVersion = optionalText(v.catalogVersion, 64)
  if ([nameRu, nameEn, region, timezone, catalogVersion].includes(undefined)) return null
  const lat = v.lat ?? null
  const lon = v.lon ?? null
  if ((lat === null) !== (lon === null)) return null
  if (lat !== null && !coordinates({ lat: lat as number, lon: lon as number })) return null
  return {
    source: v.source,
    id: v.id,
    name,
    nameRu: nameRu ?? null,
    nameEn: nameEn ?? null,
    countryCode: v.countryCode,
    region: region ?? null,
    lat: lat as number | null,
    lon: lon as number | null,
    timezone: timezone ?? null,
    catalogVersion: v.source === 'manual' ? null : (catalogVersion ?? null),
  }
}

export interface RailLegInput {
  id: string
  from: GroundPlaceSnapshot
  to: GroundPlaceSnapshot
  fromStation: string | null
  toStation: string | null
  trainNumber: string | null
  operator: string | null
  departureDate: string | null
  departureTime: string | null
  arrivalDate: string | null
  arrivalTime: string | null
  durationMinutes: number | null
}

export interface RoadPointInput {
  id: string
  place: GroundPlaceSnapshot
  arrivalDate: string | null
  departureDate: string | null
  nights: number | null
  note: string | null
}

interface JourneyFieldsInput {
  title: string | null
  note: string | null
  startDate: string | null
  endDate: string | null
}

export type RailJourneyInput = JourneyFieldsInput & { mode: 'rail'; legs: RailLegInput[] }
export type RoadJourneyInput = JourneyFieldsInput & { mode: 'road'; points: RoadPointInput[] }
export type GroundJourneyInput = RailJourneyInput | RoadJourneyInput

export type GroundAction =
  | 'create'
  | 'update'
  | 'complete'
  | 'reopen'
  | 'cancel'
  | 'restore'
  | 'delete'

export type GroundCommand =
  | {
      action: 'create'
      operationKey: string
      journeyId: string
      status: 'planned' | 'completed'
      journey: GroundJourneyInput
      countries?: string[]
    }
  | {
      action: 'update'
      operationKey: string
      journeyId: string
      expectedVersion: number
      journey: GroundJourneyInput
      countries?: string[]
    }
  | {
      action: 'complete'
      operationKey: string
      journeyId: string
      expectedVersion: number
      journey: GroundJourneyInput
      countries: string[]
    }
  | {
      action: 'reopen' | 'cancel' | 'restore' | 'delete'
      operationKey: string
      journeyId: string
      expectedVersion: number
    }

export type DerivedPublication = 'ready' | 'pending'

export interface GroundMutationResult {
  outcome: 'saved' | 'deleted'
  journeyId: string
  action: GroundAction
  savedVersion: number
  accountRevision: number
  derivedState: DerivedPublication
  replayed: boolean
  current: GroundJourneyDto | null
}

export type GroundOperationStatus =
  | ({ status: 'saved' | 'deleted' } & Omit<GroundMutationResult, 'outcome' | 'replayed'>)
  | { status: 'unknown'; operationKey: string }

export interface RailLegDto extends RailLegInput {
  durationSource: 'manual' | 'schedule' | null
  distanceKm: number | null
}

export type RoadPointDto = RoadPointInput

export interface Coverage {
  known: number
  total: number
}

export interface JourneyMetrics {
  distanceKm: number | null
  distanceCoverage: Coverage
  trainMinutes: number | null
  trainMinutesCoverage: Coverage | null
  uniqueCities: number | null
}

interface JourneyDtoBase {
  id: string
  status: GroundStatus
  version: number
  title: string | null
  note: string | null
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  countries: string[]
  metrics: JourneyMetrics
}

export type RailJourneyDto = JourneyDtoBase & { mode: 'rail'; legs: RailLegDto[] }
export type RoadJourneyDto = JourneyDtoBase & { mode: 'road'; points: RoadPointDto[] }
export type GroundJourneyDto = RailJourneyDto | RoadJourneyDto

export interface ModeTotals {
  journeys: number
  distanceKm: number
  distanceCoverage: Coverage
  trainMinutes: number | null
  trainMinutesCoverage: Coverage | null
  uniqueCities: number | null
}

export interface GroundJourneyList {
  journeys: GroundJourneyDto[]
  totals: { rail: ModeTotals; road: ModeTotals }
  derivedState: DerivedPublication
  revision: number
  publishedRevision: number
}

const ll = (place: GroundPlaceSnapshot): LatLon | null =>
  coordinates({ lat: place.lat, lon: place.lon })

export function segmentKm(a: GroundPlaceSnapshot, b: GroundPlaceSnapshot): number | null {
  const from = ll(a)
  const to = ll(b)
  return from && to ? greatCircleKm(from, to) : null
}

export function journeyDistance(
  pairs: ReadonlyArray<readonly [GroundPlaceSnapshot | null, GroundPlaceSnapshot | null]>,
) {
  let km = 0
  let known = 0
  for (const [a, b] of pairs) {
    const d = a && b ? segmentKm(a, b) : null
    if (d !== null) {
      km += d
      known += 1
    }
  }
  const total = pairs.length
  return {
    distanceKm: total > 0 && known === total ? Math.round(km) : null,
    distanceCoverage: { known, total },
  }
}

export function scheduleMinutes(leg: {
  departureDate: string | null
  departureTime: string | null
  arrivalDate: string | null
  arrivalTime: string | null
  fromTimezone: string | null
  toTimezone: string | null
}): number | null {
  const { departureDate, departureTime, arrivalDate, arrivalTime, fromTimezone, toTimezone } = leg
  if (!departureDate || !departureTime || !arrivalDate || !arrivalTime) return null
  if (!fromTimezone || !toTimezone) return null
  const start = zonedInstant(departureDate, departureTime, fromTimezone)
  const end = zonedInstant(arrivalDate, arrivalTime, toTimezone)
  if (start === null || end === null) return null
  const minutes = Math.round((end - start) / 60_000)
  return minutes >= 1 && minutes <= 20_160 ? minutes : null
}

function zonedInstant(date: string, time: string, timeZone: string): number | null {
  if (!isIsoDate(date) || !isLocalTime(time)) return null
  try {
    const naive = Date.parse(`${date}T${time}:00Z`)
    const offset = (instant: number) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).formatToParts(instant)
      const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
      const asUtc = Date.UTC(
        get('year'),
        get('month') - 1,
        get('day'),
        get('hour'),
        get('minute'),
        get('second'),
      )
      return asUtc - instant
    }
    const first = naive - offset(naive)
    return naive - offset(first)
  } catch {
    return null
  }
}

export function railLegDuration(leg: RailLegInput): {
  minutes: number | null
  source: 'manual' | 'schedule' | null
} {
  if (leg.durationMinutes !== null) return { minutes: leg.durationMinutes, source: 'manual' }
  const minutes = scheduleMinutes({
    departureDate: leg.departureDate,
    departureTime: leg.departureTime,
    arrivalDate: leg.arrivalDate,
    arrivalTime: leg.arrivalTime,
    fromTimezone: leg.from.timezone,
    toTimezone: leg.to.timezone,
  })
  return minutes === null ? { minutes: null, source: null } : { minutes, source: 'schedule' }
}

export function journeyMetrics(journey: GroundJourneyInput): JourneyMetrics {
  if (journey.mode === 'rail') {
    const distance = journeyDistance(journey.legs.map((leg) => [leg.from, leg.to]))
    let minutes = 0
    let known = 0
    for (const leg of journey.legs) {
      const duration = railLegDuration(leg).minutes
      if (duration !== null) {
        minutes += duration
        known += 1
      }
    }
    return {
      ...distance,
      trainMinutes: known > 0 ? minutes : null,
      trainMinutesCoverage: { known, total: journey.legs.length },
      uniqueCities: null,
    }
  }
  const pairs: Array<[GroundPlaceSnapshot, GroundPlaceSnapshot]> = []
  for (let i = 1; i < journey.points.length; i += 1)
    pairs.push([journey.points[i - 1].place, journey.points[i].place])
  return {
    ...journeyDistance(pairs),
    trainMinutes: null,
    trainMinutesCoverage: null,
    uniqueCities: new Set(journey.points.map((point) => placeKey(point.place))).size,
  }
}

export const journeyYear = (journey: { startDate: string | null }): number | null =>
  journey.startDate ? Number(journey.startDate.slice(0, 4)) : null

export function modeTotals(
  journeys: GroundJourneyDto[],
  mode: GroundMode,
  year?: number,
): ModeTotals {
  const done = journeys.filter(
    (journey) =>
      journey.mode === mode &&
      journey.status === 'completed' &&
      (year === undefined || journeyYear(journey) === year),
  )
  let distanceKm = 0
  let distanceKnown = 0
  let trainMinutes = 0
  let legsKnown = 0
  let legsTotal = 0
  const cities = new Set<string>()
  for (const journey of done) {
    if (journey.metrics.distanceKm !== null) {
      distanceKm += journey.metrics.distanceKm
      distanceKnown += 1
    }
    if (journey.mode === 'rail') {
      trainMinutes += journey.metrics.trainMinutes ?? 0
      legsKnown += journey.metrics.trainMinutesCoverage?.known ?? 0
      legsTotal += journey.metrics.trainMinutesCoverage?.total ?? 0
    } else {
      for (const point of journey.points) cities.add(placeKey(point.place))
    }
  }
  return {
    journeys: done.length,
    distanceKm,
    distanceCoverage: { known: distanceKnown, total: done.length },
    trainMinutes: mode === 'rail' ? (legsKnown > 0 ? trainMinutes : null) : null,
    trainMinutesCoverage: mode === 'rail' ? { known: legsKnown, total: legsTotal } : null,
    uniqueCities: mode === 'road' ? cities.size : null,
  }
}

export type ListGroup = 'upcoming' | 'past-plan' | 'undated-plan' | 'history' | 'cancelled'

export function todayIso(timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export function listGroup(
  journey: Pick<GroundJourneyDto, 'status' | 'startDate'>,
  today: string,
): ListGroup {
  if (journey.status === 'cancelled') return 'cancelled'
  if (journey.status === 'completed') return 'history'
  if (journey.startDate === null) return 'undated-plan'
  return journey.startDate >= today ? 'upcoming' : 'past-plan'
}

const GROUP_ORDER: Record<ListGroup, number> = {
  upcoming: 0,
  'past-plan': 1,
  'undated-plan': 2,
  history: 3,
  cancelled: 4,
}

type Sortable = Pick<GroundJourneyDto, 'id' | 'status' | 'startDate' | 'createdAt'>

const tieBreak = (a: Sortable, b: Sortable) =>
  b.createdAt.localeCompare(a.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function compareJourneys(today: string) {
  return (a: Sortable, b: Sortable): number => {
    const ga = listGroup(a, today)
    const gb = listGroup(b, today)
    if (ga !== gb) return GROUP_ORDER[ga] - GROUP_ORDER[gb]
    if (ga === 'upcoming') return a.startDate!.localeCompare(b.startDate!) || tieBreak(a, b)
    if (a.startDate === b.startDate) return tieBreak(a, b)
    if (a.startDate === null) return 1
    if (b.startDate === null) return -1
    return b.startDate.localeCompare(a.startDate)
  }
}
