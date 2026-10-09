import type { Locale } from '../../lib/format'
import './ledger-skeleton.css'

// Static placeholder in the final ledger layout (lanes: Date 96, Route 204, Airline 182, Aircraft 152, Duration 90, Distance 98, action 44, 8px gaps, 72px rows;
// cards at 700px and below). No shimmer: loading has no motion. The h1 is real so RouteFocus has a heading to land on.

const copy = {
  en: { title: 'Journal', loading: 'Loading journal…' },
  ru: { title: 'Журнал', loading: 'Загружаем журнал…' },
} as const

const bar = (className: string) => <span className={`ledger-skeleton-bar ${className}`} />

export function LedgerSkeleton({ locale, rows = 8 }: { locale: Locale; rows?: number }) {
  const t = copy[locale]
  return (
    <div className="ledger-skeleton">
      <h1>{t.title}</h1>
      <div role="status" aria-busy="true">
        <span className="sr-only">{t.loading}</span>
        <div aria-hidden="true">
          <div className="ledger-skeleton-summary">{bar('is-summary')}</div>
          <div className="ledger-skeleton-toolbar">
            {bar('is-search')}
            {bar('is-chip')}
            {bar('is-chip')}
            {bar('is-chip')}
          </div>
          <div className="ledger-skeleton-rows">
            {Array.from({ length: rows }, (_, index) => (
              <div className="ledger-skeleton-row" key={index}>
                <div className="ledger-skeleton-date">
                  {bar('is-text')}
                  {bar('is-badge')}
                </div>
                <div className="ledger-skeleton-route">
                  {bar('is-code')}
                  {bar('is-small')}
                </div>
                <div className="ledger-skeleton-airline">
                  {bar('is-text')}
                  {bar('is-small')}
                </div>
                <div className="ledger-skeleton-aircraft">{bar('is-text')}</div>
                <div className="ledger-skeleton-duration">{bar('is-text')}</div>
                <div className="ledger-skeleton-distance">{bar('is-text')}</div>
                <div className="ledger-skeleton-action" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
