// Form state for ground journeys, kept as plain strings (what the inputs hold) and converted to the shared
// GroundJourneyInput only when it is valid. Pure: no DOM, no network.

import {
  GROUND_LIMITS,
  isIsoDate,
  isLocalTime,
  placeKey,
  type GroundCommand,
  type GroundJourneyDto,
  type GroundJourneyInput,
  type GroundMode,
  type GroundPlaceSnapshot,
  type GroundStatus,
  type RailLegInput,
  type RoadPointInput,
} from '@kuuki/shared/groundTravel'

export const newId = (): string => crypto.randomUUID()

export interface LegDraft {
  id: string
  from: GroundPlaceSnapshot | null
  to: GroundPlaceSnapshot | null
  fromStation: string
  toStation: string
  trainNumber: string
  operator: string
  departureDate: string
  departureTime: string
  arrivalDate: string
  arrivalTime: string
  /** Minutes the owner typed. Empty means "let the schedule decide"; a schedule-derived value is never copied here. */
  durationManual: string
  /** A city printed on a ticket, kept while the place is unset so the picker can search for it. Never a place. */
  fromCity?: string
  toCity?: string
}

export interface PointDraft {
  id: string
  place: GroundPlaceSnapshot | null
  arrivalDate: string
  departureDate: string
  nights: string
  note: string
}

export interface FormState {
  mode: GroundMode
  /** What the journey becomes on save. Plans carry no countries; completed ones always carry an answer. */
  status: 'planned' | 'completed'
  title: string
  note: string
  startDate: string
  endDate: string
  legs: LegDraft[]
  points: PointDraft[]
  /** Owner-confirmed crossed countries (ISO-2). Nothing is ever pre-filled. */
  countries: string[]
  /** "None of these": the deliberate empty answer. Mutually exclusive with `countries`. */
  noCountries: boolean
}

export const emptyLeg = (from: GroundPlaceSnapshot | null = null): LegDraft => ({
  id: newId(),
  from,
  to: null,
  fromStation: '',
  toStation: '',
  trainNumber: '',
  operator: '',
  departureDate: '',
  departureTime: '',
  arrivalDate: '',
  arrivalTime: '',
  durationManual: '',
})

export const emptyPoint = (place: GroundPlaceSnapshot | null = null): PointDraft => ({
  id: newId(),
  place,
  arrivalDate: '',
  departureDate: '',
  nights: '',
  note: '',
})

export function blankState(mode: GroundMode, status: FormState['status'] = 'planned'): FormState {
  return {
    mode,
    status,
    title: '',
    note: '',
    startDate: '',
    endDate: '',
    legs: mode === 'rail' ? [emptyLeg()] : [],
    points: mode === 'road' ? [emptyPoint(), emptyPoint()] : [],
    countries: [],
    noCountries: false,
  }
}

/**
 * The editable state of a stored journey. A leg's duration is copied only when the owner typed it
 * (`durationSource === 'manual'`): echoing a schedule-derived value would turn it into a manual one on save.
 */
export function stateFromDto(dto: GroundJourneyDto, complete: boolean): FormState {
  const completed = dto.status === 'completed'
  const base = {
    mode: dto.mode,
    status: completed || complete ? ('completed' as const) : ('planned' as const),
    title: dto.title ?? '',
    note: dto.note ?? '',
    startDate: dto.startDate ?? '',
    endDate: dto.endDate ?? '',
    // A stored completed list, even an empty one, is a deliberate answer; completing a plan starts unanswered.
    countries: completed ? [...dto.countries] : [],
    noCountries: completed && dto.countries.length === 0,
  }
  if (dto.mode === 'rail')
    return {
      ...base,
      legs: dto.legs.map((leg) => ({
        id: leg.id,
        from: leg.from,
        to: leg.to,
        fromStation: leg.fromStation ?? '',
        toStation: leg.toStation ?? '',
        trainNumber: leg.trainNumber ?? '',
        operator: leg.operator ?? '',
        departureDate: leg.departureDate ?? '',
        departureTime: leg.departureTime ?? '',
        arrivalDate: leg.arrivalDate ?? '',
        arrivalTime: leg.arrivalTime ?? '',
        durationManual:
          leg.durationSource === 'manual' && leg.durationMinutes !== null
            ? String(leg.durationMinutes)
            : '',
      })),
      points: [],
    }
  return {
    ...base,
    legs: [],
    points: dto.points.map((point) => ({
      id: point.id,
      place: point.place,
      arrivalDate: point.arrivalDate ?? '',
      departureDate: point.departureDate ?? '',
      nights: point.nights === null ? '' : String(point.nights),
      note: point.note ?? '',
    })),
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ErrorCode =
  | 'required'
  | 'date'
  | 'time'
  | 'date-order'
  | 'too-long'
  | 'duration'
  | 'nights'
  | 'too-many'
  | 'too-few'
  | 'countries'

/** Keys: `title` `note` `startDate` `endDate` `route` `countries`, and `leg:<id>:<field>` / `point:<id>:<field>`. */
export type FormErrors = Record<string, ErrorCode>

const blank = (value: string) => value.trim() === ''
const orNull = (value: string): string | null => (blank(value) ? null : value.trim())

function checkDate(errors: FormErrors, key: string, value: string) {
  if (!blank(value) && !isIsoDate(value)) errors[key] = 'date'
}
function checkTime(errors: FormErrors, key: string, value: string) {
  if (!blank(value) && !isLocalTime(value)) errors[key] = 'time'
}
function checkLength(errors: FormErrors, key: string, value: string, max: number) {
  if (value.trim().length > max) errors[key] = 'too-long'
}
function checkOrder(errors: FormErrors, key: string, from: string, to: string) {
  if (isIsoDate(from) && isIsoDate(to) && from > to) errors[key] = 'date-order'
}

export function parseWholeNumber(value: string, min: number, max: number): number | null {
  const text = value.trim()
  if (!/^\d{1,6}$/.test(text)) return null
  const n = Number(text)
  return n >= min && n <= max ? n : null
}

export function validateState(state: FormState): FormErrors {
  const errors: FormErrors = {}
  checkLength(errors, 'title', state.title, GROUND_LIMITS.title)
  checkLength(errors, 'note', state.note, GROUND_LIMITS.note)
  checkDate(errors, 'startDate', state.startDate)
  checkDate(errors, 'endDate', state.endDate)
  checkOrder(errors, 'endDate', state.startDate, state.endDate)
  if (state.mode === 'rail') {
    if (state.legs.length < 1) errors.route = 'too-few'
    if (state.legs.length > GROUND_LIMITS.children) errors.route = 'too-many'
    for (const leg of state.legs) {
      const key = (field: string) => `leg:${leg.id}:${field}`
      if (!leg.from) errors[key('from')] = 'required'
      if (!leg.to) errors[key('to')] = 'required'
      checkDate(errors, key('departureDate'), leg.departureDate)
      checkDate(errors, key('arrivalDate'), leg.arrivalDate)
      checkTime(errors, key('departureTime'), leg.departureTime)
      checkTime(errors, key('arrivalTime'), leg.arrivalTime)
      checkOrder(errors, key('arrivalDate'), leg.departureDate, leg.arrivalDate)
      checkLength(errors, key('fromStation'), leg.fromStation, GROUND_LIMITS.station)
      checkLength(errors, key('toStation'), leg.toStation, GROUND_LIMITS.station)
      checkLength(errors, key('trainNumber'), leg.trainNumber, GROUND_LIMITS.trainNumber)
      checkLength(errors, key('operator'), leg.operator, GROUND_LIMITS.operator)
      if (!blank(leg.durationManual) && parseWholeNumber(leg.durationManual, 1, 20_160) === null)
        errors[key('durationManual')] = 'duration'
    }
  } else {
    if (state.points.length < 2) errors.route = 'too-few'
    if (state.points.length > GROUND_LIMITS.children) errors.route = 'too-many'
    for (const point of state.points) {
      const key = (field: string) => `point:${point.id}:${field}`
      if (!point.place) errors[key('place')] = 'required'
      checkDate(errors, key('arrivalDate'), point.arrivalDate)
      checkDate(errors, key('departureDate'), point.departureDate)
      checkOrder(errors, key('departureDate'), point.arrivalDate, point.departureDate)
      if (!blank(point.nights) && parseWholeNumber(point.nights, 0, 3650) === null)
        errors[key('nights')] = 'nights'
      checkLength(errors, key('note'), point.note, GROUND_LIMITS.note)
    }
  }
  if (state.status === 'completed' && !countriesAnswered(state)) errors.countries = 'countries'
  return errors
}

/** An empty checklist alone is silence; the answer is a chosen country or an explicit "None of these". */
export const countriesAnswered = (state: Pick<FormState, 'countries' | 'noCountries'>): boolean =>
  state.noCountries || state.countries.length > 0

/** The country list to send: `[]` only for a deliberate "None of these", never for an unanswered form. */
export function confirmedCountries(
  state: Pick<FormState, 'countries' | 'noCountries'>,
): string[] | null {
  if (state.noCountries) return []
  return state.countries.length > 0 ? [...state.countries] : null
}

/** Country codes of the route's chosen places, first appearance first. A suggestion only, never a confirmation. */
export function routeCountryCodes(state: Pick<FormState, 'mode' | 'legs' | 'points'>): string[] {
  const places =
    state.mode === 'rail'
      ? state.legs.flatMap((leg) => [leg.from, leg.to])
      : state.points.map((point) => point.place)
  const seen = new Set<string>()
  for (const place of places) if (place) seen.add(place.countryCode)
  return [...seen]
}

/** Input for the shared metrics: legs/points whose places are all chosen; incomplete rows are left out. */
export function previewInput(state: FormState): GroundJourneyInput | null {
  const shell = { title: null, note: null, startDate: null, endDate: null }
  if (state.mode === 'rail') {
    const legs = state.legs.flatMap((leg) =>
      leg.from && leg.to ? [toLegInput(leg, leg.from, leg.to)] : [],
    )
    return legs.length > 0 ? { ...shell, mode: 'rail', legs } : null
  }
  const points = state.points.flatMap((point) =>
    point.place ? [toPointInput(point, point.place)] : [],
  )
  return points.length > 0 ? { ...shell, mode: 'road', points } : null
}

/** The shared leg for a draft whose places are chosen; null while either end is missing. */
export const legPreview = (leg: LegDraft): RailLegInput | null =>
  leg.from && leg.to ? toLegInput(leg, leg.from, leg.to) : null

function toLegInput(
  leg: LegDraft,
  from: GroundPlaceSnapshot,
  to: GroundPlaceSnapshot,
): RailLegInput {
  return {
    id: leg.id,
    from,
    to,
    fromStation: orNull(leg.fromStation),
    toStation: orNull(leg.toStation),
    trainNumber: orNull(leg.trainNumber),
    operator: orNull(leg.operator),
    departureDate: orNull(leg.departureDate),
    departureTime: orNull(leg.departureTime),
    arrivalDate: orNull(leg.arrivalDate),
    arrivalTime: orNull(leg.arrivalTime),
    durationMinutes: blank(leg.durationManual)
      ? null
      : parseWholeNumber(leg.durationManual, 1, 20_160),
  }
}

function toPointInput(point: PointDraft, place: GroundPlaceSnapshot): RoadPointInput {
  return {
    id: point.id,
    place,
    arrivalDate: orNull(point.arrivalDate),
    departureDate: orNull(point.departureDate),
    nights: blank(point.nights) ? null : parseWholeNumber(point.nights, 0, 3650),
    note: orNull(point.note),
  }
}

/** The shared input for a state that passed `validateState`; null if anything required is still missing. */
export function toJourneyInput(state: FormState): GroundJourneyInput | null {
  if (Object.keys(validateState(state)).length > 0) return null
  const fields = {
    title: orNull(state.title),
    note: orNull(state.note),
    startDate: orNull(state.startDate),
    endDate: orNull(state.endDate),
  }
  if (state.mode === 'rail') {
    const legs: RailLegInput[] = []
    for (const leg of state.legs) {
      if (!leg.from || !leg.to) return null
      legs.push(toLegInput(leg, leg.from, leg.to))
    }
    return { ...fields, mode: 'rail', legs }
  }
  const points: RoadPointInput[] = []
  for (const point of state.points) {
    if (!point.place) return null
    points.push(toPointInput(point, point.place))
  }
  return { ...fields, mode: 'road', points }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** The journey a form edits; absent while creating. */
export interface Target {
  journeyId: string
  /** Stored status; undefined for a journey that does not exist yet. */
  existing?: GroundStatus
  expectedVersion?: number
}

export type CommandBody = DistributiveOmit<GroundCommand, 'operationKey'>
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never

/**
 * The one command a form save sends. The action follows the stored status: a plan that is being completed uses
 * `complete`, a completed journey `update` with its countries, any other stored journey `update` without them.
 */
export function buildCommandBody(state: FormState, target: Target): CommandBody | null {
  const journey = toJourneyInput(state)
  if (!journey) return null
  const countries = confirmedCountries(state)
  if (target.existing === undefined) {
    if (state.status === 'completed') {
      if (!countries) return null
      return {
        action: 'create',
        journeyId: target.journeyId,
        status: 'completed',
        journey,
        countries,
      }
    }
    return { action: 'create', journeyId: target.journeyId, status: 'planned', journey }
  }
  const expectedVersion = target.expectedVersion
  if (expectedVersion === undefined) return null
  if (target.existing === 'completed') {
    if (!countries) return null
    return { action: 'update', journeyId: target.journeyId, expectedVersion, journey, countries }
  }
  if (state.status === 'completed' && target.existing === 'planned') {
    if (!countries) return null
    return { action: 'complete', journeyId: target.journeyId, expectedVersion, journey, countries }
  }
  return { action: 'update', journeyId: target.journeyId, expectedVersion, journey }
}

/** Plain-text route for summaries, alerts and announcements. Unchosen places read as "?". */
export function routeSummary(
  state: Pick<FormState, 'mode' | 'legs' | 'points'>,
  name: (p: GroundPlaceSnapshot) => string,
): string {
  const label = (place: GroundPlaceSnapshot | null) => (place ? name(place) : '?')
  if (state.mode === 'rail') {
    const names: string[] = []
    let previous: GroundPlaceSnapshot | null = null
    for (const leg of state.legs) {
      // A leg that does not start where the last one ended keeps its own start, so the text never hides a gap.
      if (names.length === 0 || !samePlace(previous, leg.from)) names.push(label(leg.from))
      names.push(label(leg.to))
      previous = leg.to
    }
    return names.join(' → ')
  }
  return state.points.map((point) => label(point.place)).join(' → ')
}

export const samePlace = (a: GroundPlaceSnapshot | null, b: GroundPlaceSnapshot | null): boolean =>
  !!a && !!b && placeKey(a) === placeKey(b)
