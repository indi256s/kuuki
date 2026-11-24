import { formatNumber, type Locale } from './format'

export type VisitBucket = 0 | 1 | 2 | 3 | 4

export function visitBucket(count: number): VisitBucket {
  return count <= 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 9 ? 3 : 4
}

export const BUCKET_TOKENS = [
  '--map-land',
  '--map-bucket-1',
  '--map-bucket-2',
  '--map-bucket-3',
  '--map-bucket-4',
] as const

export const ATLAS_VISIT_TOKENS = [
  '--atlas-visit-1',
  '--atlas-visit-2',
  '--atlas-visit-3',
  '--atlas-visit-4',
] as const

const labels = (locale: Locale) => {
  const n = (v: number) => formatNumber(locale, v)
  return [n(1), `${n(2)}–${n(3)}`, `${n(4)}–${n(9)}`, `${n(10)}+`] as const
}
export const BUCKET_LABELS: Record<Locale, readonly [string, string, string, string]> = {
  en: labels('en'),
  ru: labels('ru'),
}
