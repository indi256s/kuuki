// Ground-travel wording for values that may be unknown. Unknown is a word, never zero, and every distance is
// a straight-line approximation.

import type { Coverage } from '@kuuki/shared/groundTravel'
import { formatDistanceKm, formatDuration, formatNumber, type Locale } from '../../lib/format'

export const unknownText = (locale: Locale) => (locale === 'ru' ? 'неизвестно' : 'unknown')

/** "1 234 км" or "unknown"; km is rounded to whole kilometres. */
export function approxDistance(locale: Locale, km: number | null): string {
  return km === null ? unknownText(locale) : formatDistanceKm(locale, Math.round(km))
}

export function knownDuration(locale: Locale, minutes: number | null): string {
  return minutes === null ? unknownText(locale) : formatDuration(locale, minutes)
}

/** "2 of 3 known" when a total covers only part of its rows; empty when the total is complete. */
export function coverageNote(locale: Locale, coverage: Coverage | null): string {
  if (!coverage || coverage.known === coverage.total) return ''
  const known = formatNumber(locale, coverage.known)
  const total = formatNumber(locale, coverage.total)
  return locale === 'ru' ? `известно ${known} из ${total}` : `${known} of ${total} known`
}
