import type { Locale } from '../../lib/format'
import { copy } from './copy'
import './ground.css'

// Static placeholders at the final card size. The h1 is real so RouteFocus has a heading to land on; no motion.
const bar = (className: string) => <span className={`gt-skeleton-bar ${className}`} />

/** The list region's placeholder; the page keeps its header, toolbar and detail sheet mounted around it. */
export function GroundListSkeleton({
  locale,
  cards = 3,
  toolbar = false,
}: {
  locale: Locale
  cards?: number
  toolbar?: boolean
}) {
  const t = copy[locale]
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t.loading}</span>
      <div className="gt-skeleton" aria-hidden="true">
        {toolbar && bar('is-toolbar')}
        {Array.from({ length: cards }, (_, index) => (
          <div className="gt-card gt-skeleton-card" key={index}>
            {bar('is-title')}
            {bar('is-meta')}
            {bar('is-facts')}
          </div>
        ))}
      </div>
    </div>
  )
}

export function GroundSkeleton({ locale, cards = 3 }: { locale: Locale; cards?: number }) {
  const t = copy[locale]
  return (
    <div className="gt-page">
      <header className="gt-header">
        <div className="gt-header-row">
          <h1 tabIndex={-1}>{t.title}</h1>
        </div>
      </header>
      <GroundListSkeleton locale={locale} cards={cards} toolbar />
    </div>
  )
}
