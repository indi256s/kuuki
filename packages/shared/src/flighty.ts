import { parse } from 'csv-parse/browser/esm/sync'
import { isCalendarDate } from './flightValidation'
import {
  minutesBetween,
  parseLocalTimestamp,
  resolveLocalTimestamp,
  type LocalResolution,
} from './flighty-time'

export const FLIGHTY_PROFILE = 'flighty-observed-33/v1'
export const FLIGHTY_MAPPER_VERSION = 1
export const FLIGHTY_MAX_FILE_BYTES = 10 * 1024 * 1024
export const FLIGHTY_MAX_RECORDS = 10_000
export const FLIGHTY_MAX_RECORD_BYTES = 64 * 1024
export const FLIGHTY_MAX_HEADERS = 64
export const FLIGHTY_MAX_HEADER_LENGTH = 80
export const FLIGHTY_MAX_TOKEN_LENGTH = 64
export const FLIGHTY_CHUNK_RECORDS = 100
export const FLIGHTY_MAX_CHUNKS = 200

export const FLIGHTY_REQUIRED_HEADERS = ['Date', 'Airline', 'Flight', 'From', 'To'] as const

export const FLIGHTY_OBSERVED_HEADERS = [
  'Date',
  'Airline',
  'Flight',
  'From',
  'To',
  'Dep Terminal',
  'Dep Gate',
  'Arr Terminal',
  'Arr Gate',
  'Canceled',
  'Diverted To',
  'Gate Departure (Scheduled)',
  'Gate Departure (Actual)',
  'Take off (Scheduled)',
  'Take off (Actual)',
  'Landing (Scheduled)',
  'Landing (Actual)',
  'Gate Arrival (Scheduled)',
  'Gate Arrival (Actual)',
  'Aircraft Type Name',
  'Tail Number',
  'PNR',
  'Seat',
  'Seat Type',
  'Cabin Class',
  'Flight Reason',
  'Notes',
  'Flight Flighty ID',
  'Airline Flighty ID',
  'Departure Airport Flighty ID',
  'Arrival Airport Flighty ID',
  'Diverted To Airport Flighty ID',
  'Aircraft Type Flighty ID',
] as const

export type FlightyObservedHeader = (typeof FLIGHTY_OBSERVED_HEADERS)[number]

export type FlightyColumnRole = 'canonical' | 'clock' | 'preserved' | 'private' | 'reference'
export const FLIGHTY_COLUMN_ROLES: Record<FlightyObservedHeader, FlightyColumnRole> = {
  Date: 'canonical',
  Airline: 'canonical',
  Flight: 'canonical',
  From: 'canonical',
  To: 'canonical',
  'Dep Terminal': 'preserved',
  'Dep Gate': 'preserved',
  'Arr Terminal': 'preserved',
  'Arr Gate': 'preserved',
  Canceled: 'canonical',
  'Diverted To': 'canonical',
  'Gate Departure (Scheduled)': 'clock',
  'Gate Departure (Actual)': 'clock',
  'Take off (Scheduled)': 'clock',
  'Take off (Actual)': 'clock',
  'Landing (Scheduled)': 'clock',
  'Landing (Actual)': 'clock',
  'Gate Arrival (Scheduled)': 'clock',
  'Gate Arrival (Actual)': 'clock',
  'Aircraft Type Name': 'canonical',
  'Tail Number': 'preserved',
  PNR: 'private',
  Seat: 'preserved',
  'Seat Type': 'preserved',
  'Cabin Class': 'preserved',
  'Flight Reason': 'preserved',
  Notes: 'private',
  'Flight Flighty ID': 'reference',
  'Airline Flighty ID': 'reference',
  'Departure Airport Flighty ID': 'reference',
  'Arrival Airport Flighty ID': 'reference',
  'Diverted To Airport Flighty ID': 'reference',
  'Aircraft Type Flighty ID': 'reference',
}

const OBSERVED = new Set<string>(FLIGHTY_OBSERVED_HEADERS)

export interface FlightyRecord {
  ordinal: number
  line: number
  cells: string[]
}

export interface FlightyDocument {
  profile: typeof FLIGHTY_PROFILE
  headers: string[]
  unknownHeaders: string[]
  missingHeaders: string[]
  records: FlightyRecord[]
  blankLines: number
}

export type FlightyParseErrorCode =
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_RECORDS'
  | 'RECORD_TOO_LARGE'
  | 'MALFORMED_CSV'
  | 'ROW_WIDTH_MISMATCH'
  | 'DUPLICATE_HEADER'
  | 'MISSING_HEADER'
  | 'INVALID_HEADER'

export class FlightyParseError extends Error {
  readonly code: FlightyParseErrorCode
  readonly line: number | null
  readonly record: number | null
  readonly header: string | null

  constructor(
    code: FlightyParseErrorCode,
    location: { line?: number; record?: number; header?: string } = {},
  ) {
    const where = [
      location.line ? `line ${location.line}` : null,
      location.record ? `record ${location.record}` : null,
      location.header ? `header "${location.header}"` : null,
    ].filter(Boolean)
    super(where.length ? `${code} at ${where.join(', ')}` : code)
    this.name = 'FlightyParseError'
    this.code = code
    this.line = location.line ?? null
    this.record = location.record ?? null
    this.header = location.header ?? null
  }
}

const encoder = new TextEncoder()
const byteLength = (text: string) => encoder.encode(text).length
const isBlankRow = (cells: string[]) => cells.length === 1 && cells[0].trim() === ''

export function parseFlightyCsv(input: string): FlightyDocument {
  if (byteLength(input) > FLIGHTY_MAX_FILE_BYTES) throw new FlightyParseError('FILE_TOO_LARGE')
  const text = input.startsWith('﻿') ? input.slice(1) : input
  let rows: Array<{ record: string[]; info: { lines: number } }>
  try {
    rows = parse(text, {
      info: true,
      relax_column_count: true,
      skip_empty_lines: false,
      max_record_size: FLIGHTY_MAX_RECORD_BYTES,
    }) as unknown as Array<{ record: string[]; info: { lines: number } }>
  } catch (error) {
    const code = (error as { code?: string }).code
    const line = Number((error as { lines?: number }).lines) || undefined
    throw new FlightyParseError(
      code === 'CSV_MAX_RECORD_SIZE' ? 'RECORD_TOO_LARGE' : 'MALFORMED_CSV',
      { line },
    )
  }

  let blankLines = 0
  let previousEnd = 0
  let headers: string[] | null = null
  const records: FlightyRecord[] = []
  for (const { record: cells, info } of rows) {
    const line = previousEnd + 1
    previousEnd = info.lines
    if (isBlankRow(cells)) {
      blankLines += 1
      continue
    }
    if (!headers) {
      headers = readHeaders(cells, line)
      continue
    }
    if (cells.length !== headers.length)
      throw new FlightyParseError('ROW_WIDTH_MISMATCH', { line, record: records.length + 1 })
    if (records.length === FLIGHTY_MAX_RECORDS) throw new FlightyParseError('TOO_MANY_RECORDS')
    records.push({ ordinal: records.length, line, cells })
  }
  if (!headers) throw new FlightyParseError('EMPTY_FILE')
  for (const record of records)
    if (byteLength(JSON.stringify(record.cells)) > FLIGHTY_MAX_RECORD_BYTES)
      throw new FlightyParseError('RECORD_TOO_LARGE', {
        line: record.line,
        record: record.ordinal + 1,
      })
  return {
    profile: FLIGHTY_PROFILE,
    headers,
    unknownHeaders: headers.filter((header) => !OBSERVED.has(header)),
    missingHeaders: FLIGHTY_OBSERVED_HEADERS.filter((header) => !headers!.includes(header)),
    records,
    blankLines,
  }
}

function readHeaders(cells: string[], line: number): string[] {
  if (cells.length > FLIGHTY_MAX_HEADERS) throw new FlightyParseError('INVALID_HEADER', { line })
  const headers = cells.map((cell) => cell.trim())
  const seen = new Set<string>()
  for (const header of headers) {
    if (!header || header.length > FLIGHTY_MAX_HEADER_LENGTH)
      throw new FlightyParseError('INVALID_HEADER', { line })
    if (seen.has(header)) throw new FlightyParseError('DUPLICATE_HEADER', { line, header })
    seen.add(header)
  }
  for (const header of FLIGHTY_REQUIRED_HEADERS)
    if (!seen.has(header)) throw new FlightyParseError('MISSING_HEADER', { line, header })
  return headers
}

export const FLIGHTY_CHUNK_PAYLOAD_BYTES = 240 * 1024

export function chunkFlightyRecords(
  records: FlightyRecord[],
  size = FLIGHTY_CHUNK_RECORDS,
  maxBytes = FLIGHTY_CHUNK_PAYLOAD_BYTES,
): FlightyRecord[][] {
  const chunks: FlightyRecord[][] = []
  let current: FlightyRecord[] = []
  let bytes = 2
  for (const record of records) {
    const recordBytes = byteLength(JSON.stringify([record.ordinal, record.line, record.cells])) + 1
    if (current.length && (current.length === size || bytes + recordBytes > maxBytes)) {
      chunks.push(current)
      current = []
      bytes = 2
    }
    current.push(record)
    bytes += recordBytes
  }
  if (current.length) chunks.push(current)
  return chunks
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const flightyChunkPayload = (records: FlightyRecord[]) =>
  JSON.stringify(records.map((record) => [record.ordinal, record.line, record.cells]))

export const flightyChunkDigest = (records: FlightyRecord[]) =>
  sha256Hex(flightyChunkPayload(records))

export const flightyRecordDigest = (headers: string[], cells: string[]) =>
  sha256Hex(JSON.stringify([headers, cells]))

export const flightyManifestDigest = (
  headers: string[],
  chunks: Array<{ count: number; digest: string }>,
) => sha256Hex(JSON.stringify({ profile: FLIGHTY_PROFILE, headers, chunks }))

export interface FlightyRefs {
  airlinesByIcao(icao: string): string[]
  airlineExists(iata: string): boolean
  airport(iata: string): { timezone: string | null } | null
  aircraftByName(name: string): string[]
}

export type FlightyEventKind = 'gate_departure' | 'takeoff' | 'landing' | 'gate_arrival'
export type FlightyEventPhase = 'scheduled' | 'actual'

const EVENTS: Array<{
  header: FlightyObservedHeader
  kind: FlightyEventKind
  phase: FlightyEventPhase
  at: 'origin' | 'booked' | 'effective'
}> = [
  {
    header: 'Gate Departure (Scheduled)',
    kind: 'gate_departure',
    phase: 'scheduled',
    at: 'origin',
  },
  { header: 'Gate Departure (Actual)', kind: 'gate_departure', phase: 'actual', at: 'origin' },
  { header: 'Take off (Scheduled)', kind: 'takeoff', phase: 'scheduled', at: 'origin' },
  { header: 'Take off (Actual)', kind: 'takeoff', phase: 'actual', at: 'origin' },
  { header: 'Landing (Scheduled)', kind: 'landing', phase: 'scheduled', at: 'booked' },
  { header: 'Landing (Actual)', kind: 'landing', phase: 'actual', at: 'effective' },
  { header: 'Gate Arrival (Scheduled)', kind: 'gate_arrival', phase: 'scheduled', at: 'booked' },
  { header: 'Gate Arrival (Actual)', kind: 'gate_arrival', phase: 'actual', at: 'effective' },
]

export interface FlightyTimeEvent {
  header: string
  kind: FlightyEventKind
  phase: FlightyEventPhase
  value: string
  airport: string | null
  resolution: LocalResolution['kind'] | 'invalid'
  utc: string | null
}

export type FlightyIssueCode =
  | 'EMPTY_RECORD'
  | 'INVALID_DATE'
  | 'MISSING_AIRPORT'
  | 'UNKNOWN_AIRPORT'
  | 'UNKNOWN_AIRLINE'
  | 'AMBIGUOUS_AIRLINE'
  | 'UNVERIFIED_AIRLINE'
  | 'UNKNOWN_CANCELED'
  | 'INVALID_FLIGHT_NUMBER'
  | 'INVALID_TIME'
  | 'AMBIGUOUS_TIME'
  | 'UNRESOLVED_TIME'
  | 'INCONSISTENT_TIMES'
  | 'DURATION_OUT_OF_RANGE'

export type FlightyIssueField =
  | 'record'
  | 'date'
  | 'origin'
  | 'destination'
  | 'diversion'
  | 'airline'
  | 'canceled'
  | 'flight'
  | 'times'

export interface FlightyIssue {
  code: FlightyIssueCode
  field: FlightyIssueField
  group: string | null
  token?: string
  candidates?: string[]
  header?: string
  offsets?: number[]
}

export interface FlightyAnswers {
  groups?: Record<string, string | boolean | null>
  date?: string
  origin?: string
  destination?: string
  diversion?: string | null
  airline?: string | null
  flightNumber?: string | null
  canceled?: boolean
  times?: 'drop' | { offsets: Record<string, number> }
}

export interface FlightyProjection {
  date: string | null
  origin: string | null
  destination: string | null
  bookedDestination: string | null
  diverted: boolean
  canceled: boolean | null
  airline: string | null
  flightNumber: string | null
  aircraftIcao: string | null
  departureTime: string | null
  departureDate: string | null
  arrivalTime: string | null
  arrivalDate: string | null
  departureUtc: string | null
  arrivalUtc: string | null
  durationMinutes: number | null
  timesFrom: 'actual_gate' | 'scheduled_gate' | null
}

export type FlightyAction = 'create' | 'preserve_only' | 'review'

export interface FlightyCandidate {
  ordinal: number
  projection: FlightyProjection
  events: FlightyTimeEvent[]
  issues: FlightyIssue[]
  action: FlightyAction
  identity: { flightyFlightId: string | null; matchKey: string | null }
}

export const FLIGHTY_MAX_DURATION_MINUTES = 1200

const upper = (value: string) => value.trim().toUpperCase()
const groupKey = (prefix: string, token: string) =>
  token.length <= 32 ? `${prefix}:${token}` : null

const boundToken = (issue: FlightyIssue): FlightyIssue => {
  if (issue.token === undefined || issue.token.length <= FLIGHTY_MAX_TOKEN_LENGTH) return issue
  const points = Array.from(issue.token)
  return points.length <= FLIGHTY_MAX_TOKEN_LENGTH
    ? issue
    : { ...issue, token: `${points.slice(0, FLIGHTY_MAX_TOKEN_LENGTH - 1).join('')}…` }
}

export function headerIndex(headers: string[]): (record: FlightyRecord, name: string) => string {
  const positions = new Map(headers.map((header, index) => [header, index]))
  return (record, name) => {
    const index = positions.get(name)
    return index === undefined ? '' : (record.cells[index] ?? '')
  }
}

export function mapFlightyRecord(
  record: FlightyRecord,
  headers: string[],
  refs: FlightyRefs,
  answers: FlightyAnswers = {},
): FlightyCandidate {
  const cell = headerIndex(headers)
  const value = (name: string) => cell(record, name)
  const issues: FlightyIssue[] = []
  const groups = answers.groups ?? {}
  const projection: FlightyProjection = {
    date: null,
    origin: null,
    destination: null,
    bookedDestination: null,
    diverted: false,
    canceled: null,
    airline: null,
    flightNumber: null,
    aircraftIcao: null,
    departureTime: null,
    departureDate: null,
    arrivalTime: null,
    arrivalDate: null,
    departureUtc: null,
    arrivalUtc: null,
    durationMinutes: null,
    timesFrom: null,
  }
  const flightyFlightId = value('Flight Flighty ID').trim() || null

  if (record.cells.every((cellValue) => cellValue.trim() === '')) {
    return {
      ordinal: record.ordinal,
      projection,
      events: [],
      issues: [{ code: 'EMPTY_RECORD', field: 'record', group: null }],
      action: 'review',
      identity: { flightyFlightId, matchKey: null },
    }
  }

  const canceledToken = value('Canceled').trim()
  const canceledGroup = groupKey('canceled', canceledToken.toLowerCase())
  let canceled: boolean | null = /^true$/i.test(canceledToken)
    ? true
    : /^false$/i.test(canceledToken)
      ? false
      : null
  if (canceled === null && canceledGroup && typeof groups[canceledGroup] === 'boolean')
    canceled = groups[canceledGroup] as boolean
  if (answers.canceled !== undefined) canceled = answers.canceled
  projection.canceled = canceled
  const flown = canceled === false
  const need = (issue: FlightyIssue) => {
    if (canceled !== true) issues.push(issue)
  }
  if (canceled === null)
    issues.push({
      code: 'UNKNOWN_CANCELED',
      field: 'canceled',
      group: canceledGroup,
      token: canceledToken,
    })

  const dateToken = value('Date').trim()
  const date = answers.date ?? dateToken
  if (isCalendarDate(date)) projection.date = date
  else need({ code: 'INVALID_DATE', field: 'date', group: null })

  const airportAnswer = (token: string): string | null => {
    const key = groupKey('airport', token)
    const answer = key ? groups[key] : undefined
    return typeof answer === 'string' ? answer : null
  }
  const resolveAirport = (
    token: string,
    override: string | undefined,
    field: 'origin' | 'destination' | 'diversion',
  ): string | null => {
    const code = override ?? (refs.airport(token) && /^[A-Z]{3}$/.test(token) ? token : null)
    const answered = code ?? (token ? airportAnswer(token) : null)
    if (answered && /^[A-Z]{3}$/.test(answered) && refs.airport(answered)) return answered
    if (!token && override === undefined) need({ code: 'MISSING_AIRPORT', field, group: null })
    else
      need({
        code: 'UNKNOWN_AIRPORT',
        field,
        group: override === undefined ? groupKey('airport', token) : null,
        token: override ?? token,
      })
    return null
  }
  const fromToken = upper(value('From'))
  const toToken = upper(value('To'))
  projection.origin = resolveAirport(fromToken, answers.origin, 'origin')
  projection.bookedDestination = resolveAirport(toToken, answers.destination, 'destination')
  const divertedToken = upper(value('Diverted To'))
  let effective = projection.bookedDestination
  if (answers.diversion !== undefined) {
    if (answers.diversion !== null)
      effective = resolveAirport(divertedToken, answers.diversion, 'diversion')
  } else if (divertedToken && divertedToken !== toToken) {
    effective = resolveAirport(divertedToken, undefined, 'diversion')
  }
  projection.destination = effective
  projection.diverted =
    effective !== null &&
    projection.bookedDestination !== null &&
    effective !== projection.bookedDestination

  const airlineToken = upper(value('Airline'))
  if (answers.airline !== undefined) {
    if (answers.airline === null || refs.airlineExists(answers.airline))
      projection.airline = answers.airline
    else need({ code: 'UNKNOWN_AIRLINE', field: 'airline', group: null, token: answers.airline })
  } else if (airlineToken) {
    const group = groupKey('airline', airlineToken)
    const answered = group ? groups[group] : undefined
    if (answered === null) projection.airline = null
    else if (typeof answered === 'string' && refs.airlineExists(answered))
      projection.airline = answered
    else if (/^[A-Z]{3}$/.test(airlineToken)) {
      const matches = [...new Set(refs.airlinesByIcao(airlineToken))].sort()
      if (matches.length === 1) projection.airline = matches[0]
      else
        need({
          code: matches.length ? 'AMBIGUOUS_AIRLINE' : 'UNKNOWN_AIRLINE',
          field: 'airline',
          group,
          token: airlineToken,
          ...(matches.length ? { candidates: matches } : {}),
        })
    } else
      need({
        code: /^[A-Z0-9]{2}$/.test(airlineToken) ? 'UNVERIFIED_AIRLINE' : 'UNKNOWN_AIRLINE',
        field: 'airline',
        group,
        token: airlineToken,
        ...(/^[A-Z0-9]{2}$/.test(airlineToken) && refs.airlineExists(airlineToken)
          ? { candidates: [airlineToken] }
          : {}),
      })
  }

  const numberToken = value('Flight').trim()
  let flightNumber: string | null = answers.flightNumber !== undefined ? answers.flightNumber : null
  if (answers.flightNumber === undefined && numberToken) {
    flightNumber = numberToken
    for (const prefix of [projection.airline, airlineToken].filter(Boolean) as string[]) {
      const rest = numberToken.toUpperCase().startsWith(prefix)
        ? numberToken.slice(prefix.length).trim()
        : ''
      if (/^\d{1,5}[A-Z]?$/i.test(rest)) {
        flightNumber = rest
        break
      }
    }
  }
  if (flightNumber !== null && (flightNumber.length > 20 || !flightNumber.trim()))
    need({ code: 'INVALID_FLIGHT_NUMBER', field: 'flight', group: null })
  else projection.flightNumber = flightNumber

  const aircraftName = value('Aircraft Type Name').trim()
  if (aircraftName) {
    const types = [...new Set(refs.aircraftByName(aircraftName))]
    if (types.length === 1) projection.aircraftIcao = types[0]
  }

  const airportFor = (at: 'origin' | 'booked' | 'effective') =>
    at === 'origin'
      ? projection.origin
      : at === 'booked'
        ? projection.bookedDestination
        : projection.destination
  const offsets = typeof answers.times === 'object' ? answers.times.offsets : {}
  const events: FlightyTimeEvent[] = []
  const resolved = new Map<string, LocalResolution | 'invalid'>()
  for (const spec of EVENTS) {
    const raw = value(spec.header)
    if (!raw.trim()) continue
    const airport = airportFor(spec.at)
    const local = parseLocalTimestamp(raw)
    const resolution = local
      ? resolveLocalTimestamp(local, airport ? (refs.airport(airport)?.timezone ?? null) : null)
      : 'invalid'
    resolved.set(spec.header, resolution)
    let utc: string | null = null
    if (resolution !== 'invalid') {
      if (resolution.kind === 'unique') utc = resolution.utc
      else if (resolution.kind === 'ambiguous') {
        const chosen = resolution.options.find((option) => option.offset === offsets[spec.header])
        utc = chosen?.utc ?? null
      }
    }
    events.push({
      header: spec.header,
      kind: spec.kind,
      phase: spec.phase,
      value: raw,
      airport,
      resolution: resolution === 'invalid' ? 'invalid' : resolution.kind,
      utc,
    })
  }

  const has = (header: string) => resolved.has(header)
  const pair: [string, string, 'actual_gate' | 'scheduled_gate'] | null =
    has('Gate Departure (Actual)') && has('Gate Arrival (Actual)')
      ? ['Gate Departure (Actual)', 'Gate Arrival (Actual)', 'actual_gate']
      : has('Gate Departure (Scheduled)') && has('Gate Arrival (Scheduled)') && !projection.diverted
        ? ['Gate Departure (Scheduled)', 'Gate Arrival (Scheduled)', 'scheduled_gate']
        : null
  const airportsKnown = projection.origin !== null && projection.destination !== null
  if (pair && answers.times !== 'drop' && airportsKnown && canceled !== true) {
    const [departureHeader, arrivalHeader, timesFrom] = pair
    const departure = events.find((event) => event.header === departureHeader)!
    const arrival = events.find((event) => event.header === arrivalHeader)!
    const blocking = [departure, arrival].flatMap((event): FlightyIssue[] => {
      const resolution = resolved.get(event.header)!
      if (resolution === 'invalid')
        return [{ code: 'INVALID_TIME', field: 'times', group: null, header: event.header }]
      if (resolution.kind === 'ambiguous' && event.utc === null)
        return [
          {
            code: 'AMBIGUOUS_TIME',
            field: 'times',
            group: null,
            header: event.header,
            offsets: resolution.options.map((option) => option.offset),
          },
        ]
      if (resolution.kind === 'unresolved')
        return [{ code: 'UNRESOLVED_TIME', field: 'times', group: null, header: event.header }]
      if (resolution.kind === 'nonexistent' || resolution.kind === 'offset_mismatch')
        return [{ code: 'INCONSISTENT_TIMES', field: 'times', group: null, header: event.header }]
      return []
    })
    if (blocking.length) blocking.forEach(need)
    else {
      const minutes = minutesBetween(departure.utc!, arrival.utc!)
      if (minutes <= 0) need({ code: 'INCONSISTENT_TIMES', field: 'times', group: null })
      else if (minutes > FLIGHTY_MAX_DURATION_MINUTES)
        need({ code: 'DURATION_OUT_OF_RANGE', field: 'times', group: null })
      else {
        const departureLocal = parseLocalTimestamp(departure.value)!
        const arrivalLocal = parseLocalTimestamp(arrival.value)!
        Object.assign(projection, {
          departureTime: departureLocal.time,
          departureDate: departureLocal.date,
          arrivalTime: arrivalLocal.time,
          arrivalDate: arrivalLocal.date,
          departureUtc: departure.utc,
          arrivalUtc: arrival.utc,
          durationMinutes: minutes,
          timesFrom,
        })
      }
    }
  }

  const action: FlightyAction =
    canceled === true ? 'preserve_only' : issues.length || !flown ? 'review' : 'create'
  return {
    ordinal: record.ordinal,
    projection,
    events,
    issues: issues.map(boundToken),
    action,
    identity: {
      flightyFlightId,
      matchKey:
        dateToken || fromToken || toToken
          ? [dateToken, fromToken, toToken, airlineToken, numberToken.toUpperCase()].join('|')
          : null,
    },
  }
}

export function groupFlightyIssues(candidates: FlightyCandidate[]): Array<{
  group: string
  code: FlightyIssueCode
  token: string
  candidates: string[]
  rows: number
}> {
  const groups = new Map<
    string,
    { group: string; code: FlightyIssueCode; token: string; candidates: string[]; rows: number }
  >()
  for (const candidate of candidates) {
    const seen = new Set<string>()
    for (const issue of candidate.issues) {
      if (!issue.group || seen.has(issue.group)) continue
      seen.add(issue.group)
      const entry = groups.get(issue.group)
      if (entry) entry.rows += 1
      else
        groups.set(issue.group, {
          group: issue.group,
          code: issue.code,
          token: issue.token ?? '',
          candidates: issue.candidates ?? [],
          rows: 1,
        })
    }
  }
  return [...groups.values()].sort((a, b) => b.rows - a.rows || a.group.localeCompare(b.group))
}
