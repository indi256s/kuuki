// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadCsv, exportFileName, openFlightsCsv } from './export-csv'
import type { JournalFlight, JournalRefs } from './model'

const HEADER =
  'Date,From,To,Flight_Number,Airline,Distance,Duration,Seat,Seat_Type,Class,Reason,Plane,Registration,Trip,Note,From_OID,To_OID,Airline_OID,Plane_OID'

const refs: JournalRefs = {
  airports: {},
  airlines: { TK: { name: 'Turkish Airlines' }, XX: { name: 'Quote, "Air"' } },
  aircraft: { B738: { name: 'Boeing 737-800', family: null, manufacturer: null, type: null } },
}

const flight = (patch: Partial<JournalFlight> = {}): JournalFlight =>
  ({
    id: 1,
    date: '2026-10-05',
    origin: 'TBS',
    destination: 'IST',
    airline_iata: 'TK',
    aircraft_icao: 'B738',
    flight_number: 'TK123',
    departure_time: '12:05',
    arrival_time: '14:00',
    departure_utc: null,
    arrival_utc: null,
    origin_tz: null,
    dest_tz: null,
    distance_km: 1609.344,
    duration_minutes: 125,
    duration_source: null,
    zones_overflown: null,
    source: 'manual',
    is_upcoming: false,
    enrichment_status: 'done',
    created_at: '2026-10-01T00:00:00Z',
    lifecycle_state: 'logged',
    confirmation_source: 'manual',
    confirmed_at: null,
    lifecycle_timezone: null,
    awaiting_after: null,
    auto_confirm_after: null,
    arrival_transit: null,
    arrival_transit_leg_id: null,
    origin_country: 'GE',
    destination_country: 'TR',
    ...patch,
  }) as JournalFlight

const lines = (csv: string) => csv.split('\r\n')

describe('openFlightsCsv', () => {
  it('starts with a BOM and the exact 19-column header, and ends every line with CRLF', () => {
    const csv = openFlightsCsv([flight()], refs)
    expect(csv.startsWith('﻿' + HEADER + '\r\n')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect(openFlightsCsv([], refs)).toBe('﻿' + HEADER + '\r\n')
  })

  it('writes date and time, airline name, miles, HH:MM and plane name in column order, keeping the given order', () => {
    const csv = openFlightsCsv(
      [
        flight(),
        flight({
          id: 2,
          date: '2026-09-01',
          departure_time: null,
          origin: 'IST',
          destination: 'TBS',
        }),
      ],
      refs,
    )
    const rows = lines(csv)
    expect(rows[1]).toBe(
      '2026-10-05 12:05,TBS,IST,TK123,Turkish Airlines,1000,02:05,,,,,Boeing 737-800,,,,,,,',
    )
    expect(rows[2]).toBe(
      '2026-09-01,IST,TBS,TK123,Turkish Airlines,1000,02:05,,,,,Boeing 737-800,,,,,,,',
    )
    expect(rows[1]!.split(',')).toHaveLength(19)
  })

  it('turns null fields into empty columns and falls back to the ICAO code for an unnamed aircraft', () => {
    const empty = flight({
      airline_iata: null,
      aircraft_icao: null,
      flight_number: null,
      departure_time: null,
      distance_km: null,
      duration_minutes: null,
    })
    expect(lines(openFlightsCsv([empty], refs))[1]).toBe('2026-10-05,TBS,IST,,,,,,,,,,,,,,,,')
    expect(
      lines(openFlightsCsv([flight({ aircraft_icao: 'A320', airline_iata: 'ZZ' })], refs))[1],
    ).toContain('TK123,,1000,02:05,,,,,A320,')
  })

  it('quotes fields with commas, quotes or line breaks and doubles inner quotes', () => {
    const csv = openFlightsCsv([flight({ airline_iata: 'XX', flight_number: 'A\nB' })], refs)
    expect(csv).toContain(',"A\nB","Quote, ""Air""",')
  })

  it('puts awaiting confirmation in Note, exports upcoming as is and drops the confirmation source', () => {
    const csv = openFlightsCsv(
      [
        flight({ lifecycle_state: 'awaiting' }),
        flight({ lifecycle_state: 'upcoming', is_upcoming: true }),
      ],
      refs,
    )
    const [, awaiting, upcoming] = lines(csv)
    expect(awaiting!.split(',')[14]).toBe('Awaiting confirmation')
    expect(upcoming!.split(',')[14]).toBe('')
    expect(csv).not.toContain('manual')
  })

  it('converts km to whole miles and minutes to zero-padded HH:MM', () => {
    const cols = (patch: Partial<JournalFlight>) =>
      lines(openFlightsCsv([flight(patch)], refs))[1]!.split(',')
    expect(cols({ distance_km: 542 * 1.609344 })[5]).toBe('542')
    expect(cols({ distance_km: 0 })[5]).toBe('0')
    expect(cols({ duration_minutes: 95 })[6]).toBe('01:35')
    expect(cols({ duration_minutes: 0 })[6]).toBe('00:00')
    expect(cols({ duration_minutes: 725 })[6]).toBe('12:05')
  })
})

describe('exportFileName', () => {
  it('uses the local calendar day, zero-padded', () => {
    expect(exportFileName(new Date(2026, 9, 9, 23, 59))).toBe('kuuki-flights-2026-10-09.csv')
    expect(exportFileName(new Date(2026, 0, 5))).toBe('kuuki-flights-2026-01-05.csv')
  })
})

describe('downloadCsv', () => {
  afterEach(() => vi.restoreAllMocks())

  it('clicks a temporary download link for an object URL and revokes it', () => {
    const create = vi.fn(() => 'blob:csv')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadCsv('kuuki-flights-2026-10-09.csv', 'x')
    expect(create).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toBe('kuuki-flights-2026-10-09.csv')
    expect(link.getAttribute('href')).toBe('blob:csv')
    expect(revoke).toHaveBeenCalledWith('blob:csv')
    expect(document.querySelector('a[download]')).toBeNull()
  })
})
