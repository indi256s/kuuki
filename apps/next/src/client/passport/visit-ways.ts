import type { EntryMethod, GroundVisitMode } from '@kuuki/shared'
import type { Locale } from '../../lib/format'

export type VisitWay = 'air' | 'rail' | 'road' | 'sea' | 'other'

export const VISIT_WAYS: readonly VisitWay[] = ['air', 'rail', 'road', 'sea', 'other']

export const WAY_LABELS: Record<VisitWay, Record<Locale, string>> = {
  air: { en: 'By plane', ru: 'Самолётом' },
  rail: { en: 'By train', ru: 'Поездом' },
  road: { en: 'By car', ru: 'На машине' },
  sea: { en: 'By sea', ru: 'Морем' },
  other: { en: 'Other', ru: 'Иначе' },
}

export function wayPayload(way: VisitWay): { entryMethod: EntryMethod; mode: GroundVisitMode } {
  if (way === 'rail' || way === 'road') return { entryMethod: 'land', mode: way }
  return { entryMethod: way === 'air' || way === 'sea' ? way : null, mode: null }
}

type StoredWay = { entryMethod: string | null; mode?: string | null }

export function wayOf(visit: StoredWay): VisitWay | 'land' {
  if (visit.entryMethod === 'land')
    return visit.mode === 'rail' || visit.mode === 'road' ? visit.mode : 'land'
  return visit.entryMethod === 'air' || visit.entryMethod === 'sea' ? visit.entryMethod : 'other'
}

const ROW_WAYS: Record<VisitWay | 'land', Record<Locale, string>> = {
  air: { en: 'by plane', ru: 'самолётом' },
  rail: { en: 'by train', ru: 'поездом' },
  road: { en: 'by car', ru: 'на машине' },
  sea: { en: 'by sea', ru: 'морем' },
  land: { en: 'by land', ru: 'по суше' },
  other: { en: 'another way', ru: 'другим способом' },
}

export function rowWayLabel(visit: StoredWay, locale: Locale): string {
  return ROW_WAYS[wayOf(visit)][locale]
}

export const visitFlightHref = (id: string) => `/add?passportVisit=${encodeURIComponent(id)}`
