// The four ways a manual ground visit is recorded, shared by the atlas sticker tabs and the country sheet.
import type { EntryMethod, GroundVisitMode } from '@kuuki/shared'
import type { Locale } from '../../lib/format'

export type VisitWay = 'rail' | 'road' | 'sea' | 'other'

export const VISIT_WAYS: readonly VisitWay[] = ['rail', 'road', 'sea', 'other']

/** Tab and form labels. */
export const WAY_LABELS: Record<VisitWay, Record<Locale, string>> = {
  rail: { en: 'By train', ru: 'Поездом' },
  road: { en: 'By car', ru: 'На машине' },
  sea: { en: 'By sea', ru: 'Морем' },
  other: { en: 'Other', ru: 'Иначе' },
}

/** What each way writes: a train or car is a land visit with that mode; Other names no method. */
export function wayPayload(way: VisitWay): { entryMethod: EntryMethod; mode: GroundVisitMode } {
  if (way === 'rail' || way === 'road') return { entryMethod: 'land', mode: way }
  return { entryMethod: way === 'sea' ? 'sea' : null, mode: null }
}

type StoredWay = { entryMethod: string | null; mode?: string | null }

/** The way a stored visit reads as; a legacy land visit without a mode is `land`, which no tab writes. */
export function wayOf(visit: StoredWay): VisitWay | 'land' {
  if (visit.entryMethod === 'land')
    return visit.mode === 'rail' || visit.mode === 'road' ? visit.mode : 'land'
  return visit.entryMethod === 'sea' ? 'sea' : 'other'
}

const ROW_WAYS: Record<VisitWay | 'land', Record<Locale, string>> = {
  rail: { en: 'by train', ru: 'поездом' },
  road: { en: 'by car', ru: 'на машине' },
  sea: { en: 'by sea', ru: 'морем' },
  land: { en: 'by land', ru: 'по суше' },
  other: { en: 'another way', ru: 'другим способом' },
}

/** The way as it reads inside a visit row, after the year: "2019 · by train". */
export function rowWayLabel(visit: StoredWay, locale: Locale): string {
  return ROW_WAYS[wayOf(visit)][locale]
}
