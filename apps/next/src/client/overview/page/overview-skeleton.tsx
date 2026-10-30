'use client'

import { useLocale } from '../../preferences'

import type { Locale } from '../../../lib/format'
import '../../ui/ui.css'
import './page.css'
import './overview-skeleton.css'

// Static placeholders in the page's own bands: the filter row, the figures and the globe at their final boxes, then the country row,
// so the page lands without moving. A booked flight adds its strip above the figures, which the route cannot know yet.
// The h1 is real so RouteFocus has a heading to land on; loading has no motion.
export function OverviewSkeleton({ locale: initialLocale }: { locale: Locale }) {
  const locale = useLocale(initialLocale)
  return (
    <div className="ov3-page" lang={locale}>
      <h1 className="sr-only" tabIndex={-1}>
        {locale === 'ru' ? 'Обзор' : 'Overview'}
      </h1>
      <p role="status" className="sr-only">
        {locale === 'ru' ? 'Загрузка обзора…' : 'Loading overview…'}
      </p>
      <div className="ov3-overview-workspace" aria-hidden="true">
        <div className="ov3-common-controls">
          <div className="ui-skeleton ov3-skeleton-controls" />
        </div>
        <div className="ov3-globe-band">
          <div data-region="figures">
            <div className="ui-skeleton ov3-skeleton-figures" />
          </div>
          <div className="ov3-globe-region">
            <div className="ui-skeleton ov3-skeleton-globe" />
          </div>
        </div>
        <div className="ov3-skeleton-countries">
          <div className="ui-skeleton" />
        </div>
      </div>
    </div>
  )
}
