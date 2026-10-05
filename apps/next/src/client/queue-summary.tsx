'use client'

import { useAwaiting } from './awaiting'
import Link from 'next/link'
import { formatCount, formatNumber, type Locale } from '../lib/format'

const FORMS = {
  en: { one: '{count} awaiting confirmation', other: '{count} awaiting confirmation' },
  ru: { one: '{count} ждёт отметки', few: '{count} ждут отметки', many: '{count} ждут отметки', other: '{count} ждут отметки' },
}

/**
 * Header slot for the confirmation queue. Hides a zero count; an initial transport failure has an explicit unavailable state.
 * C4 supplies actionableCount; transport failures remain unknown rather than empty.
 */
export function QueueSummarySlot({ count, locale = 'en' }: { count?: number | null; locale?: Locale }) {
  const queue = useAwaiting()
  const waiting = queue.data
  count ??= waiting?.actionableCount
  if (queue.error && !waiting && count == null) return <Link href="/journal?queue=awaiting" className="queue-summary">{locale === 'ru' ? 'Очередь недоступна' : 'Queue unavailable'}</Link>
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) return null
  const whole = Math.floor(count)
  const label = waiting ? (locale === 'ru' ? `${formatNumber(locale, waiting.awaitingFlightCount)} ждут подтверждения, ${formatNumber(locale, waiting.draftRowCount)} строк для проверки` : `${formatNumber(locale, waiting.awaitingFlightCount)} awaiting confirmation, ${formatNumber(locale, waiting.draftRowCount)} draft rows to review`) : formatCount(locale, whole, FORMS)
  return <Link href="/journal?queue=awaiting" className="queue-summary" aria-label={label} title={label}>{formatNumber(locale, whole)}</Link>
}
