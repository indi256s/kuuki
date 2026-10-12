// Boarding pass barcodes (IATA BCBP, Resolution 792) projected onto the few fields Kuuki may send: airports, carrier,
// flight number and Julian day. Passenger name, PNR, seat, sequence, status and the conditional/security sections are
// read past by offset and never copied out, so nothing else can leave this module. `null` means the text is not a
// boarding pass the member can use, and the caller falls back to uploading the source.

import { BOARDING_PASS_MAX_LEGS } from '@kuuki/shared/constants'

/** The leg shape the server admits for `type: 'boarding_pass'`; optional keys are omitted, never empty strings. */
export interface Leg {
  origin: string
  destination: string
  airline?: string
  flightNumber?: string
  dayOfYear?: number
}
export interface BcbpResult {
  legs: Leg[]
  /** Some encoded legs could not be read, so the list is shorter than the pass says. */
  incomplete: boolean
}

export const MAX_LEGS = BOARDING_PASS_MAX_LEGS

// The first leg is a 23-character header (format, leg count, name, e-ticket flag) followed by the same 37-character
// block every later leg repeats: PNR 7, from 3, to 3, carrier 3, flight 5, day 3, compartment 1, seat 4, sequence 5,
// status 1, then the size of the conditional section in two hex digits.
const HEADER_LENGTH = 23
const BLOCK_LENGTH = 37
const AIRPORT = /^[A-Z]{3}$/
const HEX_SIZE = /^[0-9A-F]{2}$/
const IATA_CARRIER = /^[A-Z0-9]{2}$/
const FLIGHT_NUMBER = /^(\d{1,4})([A-Z]?)$/
const JULIAN_DAY = /^\d{3}$/

function flightNumberOf(field: string): string | undefined {
  const match = FLIGHT_NUMBER.exec(field.trim())
  if (!match) return undefined
  const digits = String(Number(match[1]))
  return digits === '0' ? undefined : digits + match[2]
}

function dayOfYearOf(field: string): number | undefined {
  if (!JULIAN_DAY.test(field)) return undefined
  const day = Number(field)
  return day >= 1 && day <= 366 ? day : undefined
}

/** Reads the leg block starting at `at` (the PNR) and the size of the conditional section behind it. */
function readLeg(text: string, at: number): { leg: Leg; sectionSize: number } | null {
  if (text.length < at + BLOCK_LENGTH) return null
  const origin = text.slice(at + 7, at + 10)
  const destination = text.slice(at + 10, at + 13)
  const size = text.slice(at + 35, at + 37)
  if (!AIRPORT.test(origin) || !AIRPORT.test(destination) || !HEX_SIZE.test(size)) return null

  const carrier = text.slice(at + 13, at + 16).trim()
  const flightNumber = flightNumberOf(text.slice(at + 16, at + 21))
  const dayOfYear = dayOfYearOf(text.slice(at + 21, at + 24))
  const leg: Leg = { origin, destination }
  if (IATA_CARRIER.test(carrier)) leg.airline = carrier
  if (flightNumber) leg.flightNumber = flightNumber
  if (dayOfYear) leg.dayOfYear = dayOfYear
  return { leg, sectionSize: parseInt(size, 16) }
}

/** Projects decoded barcode text onto its legs, or returns null when it is not a readable boarding pass. */
export function parseBcbp(text: string): BcbpResult | null {
  if (text[0] !== 'M') return null
  const encoded = Number(text[1])
  if (!Number.isInteger(encoded) || encoded < 1 || encoded > 4) return null

  const legs: Leg[] = []
  let at = HEADER_LENGTH
  while (legs.length < encoded) {
    const read = readLeg(text, at)
    if (!read) break
    legs.push(read.leg)
    at += BLOCK_LENGTH + read.sectionSize
  }
  if (legs.length === 0) return null
  return { legs, incomplete: legs.length < encoded }
}

const legKey = (leg: Leg) =>
  [leg.origin, leg.destination, leg.airline, leg.flightNumber, leg.dayOfYear].join('|')

/**
 * Merges the readings of one file (a barcode seen in several renderings, or several passes on one page) in source
 * order without repeating identical legs. Legs past the cap are dropped and the result is marked incomplete.
 */
export function combineLegs(results: BcbpResult[]): BcbpResult | null {
  if (results.length === 0) return null
  const seen = new Set<string>()
  const legs: Leg[] = []
  let incomplete = results.some((result) => result.incomplete)
  for (const leg of results.flatMap((result) => result.legs)) {
    const key = legKey(leg)
    if (seen.has(key)) continue
    if (legs.length === MAX_LEGS) {
      incomplete = true
      break
    }
    seen.add(key)
    legs.push(leg)
  }
  return { legs, incomplete }
}
