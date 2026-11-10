import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FLIGHTY_OBSERVED_HEADERS,
  FlightyParseError,
  flightyChunkDigest,
  groupFlightyIssues,
  mapFlightyRecord,
  parseFlightyCsv,
  type FlightyRefs,
} from './flighty'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/flighty/${name}`, import.meta.url), 'utf8')

// Independent of the shipped catalog: only what these cases need.
const AIRPORT_ZONES: Record<string, string | null> = {
  JFK: 'America/New_York',
  LHR: 'Europe/London',
  HND: 'Asia/Tokyo',
  HNL: 'Pacific/Honolulu',
  CDG: 'Europe/Paris',
  NCE: 'Europe/Paris',
  FRA: 'Europe/Berlin',
  BOS: 'America/New_York',
  SVO: 'Europe/Moscow',
  LED: 'Europe/Moscow',
  BKK: 'Asia/Bangkok',
  CNX: 'Asia/Bangkok',
  AMS: 'Europe/Amsterdam',
  OSL: 'Europe/Oslo',
  NOZ: null,
}
const AIRLINES: Record<string, string[]> = {
  BAW: ['BA'],
  JAL: ['JL'],
  AFR: ['AF'],
  DLH: ['LH'],
  THA: ['TG', 'VZ'],
  KLM: ['KL'],
  AAL: ['AA'],
}
const AIRCRAFT: Record<string, string> = {
  'boeing 777-300er': 'B77W',
  'boeing 787-9': 'B789',
  'boeing 747-8': 'B748',
  'airbus a320': 'A320',
  'embraer 190': 'E190',
}
const refs: FlightyRefs = {
  airlinesByIcao: (icao) => AIRLINES[icao] ?? [],
  airlineExists: (iata) => Object.values(AIRLINES).flat().includes(iata),
  airport: (iata) => (iata in AIRPORT_ZONES ? { timezone: AIRPORT_ZONES[iata] } : null),
  aircraftByName: (name) => (AIRCRAFT[name.toLowerCase()] ? [AIRCRAFT[name.toLowerCase()]] : []),
}

const header = 'Date,Airline,Flight,From,To'

describe('parseFlightyCsv: records and cells', () => {
  it('reads the observed 33-column fixture without losing records, cells or notes whitespace', () => {
    const doc = parseFlightyCsv(fixture('observed-33.csv'))
    expect(doc.profile).toBe('flighty-observed-33/v1')
    expect(doc.headers).toEqual([...FLIGHTY_OBSERVED_HEADERS])
    expect(doc.unknownHeaders).toEqual([])
    expect(doc.missingHeaders).toEqual([])
    expect(doc.blankLines).toBe(1)
    expect(doc.records.map((record) => [record.ordinal, record.line])).toEqual([
      [0, 2],
      [1, 3],
      [2, 5],
      [3, 6],
      [4, 7],
      [5, 8],
      [6, 9],
      [7, 10],
      [8, 11],
      [9, 12],
      [10, 14],
    ])
    expect(doc.records.every((record) => record.cells.length === 33)).toBe(true)
    const notes = FLIGHTY_OBSERVED_HEADERS.indexOf('Notes')
    expect(doc.records[0].cells[notes]).toBe('Window seat, "great" view')
    expect(doc.records[1].cells[notes]).toBe('  line one\nline two  ')
    expect(doc.records[1].cells[2]).toBe('072')
    expect(doc.records[10].cells[2]).toBe('BA0001')
    expect(doc.records[9].cells.every((cell) => cell === '')).toBe(true)
  })

  it('keeps reordered and unknown columns by name', () => {
    const doc = parseFlightyCsv(fixture('reordered-extra.csv'))
    expect(doc.headers).toEqual([
      'To',
      'From',
      'Date',
      'Flight',
      'Airline',
      'Notes',
      'Flighty Import Status',
      'Canceled',
    ])
    expect(doc.unknownHeaders).toEqual(['Flighty Import Status'])
    expect(doc.missingHeaders).toHaveLength(26)
    expect(doc.records).toEqual([
      {
        ordinal: 0,
        line: 2,
        cells: ['LHR', 'JFK', '2026-03-10', '178', 'BAW', 'a, b', 'Imported', 'false'],
      },
    ])
  })

  it.each([
    [
      'BOM before a quoted header, CRLF endings',
      '﻿"Date",Airline,Flight,From,To\r\n2026-03-10,BAW,0178,JFK,LHR\r\n',
      [{ ordinal: 0, line: 2, cells: ['2026-03-10', 'BAW', '0178', 'JFK', 'LHR'] }],
    ],
    [
      'a BOM after the start is content',
      `${header}\n2026-03-10,BAW,1,JFK,﻿LHR\n`,
      [{ ordinal: 0, line: 2, cells: ['2026-03-10', 'BAW', '1', 'JFK', '﻿LHR'] }],
    ],
    [
      'blank number and empty cells stay empty strings',
      `${header}\n2019-06-01,,,SVO,LED`,
      [{ ordinal: 0, line: 2, cells: ['2019-06-01', '', '', 'SVO', 'LED'] }],
    ],
    [
      'a record of empty cells is a record; a blank line is not',
      `${header}\n\n,,,,\n`,
      [{ ordinal: 0, line: 3, cells: ['', '', '', '', ''] }],
    ],
    ['header only', `${header}\r\n`, []],
  ])('%s', (_name, text, records) => {
    expect(parseFlightyCsv(text).records).toEqual(records)
  })

  it.each([
    ['empty file', '', 'EMPTY_FILE', {}],
    ['only blank lines', '\n\n', 'EMPTY_FILE', {}],
    ['missing required header', 'Date,Airline,From,To\n', 'MISSING_HEADER', { header: 'Flight' }],
    ['duplicate header', `${header}, Date\n`, 'DUPLICATE_HEADER', { header: 'Date', line: 1 }],
    ['empty header name', `${header},\n`, 'INVALID_HEADER', { line: 1 }],
    [
      'short row',
      `${header}\n2026-01-01,BAW,1,JFK\n`,
      'ROW_WIDTH_MISMATCH',
      { line: 2, record: 1 },
    ],
    [
      'long row',
      `${header}\n1,2,3,4,5\n1,2,3,4,5,6\n`,
      'ROW_WIDTH_MISMATCH',
      { line: 3, record: 2 },
    ],
    ['unclosed quote', `${header}\n2026-01-01,BAW,1,JFK,"LHR\n`, 'MALFORMED_CSV', {}],
    ['stray quote', `${header}\n2026-01-01,B"AW,1,JFK,LHR\n`, 'MALFORMED_CSV', { line: 2 }],
  ])('rejects %s before anything is written', (_name, text, code, location) => {
    let error: unknown
    try {
      parseFlightyCsv(text)
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(FlightyParseError)
    expect(error).toMatchObject({ code, ...location })
  })

  it('never echoes cell content in a structural error', () => {
    try {
      parseFlightyCsv(`${header}\n2026-01-01,B"SECRETPNR,1,JFK,LHR\n`)
      expect.unreachable()
    } catch (error) {
      expect(String((error as Error).message)).not.toContain('SECRET')
    }
  })

  it('rejects more than 10 000 records and a record over 64 KiB', () => {
    const rows = Array.from({ length: 10_001 }, () => '2026-01-01,BAW,1,JFK,LHR').join('\n')
    expect(() => parseFlightyCsv(`${header}\n${rows}`)).toThrowError(
      expect.objectContaining({ code: 'TOO_MANY_RECORDS' }),
    )
    const long = `"${'x'.repeat(70 * 1024)}"`
    expect(() => parseFlightyCsv(`${header}\n2026-01-01,BAW,${long},JFK,LHR`)).toThrowError(
      expect.objectContaining({ code: 'RECORD_TOO_LARGE' }),
    )
  })

  it('digests chunks from ordinal, line and cells', async () => {
    const [record] = parseFlightyCsv(`${header}\n2026-01-01,BAW,1,JFK,LHR`).records
    const digest = await flightyChunkDigest([record])
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
    expect(
      await flightyChunkDigest([{ ...record, cells: [...record.cells.slice(0, 4), 'LGW'] }]),
    ).not.toBe(digest)
  })
})

describe('mapFlightyRecord', () => {
  const doc = parseFlightyCsv(fixture('observed-33.csv'))
  const map = (ordinal: number, answers = {}) =>
    mapFlightyRecord(doc.records[ordinal], doc.headers, refs, answers)

  it('maps a completed flight from its actual gate pair', () => {
    const candidate = map(0)
    expect(candidate.action).toBe('create')
    expect(candidate.issues).toEqual([])
    expect(candidate.projection).toEqual({
      date: '2026-03-10',
      origin: 'JFK',
      destination: 'LHR',
      bookedDestination: 'LHR',
      diverted: false,
      canceled: false,
      airline: 'BA',
      flightNumber: '178',
      aircraftIcao: 'B77W',
      departureTime: '19:12',
      departureDate: '2026-03-10',
      arrivalTime: '06:51',
      arrivalDate: '2026-03-11',
      departureUtc: '2026-03-10T23:12:00.000Z',
      arrivalUtc: '2026-03-11T06:51:00.000Z',
      durationMinutes: 459,
      timesFrom: 'actual_gate',
    })
    // Runway events stay separate source events; none replaced the gate times.
    expect(candidate.events.map((event) => `${event.kind}/${event.phase}`)).toEqual([
      'gate_departure/scheduled',
      'gate_departure/actual',
      'takeoff/scheduled',
      'takeoff/actual',
      'landing/scheduled',
      'landing/actual',
      'gate_arrival/scheduled',
      'gate_arrival/actual',
    ])
    expect(candidate.identity.flightyFlightId).toBe('f0000000-0000-4000-8000-000000000001')
  })

  it('keeps the previous local arrival day across the date line', () => {
    expect(map(1).projection).toMatchObject({
      date: '2026-03-11',
      airline: 'JL',
      flightNumber: '072',
      departureUtc: '2026-03-10T15:30:00.000Z',
      arrivalUtc: '2026-03-10T22:30:00.000Z',
      arrivalDate: '2026-03-10',
      durationMinutes: 420,
    })
  })

  it('preserves a cancellation without asking anything else', () => {
    const candidate = map(2)
    expect(candidate.action).toBe('preserve_only')
    expect(candidate.issues).toEqual([])
    expect(candidate.projection).toMatchObject({ canceled: true, departureUtc: null })
  })

  it('routes a diversion to the airport actually reached and keeps the booked one', () => {
    expect(map(3).projection).toMatchObject({
      origin: 'FRA',
      destination: 'BOS',
      bookedDestination: 'JFK',
      diverted: true,
      departureUtc: '2026-01-15T09:00:00.000Z',
      arrivalUtc: '2026-01-15T18:30:00.000Z',
      durationMinutes: 570,
      timesFrom: 'actual_gate',
    })
  })

  it('keeps a manual record without airline, number or times', () => {
    const candidate = map(4)
    expect(candidate.action).toBe('create')
    expect(candidate.projection).toMatchObject({
      date: '2019-06-01',
      origin: 'SVO',
      destination: 'LED',
      airline: null,
      flightNumber: null,
      timesFrom: null,
    })
  })

  it('asks once per ambiguous ICAO code and never takes the first match', () => {
    const candidate = map(5)
    expect(candidate.action).toBe('review')
    expect(candidate.projection.airline).toBeNull()
    expect(candidate.issues).toEqual([
      {
        code: 'AMBIGUOUS_AIRLINE',
        field: 'airline',
        group: 'airline:THA',
        token: 'THA',
        candidates: ['TG', 'VZ'],
      },
    ])
    const answered = map(5, { groups: { 'airline:THA': 'TG' } })
    expect(answered.action).toBe('create')
    expect(answered.projection.airline).toBe('TG')
  })

  it('falls back to the scheduled gate pair and says so', () => {
    expect(map(6).projection).toMatchObject({
      departureUtc: '2026-07-01T06:00:00.000Z',
      arrivalUtc: '2026-07-01T07:55:00.000Z',
      durationMinutes: 115,
      timesFrom: 'scheduled_gate',
    })
  })

  it('groups unknown codes and accepts only catalog answers', () => {
    const candidate = map(7)
    expect(candidate.issues).toEqual([
      { code: 'UNKNOWN_AIRPORT', field: 'origin', group: 'airport:ZZZ', token: 'ZZZ' },
      { code: 'UNKNOWN_AIRLINE', field: 'airline', group: 'airline:XQZ', token: 'XQZ' },
    ])
    const stillUnknown = map(7, { groups: { 'airport:ZZZ': 'QQQ', 'airline:XQZ': null } })
    expect(stillUnknown.issues.map((issue) => issue.code)).toEqual(['UNKNOWN_AIRPORT'])
    expect(map(7, { groups: { 'airport:ZZZ': 'SVO', 'airline:XQZ': null } }).action).toBe('create')
  })

  it('asks which instant a DST-fold departure meant', () => {
    const candidate = map(8)
    expect(candidate.issues).toEqual([
      {
        code: 'AMBIGUOUS_TIME',
        field: 'times',
        group: null,
        header: 'Gate Departure (Actual)',
        offsets: [-240, -300],
      },
    ])
    const later = map(8, { times: { offsets: { 'Gate Departure (Actual)': -300 } } })
    expect(later.projection).toMatchObject({
      departureUtc: '2026-11-01T06:30:00.000Z',
      arrivalUtc: '2026-11-01T07:40:00.000Z',
      durationMinutes: 70,
    })
    expect(map(8, { times: 'drop' }).projection.departureUtc).toBeNull()
  })

  it('reports an empty record instead of dropping it', () => {
    expect(map(9).issues).toEqual([{ code: 'EMPTY_RECORD', field: 'record', group: null }])
  })

  it('treats a blank cancellation as unknown and strips a prefix only when it repeats the airline', () => {
    const candidate = map(10)
    expect(candidate.issues).toEqual([
      { code: 'UNKNOWN_CANCELED', field: 'canceled', group: 'canceled:', token: '' },
    ])
    expect(candidate.projection.flightNumber).toBe('0001')
    expect(map(10, { groups: { 'canceled:': false } }).action).toBe('create')
    const other = mapFlightyRecord(
      { ordinal: 0, line: 2, cells: ['2026-01-01', 'BAW', 'LH400', 'JFK', 'LHR', 'false'] },
      [...header.split(','), 'Canceled'],
      refs,
    )
    expect(other.projection.flightNumber).toBe('LH400')
  })

  it('needs a decision for an unreadable time, a nonexistent time or an out-of-range duration', () => {
    const headers = [
      ...header.split(','),
      'Canceled',
      'Gate Departure (Actual)',
      'Gate Arrival (Actual)',
    ]
    const issue = (dep: string, arr: string, from = 'FRA', to = 'JFK') =>
      mapFlightyRecord(
        { ordinal: 0, line: 2, cells: ['2026-03-29', 'DLH', '1', from, to, 'false', dep, arr] },
        headers,
        refs,
      ).issues.map((entry) => entry.code)
    expect(issue('29/03/2026 10:00', '2026-03-29T13:00')).toEqual(['INVALID_TIME'])
    expect(issue('2026-03-29T02:30', '2026-03-29T13:00')).toEqual(['INCONSISTENT_TIMES'])
    expect(issue('2026-03-29T10:00', '2026-03-31T13:00')).toEqual(['DURATION_OUT_OF_RANGE'])
    expect(issue('2026-03-29T10:00', '2026-03-29T03:00')).toEqual(['INCONSISTENT_TIMES'])
    expect(issue('2026-03-29T10:00', '2026-03-29T13:00', 'FRA', 'NOZ')).toEqual(['UNRESOLVED_TIME'])
  })

  it('summarises shared questions by group', () => {
    const groups = groupFlightyIssues(
      doc.records.map((record) => mapFlightyRecord(record, doc.headers, refs)),
    )
    expect(groups.map((group) => [group.group, group.rows])).toEqual([
      ['airline:THA', 1],
      ['airline:XQZ', 1],
      ['airport:ZZZ', 1],
      ['canceled:', 1],
    ])
  })
})
