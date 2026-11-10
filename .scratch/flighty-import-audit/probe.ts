import assert from 'node:assert/strict'
import { parseStructuredText } from '../../functions/api/import/_text'
import { normalizeFlights, validateImportSource } from '../../functions/api/import/_extract'
import { draftFieldsOf, draftToFlightInput } from '../../functions/api/_services/importDrafts'
import { resolveFlightTimes } from '../../functions/api/_services/flightMetrics'

// Synthetic evidence only: these are not represented as an official Flighty export fixture.
const csv = 'Date,Airline,Flight,From,To\r\n2026-03-10,BA,178,JFK,LHR\r\n'
assert.equal(parseStructuredText(csv), null)
let csvError = ''
try {
  validateImportSource({ type: 'csv', content: csv } as never)
} catch (error) {
  csvError = (error as { code: string }).code
}
assert.equal(csvError, 'INVALID_SOURCE_TYPE')
console.log(JSON.stringify({ probe: 'csv-admission', sourceType: csvError, pastedCsv: 'model-fallback' }))

const row = {
  date: '2026-03-10', origin: 'JFK', destination: 'LHR', airline_iata: 'BA',
  flight_number: '178', aircraft_icao: 'B738', departure_time: '19:00', arrival_time: '07:00',
  confidence: 1, field_confidence: { date_year_explicit: true },
  tail_number: 'G-TEST', seat: '12A', notes: 'synthetic note', cabin_class: 'Business',
  canceled: true, diverted_to: 'LGW', arrival_date: '2026-03-12',
}
const normalized = normalizeFlights({ flights: [row] }).flights[0]
const converted = draftToFlightInput(draftFieldsOf(normalized))
const unsupported = ['tail_number', 'seat', 'notes', 'cabin_class', 'canceled', 'diverted_to', 'arrival_date']
for (const key of unsupported) assert.equal(key in converted, false)
assert.equal(normalized.destination, 'LHR')
console.log(JSON.stringify({ probe: 'projection', retainedFlightCount: 1, unsupportedFields: unsupported, destination: normalized.destination }))

const noNumber = { ...row, flight_number: undefined, airline_iata: 'ZZ' }
const partial = draftToFlightInput(draftFieldsOf(normalizeFlights({ flights: [noNumber] }).flights[0]))
assert.equal(partial.flight_number, undefined)
assert.equal(partial.origin, 'JFK')
console.log(JSON.stringify({ probe: 'manual-flight', keptWithoutNumber: true }))

const dayMinusOne = resolveFlightTimes({
  date: '2026-03-11', origin: 'HND', destination: 'HNL',
  departureTime: '00:30', arrivalTime: '12:30',
}, null, null)
const actualArrival = '2026-03-10T22:30:00.000Z'
assert.equal(dayMinusOne.arrivalUtc, '2026-03-11T22:30:00.000Z')
assert.notEqual(dayMinusOne.arrivalUtc, actualArrival)
console.log(JSON.stringify({ probe: 'date-line', expectedArrivalUtc: actualArrival, computedArrivalUtc: dayMinusOne.arrivalUtc, computedMinutes: dayMinusOne.durationMinutes }))
