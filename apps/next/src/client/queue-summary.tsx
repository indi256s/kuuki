'use client'

import { ClipboardCheck } from '@keyline-icons/react'
import { useAwaiting } from './awaiting'
import { NavigationLink as Link } from './navigation-link'
import { formatCount, formatNumber, type Locale } from '../lib/format'
import { MenuItem } from './ui/menu'
import type { ReactNode } from 'react'

const QUEUE_HREF = '/journal?queue=awaiting'
const FLIGHTS = {
  en: {
    one: '{count} flight awaiting confirmation',
    other: '{count} flights awaiting confirmation',
  },
  ru: {
    one: '{count} перелёт ждёт подтверждения',
    few: '{count} перелёта ждут подтверждения',
    many: '{count} перелётов ждут подтверждения',
    other: '{count} перелёта ждут подтверждения',
  },
}
const ROWS = {
  en: { one: '{count} draft row to review', other: '{count} draft rows to review' },
  ru: {
    one: '{count} строка для проверки',
    few: '{count} строки для проверки',
    many: '{count} строк для проверки',
    other: '{count} строки для проверки',
  },
}
const LABEL = { en: 'To review', ru: 'На проверку' }
const UNAVAILABLE = { en: 'Unavailable', ru: 'Недоступно' }

/**
 * Menu row for the confirmation queue. Hides a zero count; an initial transport failure has an explicit
 * unavailable state unless `showUnavailable` is off. C4 supplies actionableCount; transport failures remain unknown
 * rather than empty. The accessible name starts with the visible label. `field` draws it as a field on the account
 * menu's stub: the label above the count, no icon.
 */
export function QueueMenuItem({
  count,
  locale = 'en',
  showUnavailable = true,
  field,
}: {
  count?: number | null
  locale?: Locale
  showUnavailable?: boolean
  field?: boolean
}) {
  const queue = useAwaiting()
  const waiting = queue.data
  count ??= waiting?.actionableCount
  const batches = (waiting?.drafts ?? []).filter((draft) => draft.reviewRowCount > 0)
  const href =
    waiting?.awaitingFlightCount === 0 && waiting.draftRowCount > 0
      ? batches.length === 1
        ? `/import?batch=${encodeURIComponent(batches[0]!.batchId)}`
        : '/import'
      : QUEUE_HREF
  const label = LABEL[locale]
  const lang = locale === 'ru' ? 'ru' : undefined
  const row = (trailing: ReactNode, name?: string) => (
    <MenuItem asChild>
      <Link href={href} aria-label={name}>
        {field ? (
          <>
            <span className="account-field-key" lang={lang}>
              {label}
            </span>
            <span className="account-field-value">{trailing}</span>
          </>
        ) : (
          <>
            <ClipboardCheck size={20} strokeWidth={2} aria-hidden="true" />
            <span className="queue-label" lang={lang}>
              {label}
            </span>
            {trailing}
          </>
        )}
      </Link>
    </MenuItem>
  )
  if (queue.error && !waiting && count == null)
    return showUnavailable
      ? row(
          <span className="queue-unavailable" lang={lang}>
            {UNAVAILABLE[locale]}
          </span>,
        )
      : null
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) return null
  const whole = Math.floor(count)
  const parts = waiting
    ? ([
        [waiting.awaitingFlightCount, FLIGHTS],
        [waiting.draftRowCount, ROWS],
      ] as const)
    : []
  const detail =
    parts
      .filter(([n]) => n > 0)
      .map(([n, forms]) => formatCount(locale, n, forms))
      .join(', ') || formatNumber(locale, whole)
  return row(
    field ? (
      formatNumber(locale, whole)
    ) : (
      <span className="queue-count">{formatNumber(locale, whole)}</span>
    ),
    `${label}: ${detail}`,
  )
}
