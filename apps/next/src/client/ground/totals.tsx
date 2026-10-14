'use client'
// Per-mode totals of COMPLETED journeys. Distances are straight-line approximations ("≈"); a total built from only
// some journeys says so (coverage note) and a total with nothing known is the word, never 0.

import { useId } from 'react'
import type { ModeTotals } from '@kuuki/shared/groundTravel'
import { formatCount, type Locale } from '../../lib/format'
import { approxDistance, coverageNote, knownDuration } from './format'
import { cities, copy, journeys } from './copy'

type Mode = 'rail' | 'road'

function Line({ locale, mode, totals }: { locale: Locale; mode: Mode; totals: ModeTotals }) {
  const t = copy[locale]
  const name = mode === 'rail' ? t.totalsRail : t.totalsRoad
  if (totals.journeys === 0)
    return (
      <li className="gt-totals-line">
        <strong>{name}</strong> · {t.totalsNone}
      </li>
    )
  const distanceKnown = totals.distanceCoverage.known > 0
  const distanceNote = coverageNote(locale, totals.distanceCoverage)
  const trainNote = coverageNote(locale, totals.trainMinutesCoverage)
  return (
    <li className="gt-totals-line">
      <strong>{name}</strong> · {formatCount(locale, totals.journeys, journeys)} ·{' '}
      {distanceKnown ? approxDistance(locale, totals.distanceKm) : t.distanceUnknown}
      {distanceKnown && distanceNote && <small> ({distanceNote})</small>}
      {mode === 'rail' ? (
        <>
          {' · '}
          {totals.trainMinutes === null
            ? t.timeUnknown
            : knownDuration(locale, totals.trainMinutes)}
          {totals.trainMinutes !== null && trainNote && <small> ({trainNote})</small>}
        </>
      ) : (
        <>
          {' · '}
          {totals.uniqueCities === null
            ? t.citiesUnknown
            : formatCount(locale, totals.uniqueCities, cities)}
        </>
      )}
    </li>
  )
}

/** One line per mode. The heading is for assistive technology only: the lines say what they are. */
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
  return (
    <div className="gt-totals">
      <h2 id={headingId} className="sr-only">
        {t.totalsLabel}
      </h2>
      <ul className="gt-totals-lines" aria-labelledby={headingId}>
        {mode !== 'road' && <Line locale={locale} mode="rail" totals={totals.rail} />}
        {mode !== 'rail' && <Line locale={locale} mode="road" totals={totals.road} />}
      </ul>
      <p className="gt-note">{t.straightLine}</p>
    </div>
  )
}
