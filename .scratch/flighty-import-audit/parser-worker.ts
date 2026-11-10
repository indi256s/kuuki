// Compile proof (plan Task 3): the shared Flighty parser and mapper bundle into a Worker with no Node compatibility flags.
import { mapFlightyRecord, parseFlightyCsv } from '../../packages/shared/src/flighty'

const refs = {
  airlinesByIcao: (icao: string) => (icao === 'BAW' ? ['BA'] : []),
  airlineExists: (iata: string) => iata === 'BA',
  airport: (iata: string) =>
    iata === 'JFK' ? { timezone: 'America/New_York' } : iata === 'LHR' ? { timezone: 'Europe/London' } : null,
  aircraftByName: () => [],
}

export default {
  async fetch(request: Request): Promise<Response> {
    const doc = parseFlightyCsv(await request.text())
    const candidates = doc.records.map((record) => mapFlightyRecord(record, doc.headers, refs))
    return Response.json({ records: doc.records.length, actions: candidates.map((c) => c.action) })
  },
}
