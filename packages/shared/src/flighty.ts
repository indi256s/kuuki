// Deterministic reader for Flighty's CSV history export (ADR 0008).
//
// Two layers, both pure and shared by the browser, the API and the offline evaluator:
//  1. `parseFlightyCsv` turns text into header-aligned records without interpreting a single value. Structural damage
//     (bad quoting, uneven rows, duplicate or missing headers, size limits) rejects the whole file with a location and
//     no cell content. Every record keeps every cell, including columns this profile does not know.
//  2. `mapFlightyRecord` projects one record onto Kuuki fields, given reference lookups and the owner's answers. What it
//     cannot establish becomes an issue, grouped when the same source token recurs, never a guess.
//
// The profile name describes headers observed in independent parsers, not a format Flighty has published.
import { parse } from 'csv-parse/browser/esm/sync'
import { isCalendarDate } from './flightValidation'
import {
  minutesBetween,
  parseLocalTimestamp,
  resolveLocalTimestamp,
  type LocalResolution,
} from './flighty-time'

export const FLIGHTY_PROFILE = 'flighty-observed-33/v1'
/** Bumped when parsing or mapping rules change; stored with each import so old runs stay explainable. */
export const FLIGHTY_MAPPER_VERSION = 1
export const FLIGHTY_MAX_FILE_BYTES = 10 * 1024 * 1024
export const FLIGHTY_MAX_RECORDS = 10_000
/** One record's serialized cells; longer notes reject the file instead of being cut. */
export const FLIGHTY_MAX_RECORD_BYTES = 64 * 1024
export const FLIGHTY_MAX_HEADERS = 64
export const FLIGHTY_MAX_HEADER_LENGTH = 80
/** Records per upload chunk. */
export const FLIGHTY_CHUNK_RECORDS = 100
/** Chunks per run: 10 000 records with long notes split by bytes into more than the 100 a record count needs. */
export const FLIGHTY_MAX_CHUNKS = 200

export const FLIGHTY_REQUIRED_HEADERS = ['Date', 'Airline', 'Flight', 'From', 'To'] as const

/** The 33 headers of the observed export family, in their observed order. */
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

/**
 * What happens to each observed column. Every cell of an accepted record is preserved as written; `canonical` and
 * `clock` columns are additionally interpreted into journal fields, `reference` columns are opaque Flighty IDs and
 * `private` columns are owner-only. Unknown columns are preserved and never interpreted.
 */
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

// ---------------------------------------------------------------------------------------------------------------
// 1. Parsing

export interface FlightyRecord {
  /** 0-based position among records (blank lines excluded). */
  ordinal: number
  /** 1-based physical line where the record starts. */
  line: number
  /** One string per header, verbatim (no trimming, no casting). */
  cells: string[]
}

export interface FlightyDocument {
  profile: typeof FLIGHTY_PROFILE
  /** Header names in file order, surrounding whitespace removed. */
  headers: string[]
  /** Headers outside the observed family: kept and reported, never interpreted. */
  unknownHeaders: string[]
  /** Observed headers absent from this file. */
  missingHeaders: string[]
  records: FlightyRecord[]
  /** Physical lines that held no record. */
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

/** A structural refusal. Its location names lines, records and header names, never cell content. */
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

/** Parse a Flighty CSV export. Throws `FlightyParseError` before anything could be written. */
export function parseFlightyCsv(input: string): FlightyDocument {
  if (byteLength(input) > FLIGHTY_MAX_FILE_BYTES) throw new FlightyParseError('FILE_TOO_LARGE')
  // One UTF-8 BOM at the very start only; a BOM elsewhere is content.
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

/** Serialized records per chunk, leaving room under the 256 KiB request cap for the body wrapper. */
export const FLIGHTY_CHUNK_PAYLOAD_BYTES = 240 * 1024

/**
 * Split records into upload chunks of at most `size` records and `maxBytes` serialized. Ordinals stay global so a
 * chunk can be checked on its own. One record never exceeds the cap (FLIGHTY_MAX_RECORD_BYTES is smaller).
 */
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

/** Canonical serialization of a chunk; the server recomputes it over what it received. */
export const flightyChunkPayload = (records: FlightyRecord[]) =>
  JSON.stringify(records.map((record) => [record.ordinal, record.line, record.cells]))

export const flightyChunkDigest = (records: FlightyRecord[]) =>
  sha256Hex(flightyChunkPayload(records))

/** Digest of one record's cells: equal digests mean an identical source record. */
export const flightyRecordDigest = (headers: string[], cells: string[]) =>
  sha256Hex(JSON.stringify([headers, cells]))

/** Digest of the ordered chunk manifest declared when a run opens. */
export const flightyManifestDigest = (
  headers: string[],
  chunks: Array<{ count: number; digest: string }>,
) => sha256Hex(JSON.stringify({ profile: FLIGHTY_PROFILE, headers, chunks }))

// ---------------------------------------------------------------------------------------------------------------
// 2. Mapping

/** Reference lookups supplied by the caller, so this module stays independent of `packages/data` and D1. */
export interface FlightyRefs {
  /** IATA designators of airlines with this ICAO code. */
  airlinesByIcao(icao: string): string[]
  airlineExists(iata: string): boolean
  /** A known airport and its IANA zone (null when unknown to the zone lookup). */
  airport(iata: string): { timezone: string | null } | null
  /** ICAO type designators whose catalog name or model equals this name. */
  aircraftByName(name: string): string[]
}

export type FlightyEventKind = 'gate_departure' | 'takeoff' | 'landing' | 'gate_arrival'
export type FlightyEventPhase = 'scheduled' | 'actual'

const EVENTS: Array<{
  header: FlightyObservedHeader
  kind: FlightyEventKind
  phase: FlightyEventPhase
  /** Which airport's clock the value reads: departure, booked arrival, or where the aircraft really arrived. */
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
  /** The value as written. */
  value: string
  airport: string | null
  /** `invalid` when the value does not parse; otherwise the resolver's verdict for that airport's zone. */
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
  /**
   * Rows sharing a group key share one question and take one answer (`answers.groups[group]`): an unknown airline
   * code, an unknown airport code, an unreadable cancellation token. Null for a question about this record only.
   */
  group: string | null
  /** The source token behind the question: a code or status word, never free text. */
  token?: string
  /** Catalog values the owner can pick from; never pre-selected. */
  candidates?: string[]
  /** For AMBIGUOUS_TIME: the header and its possible UTC offsets in minutes. */
  header?: string
  offsets?: number[]
}

/** The owner's decisions. Group answers apply to every row carrying that group key. */
export interface FlightyAnswers {
  /** `airline:<token>` → IATA or null (no airline); `airport:<token>` → IATA; `canceled:<token>` → boolean. */
  groups?: Record<string, string | boolean | null>
  date?: string
  origin?: string
  destination?: string
  /** Where the aircraft really arrived; null keeps the booked destination. */
  diversion?: string | null
  airline?: string | null
  flightNumber?: string | null
  canceled?: boolean
  /** `drop` keeps the source times but writes no measured clock times; offsets settle DST folds per header. */
  times?: 'drop' | { offsets: Record<string, number> }
}

export interface FlightyProjection {
  /** Service date from `Date`. */
  date: string | null
  origin: string | null
  /** Effective destination: the diversion airport when one is established, else `To`. */
  destination: string | null
  bookedDestination: string | null
  diverted: boolean
  canceled: boolean | null
  airline: string | null
  flightNumber: string | null
  aircraftIcao: string | null
  /** Local HH:MM of the chosen departure/arrival events, with their local dates. */
  departureTime: string | null
  departureDate: string | null
  arrivalTime: string | null
  arrivalDate: string | null
  departureUtc: string | null
  arrivalUtc: string | null
  durationMinutes: number | null
  /** Which consistent pair supplied the clock times; null when none did. */
  timesFrom: 'actual_gate' | 'scheduled_gate' | null
}

export type FlightyAction = 'create' | 'preserve_only' | 'review'

export interface FlightyCandidate {
  ordinal: number
  projection: FlightyProjection
  events: FlightyTimeEvent[]
  issues: FlightyIssue[]
  /** `preserve_only` for a cancellation: kept with the owner's records, never a flight. */
  action: FlightyAction
  /** Source identity hints. Neither is a proven stable ID (ADR 0008). */
  identity: { flightyFlightId: string | null; matchKey: string | null }
}

/** Longest duration the journal stores as measured (ADR 0002 clamp); longer exact values need an owner decision. */
export const FLIGHTY_MAX_DURATION_MINUTES = 1200

const upper = (value: string) => value.trim().toUpperCase()
/** A recurring short token shares one question; a long free-text value stays a question about its own row. */
const groupKey = (prefix: string, token: string) =>
  token.length <= 32 ? `${prefix}:${token}` : null

export function headerIndex(headers: string[]): (record: FlightyRecord, name: string) => string {
  const positions = new Map(headers.map((header, index) => [header, index]))
  return (record, name) => {
    const index = positions.get(name)
    return index === undefined ? '' : (record.cells[index] ?? '')
  }
}

/** Project one record. Pure: the same record, refs and answers always give the same candidate. */
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

  // Cancellation decides whether anything beyond preservation is needed.
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
    // A cancellation is preserved as written: no other question blocks it.
    if (canceled !== true) issues.push(issue)
  }
  if (canceled === null)
    issues.push({
      code: 'UNKNOWN_CANCELED',
      field: 'canceled',
      group: canceledGroup,
      token: canceledToken,
    })

  // Date
  const dateToken = value('Date').trim()
  const date = answers.date ?? dateToken
  if (isCalendarDate(date)) projection.date = date
  else need({ code: 'INVALID_DATE', field: 'date', group: null })

  // Airports
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

  // Airline: the observed export writes ICAO designators; Kuuki stores IATA.
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

  // Flight number: a string; a designator prefix is removed only when it repeats this row's own airline.
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

  // Aircraft: only an unambiguous catalog name becomes a type code; the name itself stays in the source.
  const aircraftName = value('Aircraft Type Name').trim()
  if (aircraftName) {
    const types = [...new Set(refs.aircraftByName(aircraftName))]
    if (types.length === 1) projection.aircraftIcao = types[0]
  }

  // Time events: each keeps its own phase and airport; none substitutes for another.
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

  // Clock times come from one consistent gate pair: actual first, then scheduled. Runway events stay source-only.
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
    issues,
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

/** Questions shared across rows: one entry per group key, with how many rows ask it. */
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
