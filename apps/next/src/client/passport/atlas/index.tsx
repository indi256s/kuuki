'use client'

import { lazy, Suspense, useMemo, useState } from 'react'
import { formatCount, type Locale } from '../../../lib/format'
import type { PassportEntry } from '../model'
import './atlas.css'

export type PassportAtlasProps = {
  locale: Locale
  /** The filtered visible collection: the same countries, in the same filter state, as the cards. */
  entries: PassportEntry[]
  /** Owner-only pending countries, drawn distinctly; always empty for visitors. */
  pending: PassportEntry[]
  owner: boolean
  name: (code: string) => string
  /** Opens the shared country sheet (`?country=`), for visited and unvisited countries alike. */
  onSelectCountry: (code: string) => void
}

// The MapLibre island (~0.5 MB) is fetched only when the map view is shown; until it is ready, and whenever
// WebGL, the worker or the geometry fails, the accessible list below stands in for it.
const AtlasMap = lazy(() => import('./map'))

const COUNT = {
  en: { one: '{count} country on the map', other: '{count} countries on the map' },
  ru: {
    one: '{count} страна на карте',
    few: '{count} страны на карте',
    many: '{count} стран на карте',
    other: '{count} страны на карте',
  },
}

const COPY = {
  en: {
    map: 'Map of visited countries',
    list: 'Countries on the map',
    unavailable: 'Map unavailable. The countries are listed below.',
    pending: 'pending',
  },
  ru: {
    map: 'Карта посещённых стран',
    list: 'Страны на карте',
    unavailable: 'Карта недоступна. Страны перечислены ниже.',
    pending: 'ждёт подтверждения',
  },
} as const

/** Flat atlas of the Passport: an interactive map over the same filtered collection as the cards. */
export function PassportAtlas({
  locale,
  entries,
  pending,
  name,
  onSelectCountry,
}: PassportAtlasProps) {
  const [failed, setFailed] = useState(false)
  const copy = COPY[locale]
  const visitedCodes = useMemo(() => entries.map((entry) => entry.code), [entries])
  const pendingCodes = useMemo(() => pending.map((entry) => entry.code), [pending])
  return (
    <div className="passport-atlas">
      <section aria-label={copy.map} className="passport-atlas-map">
        {failed ? (
          <p role="status" className="passport-atlas-note">
            {copy.unavailable}
          </p>
        ) : (
          <Suspense fallback={<div className="passport-atlas-canvas" aria-hidden="true" />}>
            <AtlasMap
              locale={locale}
              entries={visitedCodes}
              pending={pendingCodes}
              name={name}
              onSelectCountry={onSelectCountry}
              fail={() => setFailed(true)}
            />
          </Suspense>
        )}
      </section>
      <div className="passport-atlas-countries">
        <h3 className="passport-atlas-count">
          {formatCount(locale, entries.length + pending.length, COUNT)}
        </h3>
        <ul aria-label={copy.list} className="passport-atlas-list">
          {entries.map((entry) => (
            <li key={entry.code}>
              <button type="button" onClick={() => onSelectCountry(entry.code)}>
                {name(entry.code)}
              </button>
            </li>
          ))}
          {pending.map((entry) => (
            <li key={entry.code}>
              <button type="button" onClick={() => onSelectCountry(entry.code)}>
                {name(entry.code)} · {copy.pending}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
