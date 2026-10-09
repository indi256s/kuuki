'use client'

import Link from 'next/link'
import {
  formatCount,
  formatDistanceKm,
  formatDurationDays,
  formatNumber,
  type CountForms,
  type Locale,
} from '../../lib/format'
import { Button } from '../ui/button'
import { SlotText } from '../ui/slot-text'
import type { JournalSummary } from './filter'
import './header.css'

// The summary follows the filters. Flights count every flight shown; distance and time are confirmed-only, and the line says so.

const flights: CountForms = {
  en: { one: 'flight', other: 'flights' },
  ru: { one: 'перелёт', few: 'перелёта', many: 'перелётов', other: 'перелёта' },
}
const toConfirm: CountForms = {
  en: { one: '{count} to confirm', other: '{count} to confirm' },
  ru: {
    one: '{count} нужно подтвердить',
    few: '{count} нужно подтвердить',
    many: '{count} нужно подтвердить',
    other: '{count} нужно подтвердить',
  },
}
const imports: CountForms = {
  en: { one: '{count} import to review', other: '{count} imports to review' },
  ru: {
    one: '{count} импорт ждёт проверки',
    few: '{count} импорта ждут проверки',
    many: '{count} импортов ждут проверки',
    other: '{count} импорта ждут проверки',
  },
}

const copy = {
  en: { title: 'Journal', inTheAir: 'in the air', confirmedOnly: '(confirmed flights only)' },
  ru: { title: 'Журнал', inTheAir: 'в воздухе', confirmedOnly: '(только подтверждённые)' },
} as const

export type JournalHeaderProps = {
  locale: Locale
  summary: JournalSummary
  /** Every awaiting flight, ignoring filters. The pill is hidden at zero. */
  awaitingCount: number
  /** Open import batches that need review. The link is hidden at zero. */
  importReviewCount: number
  onReview: () => void
  importHref: string
}

export function JournalHeader({
  locale,
  summary,
  awaitingCount,
  importReviewCount,
  onReview,
  importHref,
}: JournalHeaderProps) {
  const t = copy[locale]
  return (
    <header className="journal-header">
      <div className="journal-header-row">
        <h1>{t.title}</h1>
        {(awaitingCount > 0 || importReviewCount > 0) && (
          <div className="journal-header-actions">
            {importReviewCount > 0 && (
              <Link href={importHref} className="journal-import-link">
                {formatCount(locale, importReviewCount, imports)}
              </Link>
            )}
            {awaitingCount > 0 && (
              <Button variant="secondary" dense className="journal-review-pill" onClick={onReview}>
                {formatCount(locale, awaitingCount, toConfirm)}
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="journal-summary">
        <span>
          <SlotText value={summary.flights} format={(count) => formatNumber(locale, count)} />{' '}
          <span>{formatCount(locale, summary.flights, flights)}</span>
        </span>
        <span className="journal-summary-sep" aria-hidden="true">
          {' '}
          ·{' '}
        </span>
        <SlotText value={summary.distanceKm} format={(km) => formatDistanceKm(locale, km)} />
        <span className="journal-summary-sep" aria-hidden="true">
          {' '}
          ·{' '}
        </span>
        <span>
          <SlotText value={formatDurationDays(locale, summary.durationMinutes)} align="end" />{' '}
          {t.inTheAir}
        </span>{' '}
        <span className="journal-summary-note">{t.confirmedOnly}</span>
      </p>
    </header>
  )
}
