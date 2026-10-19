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
import { JournalHeading, JournalSections } from '../journal-sections'
import { Button } from '../ui/button'
import { SlotText } from '../ui/slot-text'
import type { JournalSummary } from './filter'
import './header.css'

const flights: CountForms = {
  en: { one: 'flight', other: 'flights' },
  ru: { one: 'перелёт', few: 'перелёта', many: 'перелётов', other: 'перелёта' },
}
const toConfirm: CountForms = {
  en: { one: 'Confirm {count}', other: 'Confirm {count}' },
  ru: {
    one: 'Подтвердить {count}',
    few: 'Подтвердить {count}',
    many: 'Подтвердить {count}',
    other: 'Подтвердить {count}',
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
  en: { distance: 'Distance', inTheAir: 'In the air' },
  ru: { distance: 'Расстояние', inTheAir: 'В воздухе' },
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
  const distanceUnknown = summary.flights > 0 && summary.distanceMissing === summary.flights
  const durationUnknown = summary.flights > 0 && summary.durationMissing === summary.flights
  const durationCue = summary.durationMissing > 0 ? '≥ ' : ''
  return (
    <header className="journal-header">
      <div className="journal-header-row">
        <JournalHeading locale={locale} section="flights" />
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
      </div>
      <JournalSections locale={locale} section="flights" />
      <dl className="journal-summary">
        <div>
          <dt>{formatCount(locale, summary.flights, flights)}</dt>
          <dd>
            <SlotText value={summary.flights} format={(count) => formatNumber(locale, count)} />
          </dd>
        </div>
        <div>
          <dt>{t.distance}</dt>
          <dd>
            <SlotText
              value={
                distanceUnknown
                  ? '—'
                  : `${summary.distanceMissing > 0 ? '≥ ' : ''}${formatDistanceKm(locale, summary.distanceKm)}`
              }
            />
          </dd>
        </div>
        <div>
          <dt>{t.inTheAir}</dt>
          <dd>
            <SlotText
              value={
                durationUnknown
                  ? '—'
                  : `${durationCue}${formatDurationDays(locale, summary.durationMinutes)}`
              }
            />
          </dd>
        </div>
      </dl>
    </header>
  )
}
