'use client'
// Per-mode totals of COMPLETED journeys. Distances are straight-line approximations ("≈"); a total built from only
// some journeys says so (coverage note). Missing optional measures are omitted, never shown as zero.

import { useId } from 'react'
import { Car, Train } from '@keyline-icons/react'
import type { ModeTotals } from '@kuuki/shared/groundTravel'
import { formatCount, type Locale } from '../../lib/format'
import { approxDistance, coverageNote, knownDuration } from './format'
import { cities, copy, journeys } from './copy'

type Mode = 'rail' | 'road'

function Line({ locale, mode, totals }: { locale: Locale; mode: Mode; totals: ModeTotals }) {
  const t = copy[locale]
  const name = mode === 'rail' ? t.totalsRail : t.totalsRoad
  const Icon = mode === 'rail' ? Train : Car
  const distanceKnown = totals.distanceCoverage.known > 0
  const distanceNote = coverageNote(locale, totals.distanceCoverage)
  const trainNote = coverageNote(locale, totals.trainMinutesCoverage)
  return (
    <li className="gt-totals-line">
      <p className="gt-mode">
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
        {name}
      </p>
      <p className="gt-totals-values">
        <span>{formatCount(locale, totals.journeys, journeys)}</span>
        {distanceKnown && (
          <span>
            {approxDistance(locale, totals.distanceKm)}
            {distanceNote && <small> ({distanceNote})</small>}
          </span>
        )}
        {mode === 'rail' && totals.trainMinutes !== null && (
          <span>
            {knownDuration(locale, totals.trainMinutes)}
            {trainNote && <small> ({trainNote})</small>}
          </span>
        )}
        {mode === 'road' && totals.uniqueCities !== null && (
          <span>{formatCount(locale, totals.uniqueCities, cities)}</span>
        )}
      </p>
    </li>
  )
}

/** Completed modes only; optional missing facts remain available in journey details. */
export function GroundTotals({
  locale,
  totals,
  mode,
}: {
  locale: Locale
  totals: { rail: ModeTotals; road: ModeTotals }
  mode: Mode | null
}) {
  const t = copy[locale]
  const headingId = useId()
  const showRail = mode !== 'road' && totals.rail.journeys > 0
  const showRoad = mode !== 'rail' && totals.road.journeys > 0
  if (!showRail && !showRoad) return null
  return (
    <div className="gt-totals">
      <h2 id={headingId} className="sr-only">
        {t.totalsLabel}
      </h2>
      <ul className="gt-totals-lines" aria-labelledby={headingId}>
        {showRail && <Line locale={locale} mode="rail" totals={totals.rail} />}
        {showRoad && <Line locale={locale} mode="road" totals={totals.road} />}
      </ul>
      {((showRail && totals.rail.distanceCoverage.known > 0) ||
        (showRoad && totals.road.distanceCoverage.known > 0)) && (
        <p className="gt-note">{t.straightLine}</p>
      )}
    </div>
  )
}
