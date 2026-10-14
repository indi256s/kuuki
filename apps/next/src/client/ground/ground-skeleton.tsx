import type { Locale } from '../../lib/format'
import { copy } from './copy'
import './ground.css'

// Static placeholders at the final card size. The h1 is real so RouteFocus has a heading to land on; no motion.
const bar = (className: string) => <span className={`gt-skeleton-bar ${className}`} />

export function GroundSkeleton({ locale, cards = 3 }: { locale: Locale; cards?: number }) {
  const t = copy[locale]
  return (
    <div className="gt-page">
      <header className="gt-header">
        <div className="gt-header-row">
          <h1 tabIndex={-1}>{t.title}</h1>
        </div>
      </header>
      <div role="status" aria-busy="true">
        <span className="sr-only">{t.loading}</span>
        <div className="gt-skeleton" aria-hidden="true">
          {bar('is-toolbar')}
          {Array.from({ length: cards }, (_, index) => (
            <div className="gt-card gt-skeleton-card" key={index}>
              {bar('is-title')}
              {bar('is-meta')}
              {bar('is-facts')}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
