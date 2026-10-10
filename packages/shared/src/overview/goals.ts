import type { Gate, OverviewScope } from './figures'
import { isEmptyFilter } from './filter'
import { DEFAULT_ORDER, type SectionId } from './prefs'

export type GateUnit = 'flights' | 'months' | 'times' | 'aircraft'
export type DistanceRung = 'equator' | 'moon' | 'moon_back'

export type Goal =
  | {
      id: string
      kind: 'unlock'
      section: SectionId
      have: number
      need: number
      unit: GateUnit
    }
  | {
      id: string
      kind: 'milestone'
      metric: 'flights' | 'countries'
      have: number
      need: number
    }
  | {
      id: string
      kind: 'milestone'
      metric: 'distanceKm'
      have: number
      need: number
      rung: DistanceRung
    }

/** Each gated section's gate and what its threshold counts. */
export const SECTION_GATES: Record<
  Exclude<SectionId, 'rankings'>,
  { gate: (scope: Omit<OverviewScope, 'goals'>) => Gate<unknown>; unit: GateUnit }
> = {
  routes: { gate: (scope) => scope.routes, unit: 'flights' },
  records: { gate: (scope) => scope.records, unit: 'flights' },
  crossings: { gate: (scope) => scope.crossings, unit: 'flights' },
  rhythm: { gate: (scope) => scope.rhythm, unit: 'months' },
  clock: { gate: (scope) => scope.clock, unit: 'times' },
  aircraft: { gate: (scope) => scope.fleet, unit: 'aircraft' },
}

const CAP = 4
const LADDERS: {
  flights: number[]
  countries: number[]
  distanceKm: { need: number; rung: DistanceRung }[]
} = {
  flights: [10, 25, 50, 100, 250, 500, 1000],
  countries: [5, 10, 25, 50, 100],
  distanceKm: [
    { need: 40075, rung: 'equator' },
    { need: 384400, rung: 'moon' },
    { need: 768800, rung: 'moon_back' },
  ],
}

const progress = (goal: Goal) => goal.have / goal.need

export function goals(scope: Omit<OverviewScope, 'goals'>): Goal[] {
  if (scope.figures.flights === 0) return []
  const unlocks: Goal[] = []
  for (const section of DEFAULT_ORDER) {
    if (section === 'rankings') continue
    const { gate, unit } = SECTION_GATES[section]
    const gated = gate(scope)
    if (gated.status === 'below')
      unlocks.push({
        id: `unlock:${section}`,
        kind: 'unlock',
        section,
        have: gated.have,
        need: gated.need,
        unit,
      })
  }
  const milestones: Goal[] = []
  if (isEmptyFilter(scope.filter)) {
    const current = {
      flights: scope.figures.flights,
      countries: scope.figures.countries.value,
      distanceKm: scope.figures.distanceKm,
    }
    for (const metric of ['flights', 'countries'] as const) {
      const have = current[metric]
      const need = LADDERS[metric].find((rung) => rung > have)
      if (need !== undefined)
        milestones.push({
          id: `milestone:${metric}:${need}`,
          kind: 'milestone',
          metric,
          have,
          need,
        })
    }
    const next = LADDERS.distanceKm.find(({ need }) => need > current.distanceKm)
    if (next)
      milestones.push({
        id: `milestone:distanceKm:${next.need}`,
        kind: 'milestone',
        metric: 'distanceKm',
        have: current.distanceKm,
        need: next.need,
        rung: next.rung,
      })
  }
  const byProgress = (a: Goal, b: Goal) => progress(b) - progress(a)
  return [...unlocks.sort(byProgress), ...milestones.sort(byProgress)].slice(0, CAP)
}
