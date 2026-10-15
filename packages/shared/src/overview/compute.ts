import { coverage, figures, home, totals, type OverviewScope } from './figures'
import { effectiveScope, matches, previousPeriod } from './filter'
import type { OverviewFilter, OverviewPayload } from './model'
import { records } from './records'
import { routes } from './routes'
import { crossings } from './crossings'
import { continents } from './continents'
import { fleet } from './fleet'
import { makers } from './makers'
import { clock } from './clock'
import { rhythm } from './rhythm'
import { rankings } from './rankings'
import { globe } from './globe'
import { nextFlights, replayItems } from './next'

export function computeOverview(payload: OverviewPayload, filter: OverviewFilter): OverviewScope {
  const travelScope = effectiveScope(payload, filter)
  const counted = payload.rows.filter((row) => row.state === 'logged' || row.state === 'awaiting')
  const rows = counted.filter((row) => matches(row, filter, payload.refs))
  const previous = previousPeriod(filter)
  const deltas = previous
    ? totals(counted.filter((row) => matches(row, previous, payload.refs)))
    : null
  const homeAirport = home(counted, payload)
  const scope: OverviewScope = {
    filter,
    figures: figures(rows, payload, filter, deltas, counted, travelScope),
    coverage: coverage(rows),
    home: homeAirport,
    routes: routes(rows, counted, homeAirport?.iata ?? null),
    records: records(rows, payload.refs, payload.mode),
    crossings: crossings(rows, payload.refs, payload.mode, counted),
    continents: continents(rows, payload.refs),
    fleet: fleet(rows, payload.refs, payload.mode),
    makers: makers(rows, payload.mode),
    clock: clock(rows, payload.mode),
    rhythm: rhythm(rows, payload.mode),
    rankings: rankings(rows),
    globe: globe(payload.rows, rows, payload, filter, travelScope),
    next: nextFlights(payload, counted),
    replay: replayItems(rows, payload.mode),
  }
  return scope
}
