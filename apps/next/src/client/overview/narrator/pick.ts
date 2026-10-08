import type { OverviewScope } from '@kuuki/shared/overview/figures'
import type { OverviewFilter } from '@kuuki/shared/overview/model'
import { formatNumber, type Locale } from '../../../lib/format'
import { fill, t } from '../copy'
import { CORPUS } from './corpus'
import { TRIGGERS, type NarratorSlot } from './triggers'

export function canonicalFilter(filter: OverviewFilter): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical).sort()
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, child]) => [key, canonical(child)]))
    }
    return value
  }
  return JSON.stringify(canonical(filter))
}

function fnv1a32(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return hash >>> 0
}

export function pickLine(slot: NarratorSlot, scope: OverviewScope, all: OverviewScope, seed: string, locale: Locale): string | null {
  const triggers = TRIGGERS.filter(trigger => trigger.slot === slot).sort((a, b) => b.priority - a.priority)
  for (const trigger of triggers) {
    const params = trigger.when(scope, all)
    if (params === null) continue
    const variant = fnv1a32(`${seed}|${slot}|${canonicalFilter(scope.filter)}`) % 3
    const formatted = Object.fromEntries(Object.entries(params).map(([key, value]) =>
      [key, typeof value === 'number' ? formatNumber(locale, value) : value]))
    return fill(t(CORPUS[trigger.id][variant], locale), formatted)
  }
  return null
}
