'use client'

import { useAwaiting } from './awaiting'
import Link from 'next/link'
import { announceJournalLink } from './journal-links'
import { formatCount, formatNumber, type Locale } from '../lib/format'

const QUEUE_HREF = '/journal?queue=awaiting'
const FLIGHTS = {
  en: { one: '{count} flight awaiting confirmation', other: '{count} flights awaiting confirmation' },
  ru: { one: '{count} перелёт ждёт подтверждения', few: '{count} перелёта ждут подтверждения', many: '{count} перелётов ждут подтверждения', other: '{count} перелёта ждут подтверждения' },
}
const ROWS = {
  en: { one: '{count} draft row to review', other: '{count} draft rows to review' },
  ru: { one: '{count} строка для проверки', few: '{count} строки для проверки', many: '{count} строк для проверки', other: '{count} строки для проверки' },
}
const TOTAL = {
  en: { one: '{count} awaiting action', other: '{count} awaiting action' },
  ru: { one: '{count} в очереди', few: '{count} в очереди', many: '{count} в очереди', other: '{count} в очереди' },
}

/**
 * Header slot for the confirmation queue. Hides a zero count; an initial transport failure has an explicit unavailable state.
 * C4 supplies actionableCount; transport failures remain unknown rather than empty.
 */
export function QueueSummarySlot({ count, locale = 'en' }: { count?: number | null; locale?: Locale }) {
  const queue = useAwaiting()
  const waiting = queue.data
  count ??= waiting?.actionableCount
  if (queue.error && !waiting && count == null) return <Link href={QUEUE_HREF} onNavigate={announceJournalLink(QUEUE_HREF)} className="queue-summary">{locale === 'ru' ? 'Очередь недоступна' : 'Queue unavailable'}</Link>
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) return null
  const whole = Math.floor(count)
  const parts = waiting ? [[waiting.awaitingFlightCount, FLIGHTS], [waiting.draftRowCount, ROWS]] as const : []
  const detail = parts.filter(([n]) => n > 0).map(([n, forms]) => formatCount(locale, n, forms)).join(', ')
  const total = formatCount(locale, whole, TOTAL)
  const label = detail ? `${total}: ${detail}` : total
  return <Link href={QUEUE_HREF} onNavigate={announceJournalLink(QUEUE_HREF)} className="queue-summary" aria-label={label} title={label}>{formatNumber(locale, whole)}</Link>
}
