import type { OverviewScope } from '@kuuki/shared/overview/figures'
import type { OverviewFilter } from '@kuuki/shared/overview/model'
import { formatNumber, type Locale } from '../../../lib/format'
import { fill, t } from '../copy'
import { CORPUS } from './corpus'
import { TRIGGERS, type HeroRecord, type NarratorSlot, type Trigger } from './triggers'

export function canonicalFilter(filter: OverviewFilter): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical).sort()
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, child]) => [key, canonical(child)]),
      )
    }
    return value
  }
  return JSON.stringify(canonical(filter))
}

export function fnv1a32(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return hash >>> 0
}

function lineOf(
  trigger: Trigger,
  params: Record<string, string | number>,
  scope: OverviewScope,
  seed: string,
  locale: Locale,
  turn = 0,
): string {
  const variant = (fnv1a32(`${seed}|${trigger.slot}|${canonicalFilter(scope.filter)}`) + turn) % 3
  const formatted = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      typeof value === 'number' ? formatNumber(locale, value) : value,
    ]),
  )
  return fill(t(CORPUS[trigger.id][variant], locale), formatted)
}

const byPriority = (a: Trigger, b: Trigger) => b.priority - a.priority

export function pickLine(
  slot: NarratorSlot,
  scope: OverviewScope,
  all: OverviewScope,
  seed: string,
  locale: Locale,
): string | null {
  for (const trigger of TRIGGERS.filter((trigger) => trigger.slot === slot).sort(byPriority)) {
    const params = trigger.when(scope, all)
    if (params !== null) return lineOf(trigger, params, scope, seed, locale)
  }
  return null
}

/** A hero record's takeover line: its best firing `hero` trigger, else its `heroSmall` one. `turn` counts the record's openings, so
 * the first opening reads the footer's line when this record won it, and each later one steps to the next line of the triple. */
export function recordLine(
  record: HeroRecord,
  scope: OverviewScope,
  all: OverviewScope,
  seed: string,
  locale: Locale,
  turn: number,
): string | null {
  for (const slot of ['hero', 'heroSmall'] as const)
    for (const trigger of TRIGGERS.filter(
      (trigger) => trigger.slot === slot && trigger.record === record,
    ).sort(byPriority)) {
      const params = trigger.when(scope, all)
      if (params !== null) return lineOf(trigger, params, scope, seed, locale, turn)
    }
  return null
}
