import { Fragment } from 'react'
import type { Locale } from '../../lib/format'
import { JournalHeading, JournalSections } from '../journal-sections'
import { copy } from './copy'
import './ground.css'

const bar = (className: string) => <span className={`gt-skeleton-bar ${className}`} />

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
        {[1, Math.max(0, cards - 1)].map((count, group) => (
          <Fragment key={group}>
            {group === 1 && count > 0 && (
              <div className="gt-totals gt-skeleton-totals">{bar('is-meta')}</div>
            )}
            <div className="gt-list">
              {Array.from({ length: count }, (_, index) => (
                <div className="gt-card gt-skeleton-card" key={index}>
                  {bar('is-title')}
                  {bar('is-meta')}
                  {bar('is-facts')}
                </div>
              ))}
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
