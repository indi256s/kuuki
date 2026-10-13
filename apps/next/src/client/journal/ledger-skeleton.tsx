import type { Locale } from '../../lib/format'
import { FilterToolbar } from '../ui/filter-toolbar'
import './header.css'
import './journal-page.css'
import './ledger-skeleton.css'

// Static placeholders share the base Journal rhythm. Optional review notices and Next up depend on the data.
// The h1 is real so RouteFocus has a heading to land on; loading has no motion.

const copy = {
  en: { title: 'Journal', loading: 'Loading journal…' },
  ru: { title: 'Журнал', loading: 'Загружаем журнал…' },
} as const

const bar = (className: string) => <span className={`ledger-skeleton-bar ${className}`} />

export function LedgerSkeleton({ locale, rows = 8 }: { locale: Locale; rows?: number }) {
  const t = copy[locale]
  return (
    <div className="ledger-skeleton journal-page">
      <header className="journal-header">
        <div className="journal-header-row">
          <h1>{t.title}</h1>
        </div>
        <div className="ledger-skeleton-summary" aria-hidden="true">
          {bar('is-summary')}
        </div>
      </header>
      <div role="status" aria-busy="true">
        <span className="sr-only">{t.loading}</span>
        <div className="ledger-skeleton-content" aria-hidden="true">
          <FilterToolbar
            label={t.loading}
            className="ledger-skeleton-toolbar"
            search={bar('is-search')}
            actions={
              <>
                {bar('is-mobile-filter')}
                {bar('is-more')}
              </>
            }
          >
            <div className="ui-chip-group ledger-skeleton-chips">
              {bar('is-chip')}
              {bar('is-chip')}
              {bar('is-chip')}
              {bar('is-chip')}
            </div>
          </FilterToolbar>
          <div className="ledger-skeleton-rows">
            <div className="ledger-skeleton-head">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index}>{bar('is-text')}</span>
              ))}
            </div>
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
