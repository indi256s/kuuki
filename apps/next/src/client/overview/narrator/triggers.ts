import { EARTH_CIRCUMFERENCE_KM } from '@kuuki/shared/constants'
import { isEmptyFilter, routeArrow } from '@kuuki/shared/overview/filter'
import type { OverviewScope } from '@kuuki/shared/overview/figures'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import { calendarDay } from '@kuuki/shared/overview/next'
import type { SectionId } from '@kuuki/shared/overview/prefs'

export type NarratorSlot = SectionId | 'globe' | 'hero' | 'heroSmall' | 'firstRun' | 'zero'
export type HeroRecord = 'flights' | 'km' | 'air' | 'countries' | 'airports'
export interface Trigger {
  id: string
  slot: NarratorSlot
  priority: number
  record?: HeroRecord
  words?: Record<string, 'month' | 'yearMonth' | 'day'>
  when(scope: OverviewScope, all: OverviewScope): Record<string, string | number> | null
}

const EQUATOR_KM = EARTH_CIRCUMFERENCE_KM,
  WEEK_MINUTES = 7 * 24 * 60

export const TRIGGERS: Trigger[] = [
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
  {
    id: 'records:busiest-day',
    slot: 'records',
    priority: 80,
    words: { date: 'day' },
    when: (scope) => {
      if (scope.records.status !== 'ready') return null
      const v = scope.records.value
      const day = v.busiestDay
      return day && day.flights > 1 ? { date: day.date, count: day.flights } : null
    },
  },
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
  {
    id: 'crossings:continent-majority',
    slot: 'crossings',
    priority: 97,
    when: (scope) => {
      if (scope.continents.status !== 'ready') return null
      const v = scope.continents.value
      const flights = v.placed + v.unplaced
      const top = Math.max(...v.rows.map((row) => row.flights))
      return v.flown >= 2 && flights > 0 && top >= flights * 0.75
        ? { percent: Math.round((top / flights) * 100) }
        : null
    },
  },
  {
    id: 'crossings:no-new-continent',
    slot: 'crossings',
    priority: 89,
    when: (scope) => {
      if (scope.continents.status !== 'ready') return null
      const flown = scope.continents.value.rows.filter((row) => row.flights > 0)
      if (flown.length < 2 || flown.some((row) => row.firstYear === null)) return null
      const newest = Math.max(...flown.map((row) => row.firstYear!))
      const latest = scope.figures.byYear.filter((row) => row.flights > 0).at(-1)?.year
      return latest !== undefined && latest >= newest + 2 ? { year: String(newest) } : null
    },
  },
  {
    id: 'crossings:no-antarctica',
    slot: 'crossings',
    priority: 72,
    when: (scope) => {
      if (scope.continents.status !== 'ready') return null
      const v = scope.continents.value
      const antarctica = v.rows.find((row) => row.id === 'antarctica')?.flights ?? 0
      return v.flown >= 2 && antarctica === 0 ? { flown: v.flown } : null
    },
  },
  {
    id: 'crossings:no-date-line',
    slot: 'crossings',
    priority: 70,
    when: (scope) => {
      if (scope.crossings.status !== 'ready') return null
      const v = scope.crossings.value
      return v.locatedFlights === scope.figures.flights && v.dateLine === 0
        ? { count: v.dateLine }
        : null
    },
  },
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
  {
    id: 'crossings:equator',
    slot: 'crossings',
    priority: 93,
    when: (scope) => {
      if (scope.crossings.status !== 'ready') return null
      const count = scope.crossings.value.equator
      return count >= 1 ? { count } : null
    },
  },
  {
    id: 'crossings:zones',
    slot: 'crossings',
    priority: 91,
    when: (scope) => {
      if (scope.crossings.status !== 'ready') return null
      const zones = scope.crossings.value.offsets.filter((row) => row.hit).length
      return zones >= 4 && zones <= 22 ? { zones, left: 24 - zones } : null
    },
  },
  {
    id: 'crossings:no-equator',
    slot: 'crossings',
    priority: 68,
    when: (scope) => {
      if (scope.crossings.status !== 'ready') return null
      return scope.crossings.value.locatedFlights === scope.figures.flights &&
        scope.crossings.value.equator === 0
        ? {}
        : null
    },
  },
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
  {
    id: 'rhythm:gap',
    slot: 'rhythm',
    priority: 70,
    words: { from: 'yearMonth', to: 'yearMonth' },
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
  {
    id: 'rhythm:pooled-month',
    slot: 'rhythm',
    priority: 60,
    words: { month: 'month' },
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

  {
    id: 'hero:flights',
    slot: 'hero',
    record: 'flights',
    priority: 40,
    when: (scope) => (scope.figures.flights >= 25 ? { flights: scope.figures.flights } : null),
  },
  {
    id: 'hero:ground-share',
    slot: 'hero',
    record: 'km',
    priority: 75,
    when: (scope) => {
      const f = scope.figures
      const ground = f.travelKm - f.distanceKm
      return f.scope === 'all' &&
        f.groundJourneys > 0 &&
        f.travelKm > 0 &&
        ground >= f.travelKm * 0.1
        ? { percent: Math.round((ground / f.travelKm) * 100) }
        : null
    },
  },
  {
    id: 'hero:flights-cost',
    slot: 'hero',
    record: 'flights',
    priority: 42,
    when: (scope) => (scope.figures.flights >= 100 ? { flights: scope.figures.flights } : null),
  },
  {
    id: 'hero:km-belt',
    slot: 'hero',
    record: 'km',
    priority: 70,
    when: (scope) => (scope.figures.travelKm >= 100_000 ? {} : null),
  },
  {
    id: 'hero:km-equators',
    slot: 'hero',
    record: 'km',
    priority: 60,
    when: (scope) => {
      const km = scope.figures.travelKm
      return km >= EQUATOR_KM && km < 100_000
        ? { laps: Math.floor((km / EQUATOR_KM) * 10) / 10 }
        : null
    },
  },
  {
    id: 'hero:air-days',
    slot: 'hero',
    record: 'air',
    priority: 55,
    when: (scope) => {
      const minutes = scope.figures.durationMinutes
      return minutes >= WEEK_MINUTES ? { days: Math.floor(minutes / 144) / 10 } : null
    },
  },
  {
    id: 'hero:countries',
    slot: 'hero',
    record: 'countries',
    priority: 50,
    when: (scope) =>
      scope.figures.countries.value >= 10 ? { countries: scope.figures.countries.value } : null,
  },
  {
    id: 'hero:airports',
    slot: 'hero',
    record: 'airports',
    priority: 45,
    when: (scope) => (scope.figures.airports >= 10 ? { airports: scope.figures.airports } : null),
  },
  {
    id: 'heroSmall:flights',
    slot: 'heroSmall',
    record: 'flights',
    priority: 0,
    when: (scope) => {
      const flights = scope.figures.flights
      return flights > 0 && flights < 25 ? { flights } : null
    },
  },
  {
    id: 'heroSmall:km',
    slot: 'heroSmall',
    record: 'km',
    priority: 0,
    when: (scope) => {
      const km = scope.figures.travelKm
      return km > 0 && km < EQUATOR_KM ? { pct: Math.floor((km / EQUATOR_KM) * 100) } : null
    },
  },
  {
    id: 'heroSmall:air',
    slot: 'heroSmall',
    record: 'air',
    priority: 0,
    when: (scope) => {
      const minutes = scope.figures.durationMinutes
      return scope.figures.flights > 0 && minutes < WEEK_MINUTES
        ? { hours: Math.floor(minutes / 60) }
        : null
    },
  },
  {
    id: 'heroSmall:countries',
    slot: 'heroSmall',
    record: 'countries',
    priority: 0,
    when: (scope) => {
      const countries = scope.figures.countries.value
      return (scope.figures.flights > 0 || scope.figures.groundJourneys > 0) && countries < 10
        ? { countries }
        : null
    },
  },
  {
    id: 'heroSmall:airports',
    slot: 'heroSmall',
    record: 'airports',
    priority: 0,
    when: (scope) => {
      const airports = scope.figures.airports
      return scope.figures.flights > 0 && airports < 10 ? { airports } : null
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
