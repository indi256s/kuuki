import { coverage, figures, home, totals, type OverviewScope } from './figures'
import { matches, previousPeriod } from './filter'
import type { OverviewFilter, OverviewPayload } from './model'
import { records } from './records'
import { crossings } from './crossings'
import { fleet } from './fleet'
import { makers } from './makers'
import { clock } from './clock'
import { rhythm } from './rhythm'
import { rankings } from './rankings'
import { globe } from './globe'
import { nextFlights, replayItems } from './next'

export function computeOverview(payload: OverviewPayload, filter: OverviewFilter): OverviewScope {
  const counted = payload.rows.filter(row => row.state === 'logged' || row.state === 'awaiting')
  const rows = counted.filter(row => matches(row, filter, payload.refs))
  const previous = previousPeriod(filter)
  const deltas = previous ? totals(counted.filter(row => matches(row, previous, payload.refs))) : null
  return { filter, figures: figures(rows, payload, filter, deltas, counted), coverage: coverage(rows), home: home(counted, payload),
    records: records(rows, payload.refs, payload.mode), crossings: crossings(rows, payload.refs, payload.mode, counted),
    fleet: fleet(rows, payload.refs, payload.mode), makers: makers(rows, payload.refs, payload.mode), clock: clock(rows), rhythm: rhythm(rows, payload.mode),
    rankings: rankings(rows), globe: globe(payload.rows, rows, payload.refs),
    next: nextFlights(payload, counted), replay: replayItems(rows, payload.mode) }
}
