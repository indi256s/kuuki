import { isEmptyFilter, routeArrow } from '@kuuki/shared/overview/filter'
import type { OverviewScope } from '@kuuki/shared/overview/figures'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import { calendarDay } from '@kuuki/shared/overview/next'
import type { SectionId } from '@kuuki/shared/overview/prefs'

export type NarratorSlot = SectionId | 'globe' | 'firstRun' | 'zero'
export interface Trigger {
  id: string
  slot: NarratorSlot
  priority: number
  when(scope: OverviewScope, all: OverviewScope): Record<string, string | number> | null
}

export const TRIGGERS: Trigger[] = [
  // Ready Records; longestDuration destination AKL and positive minutes. Hours rounded to one decimal, explicitly approximate.
  {
    id: 'records:auckland-duration',
    slot: 'records',
    priority: 100,
    when: (scope) => {
      if (scope.records.status !== 'ready') return null
      const v = scope.records.value
      const ref = v.longestDuration
      return ref?.destination === 'AKL' && ref.value > 0
        ? { hours: Math.round(ref.value / 6) / 10 }
        : null
    },
  },
  // Ready Records; non-null longest with positive distance witness. Null aggregate flightId does not erase distance evidence.
  {
    id: 'records:longest-distance',
    slot: 'records',
    priority: 60,
    when: (scope) => {
      if (scope.records.status !== 'ready') return null
      const v = scope.records.value
      const ref = v.longest
      return ref && ref.value > 0
        ? { origin: ref.origin, destination: ref.destination, km: ref.value }
        : null
    },
  },
  // Ready Records; busiestYear with positive flights; year label from actual year, not locale-grouped count.
  {
    id: 'records:busiest-year',
    slot: 'records',
    priority: 50,
    when: (scope) => {
      if (scope.records.status !== 'ready') return null
      const v = scope.records.value
      const year = v.busiestYear
      return year && year.flights > 0
        ? { year: String(year.year), count: year.flights, months: year.activeMonths }
        : null
    },
  },
  // Ready Records; non-null busiestDay with flights greater than one. Aggregate day absence is not a quiet day.
  {
    id: 'records:busiest-day',
    slot: 'records',
    priority: 80,
    when: (scope) => {
      if (scope.records.status !== 'ready') return null
      const v = scope.records.value
      const day = v.busiestDay
      return day && day.flights > 1 ? { date: day.date, count: day.flights } : null
    },
  },
  // Ready Records; longestStreakMonths greater than one. This is months with flight evidence, not flight frequency.
  {
    id: 'records:streak',
    slot: 'records',
    priority: 55,
    when: (scope) => {
      if (scope.records.status !== 'ready') return null
      const v = scope.records.value
      return v.longestStreakMonths > 1 ? { months: v.longestStreakMonths } : null
    },
  },
  {
    id: 'records:southernmost',
    slot: 'records',
    priority: 92,
    when: (scope) => {
      if (scope.records.status !== 'ready') return null
      const ref = scope.records.value.southernmost
      return ref && ref.lat <= -30
        ? { code: ref.iata, lat: Math.round(Math.abs(ref.lat) * 10) / 10 }
        : null
    },
  },
  {
    id: 'records:shortest-duration',
    slot: 'records',
    priority: 85,
    when: (scope) => {
      if (scope.records.status !== 'ready') return null
      const ref = scope.records.value.shortestDuration
      return ref && ref.value > 0 && ref.value < 60 ? { minutes: ref.value } : null
    },
  },
  {
    id: 'records:biggest-clock-jump',
    slot: 'records',
    priority: 95,
    when: (scope) => {
      if (scope.records.status !== 'ready') return null
      const ref = scope.records.value.biggestClockJump
      return ref && Math.abs(ref.value) >= 300
        ? { hours: Math.round(Math.abs(ref.value) / 6) / 10 }
        : null
    },
  },
  {
    id: 'records:latest-departure',
    slot: 'records',
    priority: 88,
    when: (scope) => {
      if (scope.records.status !== 'ready') return null
      const ref = scope.records.value.latestDeparture
      return ref && ref.depMinute >= 1320
        ? {
            time: `${String(Math.floor(ref.depMinute / 60)).padStart(2, '0')}:${String(ref.depMinute % 60).padStart(2, '0')}`,
          }
        : null
    },
  },
  // Ready Crossings; dateLine exactly zero. Claim limited to crossings recorded by this card in the current view.
  // A fallback: Crossings often ends the page, and an absence is a weak last line when the clocks did move.
  {
    id: 'crossings:no-date-line',
    slot: 'crossings',
    priority: 70,
    when: (scope) => {
      if (scope.crossings.status !== 'ready') return null
      const v = scope.crossings.value
      return v.dateLine === 0 ? { count: v.dateLine } : null
    },
  },
  // Ready Crossings; dateLine positive. Count is route crossing total, not distinct flights or dates.
  {
    id: 'crossings:date-line',
    slot: 'crossings',
    priority: 80,
    when: (scope) => {
      if (scope.crossings.status !== 'ready') return null
      const v = scope.crossings.value
      return v.dateLine > 0 ? { count: v.dateLine } : null
    },
  },
  // Ready Crossings; forwardHours strictly exceeds backHours. Rounded engine clock changes, not time spent in flight.
  {
    id: 'crossings:forward',
    slot: 'crossings',
    priority: 90,
    when: (scope) => {
      if (scope.crossings.status !== 'ready') return null
      const v = scope.crossings.value
      return v.forwardHours > v.backHours ? { forward: v.forwardHours, back: v.backHours } : null
    },
  },
  {
    id: 'crossings:mostly-backwards',
    slot: 'crossings',
    priority: 92,
    when: (scope) => {
      if (scope.crossings.status !== 'ready') return null
      const v = scope.crossings.value
      return v.backHours > 2 * v.forwardHours ? { back: v.backHours } : null
    },
  },
  {
    id: 'crossings:arctic-circle',
    slot: 'crossings',
    priority: 95,
    when: (scope) => {
      if (scope.crossings.status !== 'ready') return null
      const count = scope.crossings.value.arcticCircle
      return count >= 1 ? { count } : null
    },
  },
  // Ready Makers; Airbus positive, strictly above every other known maker; Boeing positive. Unknown excluded only from leader comparison, not recast as known.
  {
    id: 'manufacturers:airbus-boeing',
    slot: 'aircraft',
    priority: 75,
    when: (scope) => {
      if (scope.makers.status !== 'ready') return null
      const v = scope.makers.value
      const airbus = v.rows.find((row) => row.key === 'airbus')?.flights ?? 0
      const boeing = v.rows.find((row) => row.key === 'boeing')?.flights ?? 0
      return boeing > 0 &&
        airbus > boeing &&
        v.rows.every((row) => row.key === 'airbus' || row.key === 'unknown' || airbus > row.flights)
        ? { airbus, boeing }
        : null
    },
  },
  // Ready Makers; unknown maker row positive; total denominator includes every scoped flight.
  {
    id: 'manufacturers:unknown',
    slot: 'aircraft',
    priority: 70,
    when: (scope) => {
      if (scope.makers.status !== 'ready') return null
      const v = scope.makers.value
      const unknown = v.rows.find((row) => row.key === 'unknown')?.flights ?? 0
      return unknown > 0 ? { unknown, total: v.totals.flights } : null
    },
  },
  // Ready Makers; Boeing strictly above Airbus, both positive. Comparison only, no general leader assertion.
  {
    id: 'manufacturers:boeing-airbus',
    slot: 'aircraft',
    priority: 90,
    when: (scope) => {
      if (scope.makers.status !== 'ready') return null
      const v = scope.makers.value
      const boeing = v.rows.find((row) => row.key === 'boeing')?.flights ?? 0
      const airbus = v.rows.find((row) => row.key === 'airbus')?.flights ?? 0
      return airbus > 0 && boeing > airbus ? { boeing, airbus } : null
    },
  },
  // Ready Fleet; actual byBodyType narrowbody count exceeds half of all classified body-type counts. Unknown/untyped not classified; total explicitly separate. Regional bands do not prove narrowbody.
  {
    id: 'fleet:narrow-majority',
    slot: 'aircraft',
    priority: 65,
    when: (scope) => {
      if (scope.fleet.status !== 'ready') return null
      const v = scope.fleet.value
      const narrow = v.byBodyType.find((row) => row.key === 'narrowbody')?.flights ?? 0
      const known = v.byBodyType
        .filter((row) =>
          ['narrowbody', 'widebody', 'regional', 'bizjet', 'turboprop', 'piston'].includes(row.key),
        )
        .reduce((sum, row) => sum + row.flights, 0)
      return narrow > known / 2 ? { narrow, known, total: v.total } : null
    },
  },
  // Ready Fleet; non-null positive topFamily. Engine selects stable ties; wording avoids unique leadership.
  {
    id: 'fleet:top-family',
    slot: 'aircraft',
    priority: 60,
    when: (scope) => {
      if (scope.fleet.status !== 'ready') return null
      const v = scope.fleet.value
      const family = v.topFamily
      return family && family.flights > 0 ? { family: family.family, count: family.flights } : null
    },
  },
  // Ready Fleet; untyped positive. total is all scoped flights, untyped is absence of aircraft designation, not unknown body type.
  {
    id: 'fleet:untyped',
    slot: 'aircraft',
    priority: 70,
    when: (scope) => {
      if (scope.fleet.status !== 'ready') return null
      const v = scope.fleet.value
      return v.untyped > 0 ? { untyped: v.untyped, total: v.total } : null
    },
  },
  // Ready Fleet; untyped flights outnumber half of all scoped flights, so the fleet is a sample. No numbers: the caption prints "Based on N of M".
  {
    id: 'aircraft:sample',
    slot: 'aircraft',
    priority: 110,
    when: (scope) => {
      if (scope.fleet.status !== 'ready') return null
      const v = scope.fleet.value
      return v.untyped > v.total / 2 ? {} : null
    },
  },
  // Ready Fleet; no untyped flights and at least five scoped flights. Every flight has its aircraft; no numbers.
  {
    id: 'aircraft:full',
    slot: 'aircraft',
    priority: 105,
    when: (scope) => {
      if (scope.fleet.status !== 'ready') return null
      const v = scope.fleet.value
      return v.untyped === 0 && v.total >= 5 ? {} : null
    },
  },
  // Ready Fleet; at most two distinct types across at least five typed flights. types is distinct ICAO types, typed is flights with a type.
  {
    id: 'fleet:few-types',
    slot: 'aircraft',
    priority: 98,
    when: (scope) => {
      if (scope.fleet.status !== 'ready') return null
      const v = scope.fleet.value
      return v.types <= 2 && v.typed >= 5 ? { types: v.types, typed: v.typed } : null
    },
  },
  // Ready Fleet; at least one widebody flight, but under 20% of typed flights. wide is the byBodyType widebody count, typed excludes untyped.
  {
    id: 'fleet:widebody-minority',
    slot: 'aircraft',
    priority: 85,
    when: (scope) => {
      if (scope.fleet.status !== 'ready') return null
      const v = scope.fleet.value
      const wide = v.byBodyType.find((row) => row.key === 'widebody')?.flights ?? 0
      return wide >= 1 && wide < v.typed * 0.2 ? { wide, typed: v.typed } : null
    },
  },
  // Ready Fleet; topFamily flights are at least half of typed flights. percent is a whole number of typed, not all scoped, flights.
  {
    id: 'fleet:family-majority',
    slot: 'aircraft',
    priority: 80,
    when: (scope) => {
      if (scope.fleet.status !== 'ready') return null
      const v = scope.fleet.value
      const family = v.topFamily
      return family && v.typed > 0 && family.flights >= v.typed / 2
        ? { family: family.family, percent: Math.round((family.flights / v.typed) * 100) }
        : null
    },
  },
  // Ready Routes; commuter (distinct/flights <= 0.5) or explorer (>= 0.8) profile with at least two distinct routes, so counts stay plural.
  // Flights are weighted; routes undirected. Says how often routes repeat, not why.
  ...(['commuter', 'explorer'] as const).map((profile): Trigger => ({
    id: `routes:${profile}`,
    slot: 'routes',
    priority: 70,
    when: (scope) => {
      if (scope.routes.status !== 'ready') return null
      const v = scope.routes.value
      return v.profile === profile && v.distinct > 1
        ? { flights: v.flights, distinct: v.distinct }
        : null
    },
  })),
  // Ready Routes; a most-flown undirected route flown at least twice (the engine returns null below two). Both directions together.
  {
    id: 'routes:top-repeat',
    slot: 'routes',
    priority: 80,
    when: (scope) => {
      if (scope.routes.status !== 'ready') return null
      const top = scope.routes.value.top
      return top && top.count > 1 ? { route: routeArrow(top.key), count: top.count } : null
    },
  },
  // Ready Routes; a home airport is set and at least half of the flights start or end there.
  {
    id: 'routes:home',
    slot: 'routes',
    priority: 90,
    when: (scope) => {
      if (scope.routes.status !== 'ready') return null
      const share = scope.routes.value.homeShare
      return share !== null && share >= 0.5 ? { percent: Math.round(share * 100) } : null
    },
  },
  // Ready Routes; share includes every flight on routes used at least twice, including their first flight.
  {
    id: 'routes:repeat-share',
    slot: 'routes',
    priority: 85,
    when: (scope) => {
      if (scope.routes.status !== 'ready') return null
      const share = scope.routes.value.repeatShare
      return share >= 0.6 ? { percent: Math.round(share * 100) } : null
    },
  },
  {
    id: 'routes:mixed-profile',
    slot: 'routes',
    priority: 82,
    when: (scope) => {
      if (scope.routes.status !== 'ready') return null
      const v = scope.routes.value
      return v.profile === 'mixed' ? { flights: v.flights, distinct: v.distinct } : null
    },
  },
  // Latest active scoped year only; a lone flight does not send the search back to an older year.
  {
    id: 'routes:all-new-year',
    slot: 'routes',
    priority: 98,
    when: (scope) => {
      if (scope.routes.status !== 'ready') return null
      const year = scope.routes.value.byYear.filter((row) => row.flights > 0).at(-1)
      return year && year.flights >= 2 && year.newRoutes === year.flights
        ? { year: String(year.year), flights: year.flights }
        : null
    },
  },
  {
    id: 'routes:nothing-new-year',
    slot: 'routes',
    priority: 96,
    when: (scope) => {
      if (scope.routes.status !== 'ready') return null
      const year = scope.routes.value.byYear.filter((row) => row.flights > 0).at(-1)
      return year && year.flights >= 2 && year.newRoutes === 0
        ? { year: String(year.year), flights: year.flights }
        : null
    },
  },
  {
    id: 'routes:home-on-margin',
    slot: 'routes',
    priority: 92,
    when: (scope) => {
      if (scope.routes.status !== 'ready') return null
      const share = scope.routes.value.homeShare
      return share !== null && share < 0.25 ? { percent: Math.round(share * 100) } : null
    },
  },
  // Ready Clock; actual positive peakHour matches its bucket and is strictly greater than every other departure bucket. Timed denominator is withDepartureTime.
  {
    id: 'clock:unique-peak',
    slot: 'clock',
    priority: 100,
    when: (scope) => {
      if (scope.clock.status !== 'ready') return null
      const v = scope.clock.value
      const peak = v.peakHour
      return peak &&
        peak.flights > 0 &&
        v.byHour.some((row) => row.hour === peak.hour && row.flights === peak.flights) &&
        v.byHour.every((row) => row.hour === peak.hour || row.flights < peak.flights)
        ? {
            hour: `${String(peak.hour).padStart(2, '0')}:00`,
            count: peak.flights,
            timed: v.withDepartureTime,
          }
        : null
    },
  },
  // Ready Clock; beforeNoonShare greater than one half, withDepartureTime positive. Denominator excludes missing departure times.
  {
    id: 'clock:morning-majority',
    slot: 'clock',
    priority: 70,
    when: (scope) => {
      if (scope.clock.status !== 'ready') return null
      const v = scope.clock.value
      return v.withDepartureTime > 0 && v.beforeNoonShare > 0.5
        ? { percent: Math.round(v.beforeNoonShare * 100), timed: v.withDepartureTime }
        : null
    },
  },
  // Ready Clock; redEyes positive. Producer means departure in night band, not overnight flight or poor sleep.
  {
    id: 'clock:night',
    slot: 'clock',
    priority: 60,
    when: (scope) => {
      if (scope.clock.status !== 'ready') return null
      const v = scope.clock.value
      return v.redEyes > 0 ? { count: v.redEyes, timed: v.withDepartureTime } : null
    },
  },
  // Missing departure times outnumber known times; the caption carries the counts.
  {
    id: 'clock:sample',
    slot: 'clock',
    priority: 110,
    when: (scope) => {
      if (scope.clock.status !== 'ready') return null
      const v = scope.clock.value
      return v.withDepartureTime < v.total / 2 ? {} : null
    },
  },
  {
    id: 'clock:long-haul',
    slot: 'clock',
    priority: 106,
    when: (scope) => {
      if (scope.clock.status !== 'ready') return null
      const v = scope.clock.value
      const long = v.haul.find((row) => row.key === 'long')?.flights ?? 0
      return long >= v.total / 4 ? { percent: Math.round((long / v.total) * 100) } : null
    },
  },
  {
    id: 'clock:after-noon',
    slot: 'clock',
    priority: 104,
    when: (scope) => {
      if (scope.clock.status !== 'ready') return null
      const v = scope.clock.value
      return v.beforeNoonShare < 0.35
        ? { percent: Math.round((1 - v.beforeNoonShare) * 100), timed: v.withDepartureTime }
        : null
    },
  },
  {
    id: 'clock:short-haul',
    slot: 'clock',
    priority: 96,
    when: (scope) => {
      if (scope.clock.status !== 'ready') return null
      const v = scope.clock.value
      const short = v.haul.find((row) => row.key === 'short')?.flights ?? 0
      return short >= v.total * 0.6 ? { percent: Math.round((short / v.total) * 100) } : null
    },
  },
  // The arrival winner must be unique; a tied hour does not establish a peak.
  {
    id: 'clock:arrival-peak',
    slot: 'clock',
    priority: 85,
    when: (scope) => {
      if (scope.clock.status !== 'ready') return null
      const v = scope.clock.value,
        peak = v.arrPeakHour
      return v.withArrivalTime >= 5 &&
        peak &&
        peak.flights > 0 &&
        v.arrByHour.every((row) => row.hour === peak.hour || row.flights < peak.flights)
        ? { hour: `${String(peak.hour).padStart(2, '0')}:00` }
        : null
    },
  },
  {
    id: 'clock:average-speed',
    slot: 'clock',
    priority: 50,
    when: (scope) => {
      if (scope.clock.status !== 'ready') return null
      const speed = scope.clock.value.averageSpeedKmh
      return speed !== null ? { speed: Math.round(speed) } : null
    },
  },
  // Ready Rhythm; at least two consecutive included years; each has an actual positive July cell. Span is scoped rhythm.years, not all-time or pooled busiest month.
  {
    id: 'rhythm:every-july',
    slot: 'rhythm',
    priority: 100,
    when: (scope) => {
      if (scope.rhythm.status !== 'ready') return null
      const v = scope.rhythm.value
      const years = [...v.years].sort((a, b) => a - b)
      return years.length > 1 &&
        years.every(
          (year, index) =>
            (index === 0 || year === years[index - 1] + 1) &&
            v.cells.some((cell) => cell.year === year && cell.month === 7 && cell.flights > 0),
        )
        ? { from: String(years[0]), to: String(years[years.length - 1]), years: years.length }
        : null
    },
  },
  // Ready Rhythm; longestGap positive. Empty intervening months in current view, not proof of no all-time travel.
  {
    id: 'rhythm:gap',
    slot: 'rhythm',
    priority: 70,
    when: (scope) => {
      if (scope.rhythm.status !== 'ready') return null
      const v = scope.rhythm.value
      const gap = v.longestGap
      return gap && gap.months > 0 ? { months: gap.months, from: gap.from, to: gap.to } : null
    },
  },
  {
    id: 'rhythm:july-and-august-empty',
    slot: 'rhythm',
    priority: 95,
    when: (scope) => {
      if (!isEmptyFilter(scope.filter) || scope.rhythm.status !== 'ready') return null
      const v = scope.rhythm.value
      return v.years.length >= 2 &&
        v.cells.some((cell) => cell.flights > 0) &&
        v.cells.every((cell) => (cell.month !== 7 && cell.month !== 8) || cell.flights === 0) &&
        v.years.every((year) =>
          [7, 8].every((month) =>
            v.cells.some(
              (cell) => cell.year === year && cell.month === month && cell.flights === 0,
            ),
          ),
        )
        ? { from: String(Math.min(...v.years)), to: String(Math.max(...v.years)) }
        : null
    },
  },
  // Measure the observed archive span; aggregate replay has no exact latest flight date.
  {
    id: 'rhythm:archive-depth',
    slot: 'rhythm',
    priority: 50,
    when: (scope) => {
      if (scope.rhythm.status !== 'ready') return null
      const first = scope.figures.firstDate
      if (!first || calendarDay(first) === null) return null
      const latest = scope.replay.reduce(
        (date, item) => (calendarDay(item.date) !== null && item.date > date ? item.date : date),
        '',
      )
      if (!latest) return null
      const firstYear = Number(first.slice(0, 4))
      const latestYear = Number(latest.slice(0, 4))
      return latestYear - firstYear > 3 ||
        (latestYear - firstYear === 3 && latest.slice(5) >= first.slice(5))
        ? { year: String(firstYear) }
        : null
    },
  },
  // Ready Rhythm; unique pooled winner with at least two flights; no annual recurrence implied.
  {
    id: 'rhythm:pooled-month',
    slot: 'rhythm',
    priority: 60,
    when: (scope) => {
      if (scope.rhythm.status !== 'ready') return null
      const v = scope.rhythm.value
      const month = v.busiestMonthOfYear
      if (!month || month.flights < 2) return null
      const totals = Array<number>(12).fill(0)
      for (const cell of v.cells) totals[cell.month - 1] += cell.flights
      return totals.every((flights, index) => index === month.month - 1 || flights < month.flights)
        ? { month: month.month, count: month.flights }
        : null
    },
  },
  // Ungated Rankings; matching TBS airport endpoint row count times two equals positive scope.figures.flights. Endpoint occurrences compared to flight total; never airport topShare.
  {
    id: 'rankings:tbilisi-half',
    slot: 'rankings',
    priority: 100,
    when: (scope) => {
      const count = scope.rankings.airports.find((row) => row.key === 'TBS')?.count
      return scope.figures.flights > 0 && count !== undefined && count * 2 === scope.figures.flights
        ? { count, flights: scope.figures.flights }
        : null
    },
  },
  // Ungated Rankings; positive displayed top airport and airport leader total. Stable ties admitted, endpoint denominator includes both ends.
  {
    id: 'rankings:airport-leader',
    slot: 'rankings',
    priority: 60,
    when: (scope) => {
      const leader = scope.rankings.leaders.airports
      const top = leader.top[0]
      return top && top.count > 0 && leader.total > 0
        ? { code: top.key, count: top.count, endpoints: leader.total }
        : null
    },
  },
  // Ungated Rankings; displayed top airline exceeds half of known-airline flights. Denominator only flights with airline recorded, not all flights.
  {
    id: 'rankings:airline-leader',
    slot: 'rankings',
    priority: 80,
    when: (scope) => {
      const leader = scope.rankings.leaders.airlines
      const top = leader.top[0]
      return top &&
        scope.rankings.airlines.length >= 2 &&
        leader.total > 0 &&
        top.count > leader.total / 2
        ? { code: top.key, count: top.count, known: leader.total }
        : null
    },
  },
  // Latest active scoped year; annual and all-time airline leaders must both be unique.
  {
    id: 'rankings:new-airline-leader',
    slot: 'rankings',
    priority: 95,
    when: (scope, all) => {
      const year = scope.figures.byYear.filter((row) => row.flights > 0).at(-1)
      if (!year || year.flights < 2) return null
      const annual = scope.rankings.rankByYear.airlines.filter((row) => row.year === year.year)
      const leaders = annual.filter((row) => row.rank === 1)
      const top = leaders[0]
      const allTime = all.rankings.airlines[0]
      const unrepresented = year.flights - annual.reduce((sum, row) => sum + row.count, 0)
      // shortcut: the bump chart omits some airlines; skip uncertain leaders until full annual counts are exposed.
      return leaders.length === 1 &&
        top.count > 0 &&
        top.count > unrepresented &&
        allTime &&
        allTime.count > 0 &&
        all.rankings.airlines.every(
          (row) => row.key === allTime.key || row.count < allTime.count,
        ) &&
        top.entity !== allTime.key
        ? { year: String(year.year) }
        : null
    },
  },
  // Shares use every scoped flight, including those without an airline.
  {
    id: 'rankings:two-airline-split',
    slot: 'rankings',
    priority: 85,
    when: (scope) => {
      const [first, second] = scope.rankings.airlines
      const flights = scope.figures.flights
      return first &&
        second &&
        flights > 0 &&
        first.count + second.count >= flights * 0.8 &&
        first.count <= flights * 0.6 &&
        second.count <= flights * 0.6
        ? { percent: Math.round(((first.count + second.count) / flights) * 100) }
        : null
    },
  },
  // Ungated Rankings; displayed top route exceeds half of route flights, with repeated flights. Undirected route key, both directions together.
  {
    id: 'rankings:route-leader',
    slot: 'rankings',
    priority: 90,
    when: (scope) => {
      const leader = scope.rankings.leaders.routes
      const top = leader.top[0]
      return top && top.count > 1 && top.count > leader.total / 2
        ? { route: top.key, count: top.count }
        : null
    },
  },
  // Ungated Globe; semantically nonempty filter; positive scope flights strictly below all flights. Explicit current-view versus all-time flight counts.
  {
    id: 'globe:filtered-total',
    slot: 'globe',
    priority: 70,
    when: (scope, all) => {
      return !isEmptyFilter(scope.filter) &&
        scope.figures.flights > 0 &&
        scope.figures.flights < all.figures.flights
        ? { selected: scope.figures.flights, total: all.figures.flights }
        : null
    },
  },
  // Ungated Globe; positive flights and more than one scoped route. Route count distinct undirected pairs, airport count scoped endpoints; not passport countries.
  {
    id: 'globe:route-footprint',
    slot: 'globe',
    priority: 50,
    when: (scope) => {
      return scope.figures.flights > 0 && scope.globe.routes.length > 1
        ? { routes: scope.globe.routes.length, airports: scope.globe.airports.length }
        : null
    },
  },

  {
    id: 'globe:few-countries',
    slot: 'globe',
    priority: 60,
    when: (scope) => {
      const countries = scope.figures.countries.value
      return countries >= 2 && countries <= 4 ? { countries } : null
    },
  },

  ...Object.entries(SECTION_GATES).map(([slot, { gate }]): Trigger => ({
    id: slot,
    slot: slot as SectionId,
    priority: 0,
    when: (scope) => (gate(scope).status === 'ready' ? { flights: scope.figures.flights } : null),
  })),
  ...(['rankings', 'globe'] as const).map((slot) => ({
    id: slot,
    slot,
    priority: 0,
    when: (scope: OverviewScope) => ({ flights: scope.figures.flights }),
  })),
  {
    id: 'firstRun',
    slot: 'firstRun',
    priority: 0,
    when: (scope) => (scope.figures.flights === 0 && isEmptyFilter(scope.filter) ? {} : null),
  },
  {
    id: 'zero',
    slot: 'zero',
    priority: 0,
    when: (scope) => (scope.figures.flights === 0 && !isEmptyFilter(scope.filter) ? {} : null),
  },
]
