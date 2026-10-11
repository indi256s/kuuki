import airportCatalog from '../../../packages/data/src/airports.json'
import airlineCatalog from '../../../packages/data/src/airlines.json'
import { airportAliases, foldSearchText } from '../../../packages/shared/src/airportSearch'
import { isCalendarDate } from '../../../packages/shared/src/flightValidation'
import type { ExtractedFlight, ParseResponse, RejectedFlight } from './_shared'

const code = (value: string) => value.trim().toUpperCase()
const airlineName = (value: string) =>
  foldSearchText(value)
    .replace(/\b(airlines?|airways|international)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
const airportName = (value: string) =>
  foldSearchText(value)
    .replace(/\b(international|airport)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Every catalog airport a label can mean: an exact code, or a name, city or alias. Sorted, at most 6. */
export function airportCandidates(label: string): string[] {
  const value = label.replace(/[.,]$/, '').trim()
  if (/^[A-Z]{3}$/.test(value)) return [value]
  // The offline catalog shortens this city's name to Rostov.
  const name = airportName(value).replace(/^rostov-on-don$/, 'rostov')
  const matches = airportCatalog.filter((row) =>
    [row.iata, row.city, row.name, ...Object.values(airportAliases[row.iata] ?? {})].some(
      (label) => airportName(label) === name,
    ),
  )
  return [...new Set(matches.map((row) => row.iata))].sort().slice(0, 6)
}

function airport(value: string): string {
  const candidates = airportCandidates(value)
  return candidates.length === 1 ? candidates[0] : ''
}

const VERSION_HEADER = /^KUUKI\s+FLIGHTS\s+v\d+$/i
const FENCE_OPEN = /^```[\w+-]*$/
const FENCE_CLOSE = /^```$/

/**
 * Only a fully recognised pipe-list bypasses the model. Any unknown prose falls back intact.
 * A leading `KUUKI FLIGHTS v<N>` line (any N) and a wrapping Markdown code fence are ignored.
 */
export function parseStructuredText(content: string): ParseResponse | null {
  const flights: ExtractedFlight[] = []
  const rejected: RejectedFlight[] = []
  let records = 0
  let leading = true
  for (const [index, raw] of content.split(/\r?\n/).entries()) {
    const line = raw.trim()
    if (!line) continue
    if (leading && (VERSION_HEADER.test(line) || FENCE_OPEN.test(line))) continue
    leading = false
    if (FENCE_CLOSE.test(line)) continue
    if (/^Other-passenger bookings or conflicting ownership \(\d+\)$/i.test(line)) return null
    if (/^Partial dates \/ incomplete records \(\d+\)$/i.test(line)) continue
    const notes = [...line.matchAll(/\[([^\]]*)\]/g)].map((match) => match[1]).join('; ')
    const parts = line
      .replace(/\[[^\]]*\]/g, '')
      .split('|')
      .map((part) => part.trim())
    if (!/^(?:\d{4}-\d{2}-\d{2}(?: \(calendar entry\))?|Undated)$/i.test(parts[0])) return null
    records++
    // Exclude this booking's status, never an uncertain refund or a cancelled *other* leg.
    const segments = notes.split(';').map((note) => note.trim())
    const uncertainStatus =
      /\?|\bnot\b|possible|unresolved|uncertain|disputed|conflict|outbound|return/i.test(notes)
    if (segments.some((note) => /^other passenger$/i.test(note))) continue
    if (
      !uncertainStatus &&
      segments.some((note) =>
        /^(?:cancel(?:led|ed)(?:\/refunded)?|refunded|unpaid(?: reservation)?|superseded|replaced by)\b/i.test(
          note,
        ),
      )
    )
      continue
    const route = parts[1]?.match(/^(.+?)\s*(?:→|➝|->|\bto\b)\s*(.+)$/i)
    const toOnly = parts[1]?.match(/^to\s+(.+)$/i)
    if (!route && !toOnly) {
      if (parts.length === 1 || /partial booking evidence/i.test(notes)) {
        rejected.push({ index, reason: 'incomplete route' })
        continue
      }
      return null
    }
    const originLabel = route ? route[1].trim() : ''
    const destinationLabel = (route?.[2] ?? toOnly![1]).trim()
    const origin = originLabel ? airport(originLabel) : ''
    const destination = airport(destinationLabel)
    const date = parts[0].slice(0, 10)
    const yearExplicit = isCalendarDate(date)
    let airline = 'ZZ'
    let hasAirline = false
    let number: string | undefined
    let departure: string | undefined
    let arrival: string | undefined
    let contradictoryArrival = false
    for (const part of parts.slice(2)) {
      if (!part || part === '?') continue
      const times = part.match(
        /^(?:dep\s+)?([01]\d|2[0-3]):([0-5]\d)(?:\s*(?:→|➝|->|-)\s*([01]\d|2[0-3]):([0-5]\d)(?:\s*(?:\((\d{4}-\d{2}-\d{2})\)|\+1))?)?$/i,
      )
      if (times) {
        if (departure) return null
        departure = `${times[1]}:${times[2]}`
        if (times[3]) arrival = `${times[3]}:${times[4]}`
        if (times[5])
          contradictoryArrival =
            !isCalendarDate(times[5]) ||
            !yearExplicit ||
            Date.parse(times[5]) < Date.parse(date) ||
            Date.parse(times[5]) > Date.parse(date) + 2 * 86_400_000
        continue
      }
      if (hasAirline) return null
      hasAirline = true
      const flight = part.match(/\b([A-Z0-9]{2})\s*(\d{1,5}[A-Z]?)$/i)
      if (flight) {
        airline = code(flight[1])
        number = code(flight[2])
        continue
      }
      const named = part.match(/^(.*?)(?:\s+(\d{1,5}))?$/)!
      const matches = airlineCatalog.filter(
        (row) => airlineName(row.name) === airlineName(named[1]),
      )
      if (matches.length !== 1) return null
      airline = matches[0].iata
      number = named[2]
    }
    const knownOrigin = airportCatalog.some((row) => row.iata === origin)
    const knownDestination = airportCatalog.some((row) => row.iata === destination)
    const knownAirline = airlineCatalog.some((row) => row.iata === airline)
    // Only status or evidence doubt blocks preselection; catalog and year gaps show in field_confidence and the empty fields.
    const review =
      contradictoryArrival ||
      /\(calendar entry\)/i.test(parts[0]) ||
      /calendar only|conflict|unresolved|unconfirmed|possible|partial booking|email says|cancel|refund|unpaid|supersed|replaced by|passenger|\?/i.test(
        notes,
      )
    flights.push({
      date: yearExplicit ? date : '',
      origin,
      destination,
      airline_iata: airline,
      flight_number: number,
      departure_time: departure,
      arrival_time: arrival,
      confidence: review ? 0.5 : 1,
      review_required: review,
      ...(originLabel && !origin ? { origin_hint: originLabel } : {}),
      ...(destinationLabel && !destination ? { destination_hint: destinationLabel } : {}),
      field_confidence: {
        date_year_explicit: yearExplicit,
        date: yearExplicit ? 1 : 0,
        origin: knownOrigin ? 1 : 0,
        destination: knownDestination ? 1 : 0,
        airline_iata: knownAirline && airline !== 'ZZ' ? 1 : 0,
        flight_number: number ? 1 : 0,
        departure_time: departure ? 1 : 0,
        arrival_time: arrival ? 1 : 0,
      },
    })
  }
  return records ? { flights, ...(rejected.length ? { rejected } : {}) } : null
}
