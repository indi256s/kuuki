import type { Gate, OverviewScope } from './figures'
import type { SectionId } from './prefs'

export type GateUnit = 'flights' | 'months' | 'times' | 'aircraft'

/** Each gated section's gate and what its threshold counts. */
export const SECTION_GATES: Record<
  Exclude<SectionId, 'rankings'>,
  { gate: (scope: OverviewScope) => Gate<unknown>; unit: GateUnit }
> = {
  routes: { gate: (scope) => scope.routes, unit: 'flights' },
  records: { gate: (scope) => scope.records, unit: 'flights' },
  crossings: { gate: (scope) => scope.continents, unit: 'flights' },
  rhythm: { gate: (scope) => scope.rhythm, unit: 'months' },
  clock: { gate: (scope) => scope.clock, unit: 'times' },
  aircraft: { gate: (scope) => scope.fleet, unit: 'aircraft' },
}
