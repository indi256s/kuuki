/** Read-only explicit-target missing-aircraft inventory; never retains journal/user IDs. */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  aircraftOccurrence,
  createPrivateAircraftArtifact,
  groupAircraftOccurrences,
} from './evaluate-aircraft'
import { assertRemoteIds, openRemoteReader } from './migration-remote-reader'
import type { FlightToEnrich } from '../functions/api/enrich/_shared'

async function main() {
  const args = process.argv.slice(2)
  const option = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined)
  const accountId = option('--account-id') || ''
  const databaseId = option('--database-id') || ''
  assertRemoteIds(accountId, databaseId)
  const output = option('--output')
  if (!output) throw new Error('Explicit private --output is required')
  const artifact = await createPrivateAircraftArtifact(output)
  const reader = openRemoteReader(accountId, databaseId, 'cf')
  try {
    await artifact.write({ state: 'in_progress', inventoried_at: new Date().toISOString() })
    // Fixed projection excludes all journal and user identities. No caller SQL is accepted.
    const [counts] = await reader.read('SELECT COUNT(*) AS total FROM flights')
    const rows = await reader.read(`SELECT date, origin, destination, airline_iata, flight_number,
      aircraft_icao, lifecycle_state FROM flights
      WHERE aircraft_icao IS NULL OR TRIM(aircraft_icao) = ''
      ORDER BY date, origin, destination, airline_iata, flight_number`)
    const summary = {
      total: Number(counts?.total),
      missing_aircraft: 0,
      skipped_malformed: 0,
      skipped_future_actual: 0,
      skipped_non_actual: 0,
      eligible_occurrences: 0,
      unique_occurrences: 0,
      repeated_occurrences: 0,
    }
    const candidates: FlightToEnrich[] = []
    const today = new Date().toISOString().slice(0, 10)
    for (const row of rows) {
      if (typeof row.aircraft_icao === 'string' && row.aircraft_icao.trim()) continue
      summary.missing_aircraft++
      if (row.lifecycle_state !== 'logged') {
        summary.skipped_non_actual++
        continue
      }
      const validStrings =
        ['date', 'origin', 'destination'].every((key) => typeof row[key] === 'string') &&
        ['airline_iata', 'flight_number'].every(
          (key) => row[key] == null || typeof row[key] === 'string',
        )
      if (!validStrings) {
        summary.skipped_malformed++
        continue
      }
      const flight = aircraftOccurrence({
        id: `candidate-${candidates.length + 1}`,
        date: row.date as string,
        origin: row.origin as string,
        destination: row.destination as string,
        airline_iata: row.airline_iata as string | null,
        flight_number: row.flight_number as string | null,
      })
      if (!flight) {
        summary.skipped_malformed++
        continue
      }
      if (flight.date > today) {
        summary.skipped_future_actual++
        continue
      }
      candidates.push(flight)
    }
    const groups = groupAircraftOccurrences(candidates)
    const flights = groups.map((group, index) => ({
      ...group.flight,
      id: `candidate-${index + 1}`,
      occurrence_count: group.ids.length,
    }))
    summary.eligible_occurrences = candidates.length
    summary.unique_occurrences = flights.length
    summary.repeated_occurrences = candidates.length - flights.length
    await artifact.write({
      state: 'complete',
      inventoried_at: new Date().toISOString(),
      summary,
      flights,
    })
    console.log(JSON.stringify({ summary, output }))
  } finally {
    reader.dispose()
    await artifact.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      'Aircraft inventory failed; check explicit target, private output and authentication.',
    )
    process.exitCode = 1
  })
