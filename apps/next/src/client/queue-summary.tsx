import Link from 'next/link'
import { formatCount, formatNumber, type Locale } from '../lib/format'

const FORMS = {
  en: { one: '{count} awaiting confirmation', other: '{count} awaiting confirmation' },
  ru: { one: '{count} ждёт отметки', few: '{count} ждут отметки', many: '{count} ждут отметки', other: '{count} ждут отметки' },
}

/**
 * Header slot for the confirmation queue. Renders nothing for 0 or an unknown count and never a bare dot.
 * Unwired in W2: C4 supplies `count` in W3.
 */
export function QueueSummarySlot({ count, locale = 'en' }: { count?: number | null; locale?: Locale }) {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) return null
  const whole = Math.floor(count)
  return <Link href="/journal" className="queue-summary" aria-label={formatCount(locale, whole, FORMS)} title={formatCount(locale, whole, FORMS)}>{formatNumber(locale, whole)}</Link>
}
