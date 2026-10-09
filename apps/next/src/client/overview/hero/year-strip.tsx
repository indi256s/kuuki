'use client'

import type { CSSProperties } from 'react'
import { formatCount, formatNumber } from '../../../lib/format'
import { forms, S, t } from '../copy'
import { useOverview } from '../store/overview-context'
import './hero.css'

export function YearStrip() {
  const { scope, filter, actions, locale } = useOverview()
  const rows = scope?.figures.byYear ?? []
  const peak = Math.max(0, ...rows.map((row) => row.flights))
  if (!rows.length) return null
  return (
    <div
      className="ov3-years"
      role="group"
      aria-label={locale === 'ru' ? 'Перелёты по годам' : 'Flights per year'}
    >
      <div className="ov3-years-caption">
        {locale === 'ru' ? 'Перелёты по годам' : 'Flights per year'}
      </div>
      <div className="ov3-years-bars">
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            aria-label={`${row.year} · ${formatCount(locale, row.flights, forms.flights)} · ${t(S.period, locale)}`}
            aria-pressed={
              !!filter.period && 'years' in filter.period && filter.period.years.includes(row.year)
            }
            onClick={() => actions.setPeriod({ years: [row.year] })}
          >
            {row.flights > 0 ? (
              <span className="ov3-year-count" aria-hidden="true">
                {formatNumber(locale, row.flights)}
              </span>
            ) : null}
            <span
              className={`ov3-year-mark${row.flights === 0 ? ' empty' : row.flights === peak ? ' peak' : ''}`}
              style={{ '--bar': row.flights === 0 ? 0 : row.flights / peak } as CSSProperties}
              aria-hidden="true"
            />
            <span className="ov3-year-label">
              {"'"}
              {String(row.year).slice(-2)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
