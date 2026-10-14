'use client'

import type { Locale } from '../../../lib/format'
import type { PassportEntry } from '../model'

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

/** Flat atlas of the Passport (W3). Until it lands, the accessible list stands in for the map. */
export function PassportAtlas({ locale, entries, name, onSelectCountry }: PassportAtlasProps) {
  return (
    <ul aria-label={locale === 'ru' ? 'Страны на карте' : 'Countries on the map'}>
      {entries.map((entry) => (
        <li key={entry.code}>
          <button type="button" onClick={() => onSelectCountry(entry.code)}>
            {name(entry.code)}
          </button>
        </li>
      ))}
    </ul>
  )
}
