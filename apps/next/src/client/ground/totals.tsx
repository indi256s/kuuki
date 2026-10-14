'use client'
// Per-mode totals of COMPLETED journeys. Distances are straight-line approximations ("≈"); a total built from only
// some journeys says so (coverage note) and a total with nothing known is the word, never 0.

import type { ModeTotals } from '@kuuki/shared/groundTravel'
import { formatCount, type Locale } from '../../lib/format'
import { approxDistance, coverageNote, knownDuration, unknownText } from './format'
import { cities, copy, journeys } from './copy'

type Mode = 'rail' | 'road'

function Block({ locale, mode, totals }: { locale: Locale; mode: Mode; totals: ModeTotals }) {
  const t = copy[locale]
  const heading = mode === 'rail' ? t.totalsRail : t.totalsRoad
  const distanceKnown = totals.distanceCoverage.known > 0
  const distanceNote = coverageNote(locale, totals.distanceCoverage)
  const trainNote = coverageNote(locale, totals.trainMinutesCoverage)
  return (
    <section className="gt-totals-block" aria-label={heading}>
      <h2 className="gt-totals-title">{heading}</h2>
      {totals.journeys === 0 ? (
        <p className="gt-totals-none">{t.totalsNone}</p>
      ) : (
        <dl className="gt-totals-list">
          <div>
            <dt>{t.completed}</dt>
            <dd>{formatCount(locale, totals.journeys, journeys)}</dd>
          </div>
          <div>
            <dt>{t.distance}</dt>
            <dd>
              {approxDistance(locale, distanceKnown ? totals.distanceKm : null)}
              {distanceKnown && distanceNote && <small>{distanceNote}</small>}
            </dd>
          </div>
          {mode === 'rail' ? (
            <div>
              <dt>{t.onTrains}</dt>
              <dd>
                {knownDuration(locale, totals.trainMinutes)}
                {totals.trainMinutes !== null && trainNote && <small>{trainNote}</small>}
              </dd>
            </div>
          ) : (
            <div>
              <dt>{t.uniqueCities}</dt>
              <dd>
                {totals.uniqueCities === null
                  ? unknownText(locale)
                  : formatCount(locale, totals.uniqueCities, cities)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}

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
  return (
    <section className="gt-totals" aria-label={t.totalsLabel}>
      {mode !== 'road' && <Block locale={locale} mode="rail" totals={totals.rail} />}
      {mode !== 'rail' && <Block locale={locale} mode="road" totals={totals.road} />}
      <p className="gt-note">{t.straightLine}</p>
    </section>
  )
}
