import { isEmptyFilter } from '@kuuki/shared/overview/filter'
import type { OverviewScope } from '@kuuki/shared/overview/figures'
import type { SectionId } from '@kuuki/shared/overview/prefs'

export type NarratorSlot = SectionId | 'globe' | 'firstRun' | 'zero'
export interface Trigger {
  id: string
  slot: NarratorSlot
  priority: number
  when(scope: OverviewScope, all: OverviewScope): Record<string, string | number> | null
}

const gated = [
  ['records', 'records'], ['crossings', 'crossings'], ['manufacturers', 'makers'],
  ['fleet', 'fleet'], ['clock', 'clock'], ['rhythm', 'rhythm'],
] as const

export const TRIGGERS: Trigger[] = [
  ...gated.flatMap(([slot, key]): Trigger[] => [
    { id: slot, slot, priority: 0, when: scope => scope[key].status === 'ready' ? { flights: scope.figures.flights } : null },
    { id: `below:${slot}`, slot, priority: 10, when: scope => {
      const gate = scope[key]
      return gate.status === 'below' ? { have: gate.have, need: gate.need } : null
    } },
  ]),
  ...(['rankings', 'globe'] as const).map(slot => ({
    id: slot, slot, priority: 0, when: (scope: OverviewScope) => ({ flights: scope.figures.flights }),
  })),
  { id: 'firstRun', slot: 'firstRun', priority: 0,
    when: scope => scope.figures.flights === 0 && isEmptyFilter(scope.filter) ? {} : null },
  { id: 'zero', slot: 'zero', priority: 0,
    when: scope => scope.figures.flights === 0 && !isEmptyFilter(scope.filter) ? {} : null },
]
