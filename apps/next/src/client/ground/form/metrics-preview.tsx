'use client'

import { useMemo } from 'react'
import { journeyMetrics } from '@kuuki/shared/groundTravel'
import { formatCount, type Locale } from '../../../lib/format'
import { approxDistance, coverageNote, knownDuration } from '../format'
import { previewInput, type FormState } from './model'

const CITIES = {
  en: { one: '{count} city', other: '{count} cities' },
  ru: {
    one: '{count} город',
    few: '{count} города',
    many: '{count} городов',
    other: '{count} города',
  },
}

/** "of N segments": after «из» the Russian count takes the genitive, so 21 is «21 отрезка». */
const SEGMENTS_OF = {
  en: { one: '{count} segment', other: '{count} segments' },
  ru: {
    one: '{count} отрезка',
    few: '{count} отрезков',
    many: '{count} отрезков',
    other: '{count} отрезков',
  },
}

/** Straight-line sums from the places chosen so far. Unknown is a sentence, never a zero or a partial total. */
export function MetricsPreview({ state, locale }: { state: FormState; locale: Locale }) {
  const ru = locale === 'ru'
  const metrics = useMemo(() => {
    const input = previewInput(state)
    return input ? journeyMetrics(input) : null
  }, [state])
  if (!metrics) return null
  const { distanceKm, distanceCoverage } = metrics
  const complete =
    state.mode === 'rail'
      ? state.legs.every((leg) => leg.from && leg.to)
      : state.points.every((point) => point.place)
  return (
    <dl className="gt-metrics">
      <div>
        <dt>{ru ? 'Расстояние' : 'Distance'}</dt>
        <dd>
          {distanceKm !== null && complete ? (
            <>
              {approxDistance(locale, distanceKm)}
              <span className="gt-muted">
                {ru ? ' по прямой между городами' : ' in a straight line between cities'}
              </span>
            </>
          ) : (
            <>
              {ru ? 'Неизвестно' : 'Unknown'}
              <span className="gt-muted">
                {complete
                  ? ru
                    ? ` — координаты есть у ${distanceCoverage.known} из ${formatCount(locale, distanceCoverage.total, SEGMENTS_OF)}`
                    : ` — ${distanceCoverage.known} of ${formatCount(locale, distanceCoverage.total, SEGMENTS_OF)} have coordinates`
                  : ru
                    ? ' — выбраны не все места'
                    : ' — not every place is chosen yet'}
              </span>
            </>
          )}
        </dd>
      </div>
      {state.mode === 'rail' && metrics.trainMinutesCoverage && (
        <div>
          <dt>{ru ? 'Время в поезде' : 'Time on trains'}</dt>
          <dd>
            {knownDuration(locale, metrics.trainMinutes)}
            {coverageNote(locale, metrics.trainMinutesCoverage) && (
              <span className="gt-muted">
                {' '}
                — {coverageNote(locale, metrics.trainMinutesCoverage)}
              </span>
            )}
          </dd>
        </div>
      )}
      {state.mode === 'road' && metrics.uniqueCities !== null && (
        <div>
          <dt>{ru ? 'Уникальные города' : 'Unique cities'}</dt>
          <dd>{formatCount(locale, metrics.uniqueCities, CITIES)}</dd>
        </div>
      )}
    </dl>
  )
}
