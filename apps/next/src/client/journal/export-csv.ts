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

function field(value: string | null | undefined): string {
  if (value == null || value === '') return ''
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

const pad2 = (n: number) => String(n).padStart(2, '0')

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
    '',
    plane,
    '',
    '',
    note,
    '',
    '',
    '',
    '',
  ]
    .map(field)
    .join(',')
}

export function openFlightsCsv(flights: JournalFlight[], refs: JournalRefs): string {
  return (
    '﻿' +
    [HEADER.join(','), ...flights.map((flight) => row(flight, refs))]
      .map((line) => line + '\r\n')
      .join('')
  )
}

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

export function exportFileName(date = new Date()): string {
  return `kuuki-flights-${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.csv`
}
