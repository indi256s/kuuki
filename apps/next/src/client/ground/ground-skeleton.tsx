import { Fragment } from 'react'
import type { Locale } from '../../lib/format'
import { JournalHeading, JournalSections } from '../journal-sections'
import { copy } from './copy'
import './ground.css'

// Static placeholders at the final card size, with a totals block before the last card (where history starts).
// The h1 is real so RouteFocus has a heading to land on; no motion.
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
          <Fragment key={index}>
            {index === Math.max(1, cards - 1) && (
              <div className="gt-totals gt-skeleton-totals">
                {bar('is-meta')}
                {bar('is-meta')}
              </div>
            )}
            <div className="gt-card gt-skeleton-card">
              {bar('is-title')}
              {bar('is-meta')}
              {bar('is-facts')}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export function GroundSkeleton({ locale, cards = 3 }: { locale: Locale; cards?: number }) {
  return (
    <div className="gt-page">
      <header className="gt-header">
        <JournalHeading locale={locale} section="ground" />
        <JournalSections locale={locale} section="ground" />
      </header>
      <GroundListSkeleton locale={locale} cards={cards} toolbar />
    </div>
  )
}

/** The form's placeholder: a title bar (only where the page has no real heading yet) and three section blocks. */
export function GroundFormSkeleton({ label, title = false }: { label: string; title?: boolean }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="gt-form-skeleton" aria-hidden="true">
        {title && bar('is-form-title')}
        {Array.from({ length: 3 }, (_, index) => (
          <div className="gt-form-skeleton-section" key={index}>
            {bar('is-section-title')}
            {bar('is-block')}
          </div>
        ))}
      </div>
    </div>
  )
}
