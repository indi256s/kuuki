// OpenFlights CSV export for the Journal (spec: Selection and bulk actions -> Export). Pure string building plus one
// browser download helper; the caller picks the flights (selection or "all matching") and their order.
//
// Format, checked 2026-10-09 against the OpenFlights CSV spec revision 0.41/0.42
// (https://openflights.org/help/csv.php) and the importer/exporter source
// (https://github.com/jpatokal/openflights/blob/master/php/import.php, .../php/flights.php):
// - RFC 4180: UTF-8, comma separator, CRLF row separator, double-quote field delimiter. The first line is a header the
//   importer skips (`str_getcsv`, first row dropped); the docs say it starts with a UTF-8 BOM (EF BB BF) and OpenFlights'
//   own export prints "\xEF\xBB\xBF" before it, so we emit the BOM.
// - Header, 19 columns, exact: Date,From,To,Flight_Number,Airline,Distance,Duration,Seat,Seat_Type,Class,Reason,Plane,
//   Registration,Trip,Note,From_OID,To_OID,Airline_OID,Plane_OID
// - Date: YYYY-MM-DD (preferred), optionally followed by a space and the departure time HH:MM[:SS] (seconds ignored).
// - From / To: IATA or ICAO airport code; mandatory unless the OID column is given. The OID columns are OpenFlights
//   internal ids and must not be supplied for foreign data, so they stay empty.
// - Flight_Number: if its first two characters are an alphanumeric, not all-digit airline code, that code overrides
//   Airline; an unrecognised code makes the import fail.
// - Airline: full airline name. "Airline codes are not recognized", so we use `refs.airlines[iata].name`, never the code.
// - Distance: miles (the importer does no conversion). Kuuki stores km, so we convert and round to whole miles.
// - Duration: HH:MM. Estimated by OpenFlights when blank.
// - Seat_Type W/A/M, Class F/C/P/Y, Reason B/L/C/O: Kuuki has none of these, left empty. Seat, Registration, Trip too.
// - Plane: plane type, matched by exact `planes.name` (e.g. "Boeing 777"); an unmatched name is added as a new plane.
//   We use `refs.aircraft[icao].name`, falling back to the ICAO code when the name is unknown.
// - Note: free text. Kuuki-only state is folded in here: an `awaiting` flight gets "Awaiting confirmation" (English
//   only, this is an interchange file). `upcoming` flights are exported as ordinary rows; confirmation source is dropped.
import type { JournalFlight, JournalRefs } from './model'

const HEADER = [
  'Date',
  'From',
  'To',
  'Flight_Number',
  'Airline',
  'Distance',
  'Duration',
  'Seat',
  'Seat_Type',
  'Class',
  'Reason',
  'Plane',
  'Registration',
  'Trip',
  'Note',
  'From_OID',
  'To_OID',
  'Airline_OID',
  'Plane_OID',
]

const KM_PER_MILE = 1.609344
const AWAITING_NOTE = 'Awaiting confirmation'

/** RFC 4180: quote a field holding a comma, quote or line break, doubling inner quotes. */
function field(value: string | null | undefined): string {
  if (value == null || value === '') return ''
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DD`, plus ` HH:MM` when the departure time is a usable clock time. */
function dateTime(date: string, departureTime: string | null): string {
  const time = departureTime?.match(/^(\d{1,2}):(\d{2})/)
  return time ? `${date} ${pad2(Number(time[1]))}:${time[2]}` : date
}

function duration(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return ''
  const whole = Math.round(minutes)
  return `${pad2(Math.floor(whole / 60))}:${pad2(whole % 60)}`
}

function miles(km: number | null): string {
  if (km == null || !Number.isFinite(km) || km < 0) return ''
  return String(Math.round(km / KM_PER_MILE))
}

function row(flight: JournalFlight, refs: JournalRefs): string {
  const airline = flight.airline_iata ? refs.airlines[flight.airline_iata]?.name : null
  const plane = flight.aircraft_icao
    ? (refs.aircraft[flight.aircraft_icao]?.name ?? flight.aircraft_icao)
    : null
  const note = flight.lifecycle_state === 'awaiting' ? AWAITING_NOTE : null
  return [
    dateTime(flight.date, flight.departure_time),
    flight.origin,
    flight.destination,
    flight.flight_number,
    airline,
    miles(flight.distance_km),
    duration(flight.duration_minutes),
    '',
    '',
    '',
    '', // Seat, Seat_Type, Class, Reason
    plane,
    '',
    '', // Registration, Trip
    note,
    '',
    '',
    '',
    '', // From_OID, To_OID, Airline_OID, Plane_OID
  ]
    .map(field)
    .join(',')
}

/** One OpenFlights CSV row per flight, in the given order, behind a BOM and the header; every line ends in CRLF. */
export function openFlightsCsv(flights: JournalFlight[], refs: JournalRefs): string {
  return (
    '﻿' +
    [HEADER.join(','), ...flights.map((flight) => row(flight, refs))]
      .map((line) => line + '\r\n')
      .join('')
  )
}

/** Save `text` as a file through a temporary `<a download>` pointing at an object URL. */
export function downloadCsv(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** `kuuki-flights-YYYY-MM-DD.csv` for the local calendar day. */
export function exportFileName(date = new Date()): string {
  return `kuuki-flights-${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.csv`
}
