import { formatNumber, type Locale } from './format'

/** 0 = never visited; 1..4 = fixed visit-count buckets (1, 2–3, 4–9, 10+). */
export type VisitBucket = 0 | 1 | 2 | 3 | 4

export function visitBucket(count: number): VisitBucket {
  return count <= 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 9 ? 3 : 4
}

/** CSS custom property per bucket (index = bucket); every theme and accent defines them in styles.css. */
export const BUCKET_TOKENS = ['--map-land', '--map-bucket-1', '--map-bucket-2', '--map-bucket-3', '--map-bucket-4'] as const

// Legend text for buckets 1..4 per UI locale; numerals go through the shared number formatter.
const labels = (locale: Locale) => {
  const n = (v: number) => formatNumber(locale, v)
  return [n(1), `${n(2)}–${n(3)}`, `${n(4)}–${n(9)}`, `${n(10)}+`] as const
}
export const BUCKET_LABELS: Record<Locale, readonly [string, string, string, string]> = { en: labels('en'), ru: labels('ru') }
