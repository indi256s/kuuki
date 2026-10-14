'use client'

import { useId } from 'react'
import { Check } from '@keyline-icons/react'
import { formatCount, formatNumber } from '../../../lib/format'
import { BUCKET_TOKENS, visitBucket } from '../../../lib/map-buckets'
import { forms, S, t } from '../copy'
import { useOverview } from '../store/overview-context'

const copy = {
  note: {
    en: 'One visit per flight in each country.',
    ru: 'Одно посещение на перелёт в каждой стране.',
  },
}

/** The globe's key on wide Overview bands: the map's countries by visits, each with its legend bucket swatch. A row toggles that country's filter. */
export function CountryList() {
  const { scope, filter, locale, actions } = useOverview()
  const heading = useId()
  if (!scope) return null
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  const countries = scope.globe.countries
  return (
    <section className="ov3-hero globe-country-card" aria-labelledby={heading}>
      <div>
        <h2 id={heading}>{t(S.legend, locale)}</h2>
      </div>
      {/* The list scrolls inside what the band leaves; it is out of flow so the globe and figures set the band's height. */}
      <div className="globe-country-slot">
        <div className="globe-country-fill">
          {/* Fades at the ends say the list scrolls (scroll-state queries in globe.css); browsers without them show none. */}
          <div className="globe-country-fade" data-edge="top" aria-hidden="true" />
          {!countries.length ? (
            <p className="globe-country-note">{t(S.noCountries, locale)}</p>
          ) : (
            <ol className="globe-country-list">
              {countries.map(({ code, visits }) => {
                const name = names.of(code) ?? code
                const active = filter.countries?.includes(code) ?? false
                return (
                  <li key={code}>
                    <button
                      type="button"
                      className="globe-country-row"
                      aria-pressed={active}
                      aria-label={`${name}, ${formatCount(locale, visits, forms.visits)}`}
                      onClick={() =>
                        active ? actions.remove('countries', code) : actions.add('countries', code)
                      }
                    >
                      <span
                        className="globe-country-swatch"
                        aria-hidden="true"
                        style={{ background: `var(${BUCKET_TOKENS[visitBucket(visits)]})` }}
                      />
                      <span className="globe-country-name">{name}</span>
                      {active ? (
                        <Check
                          className="globe-country-check"
                          size={16}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="globe-country-count" aria-hidden="true">
                        {formatNumber(locale, visits)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
          <div className="globe-country-fade" data-edge="bottom" aria-hidden="true" />
        </div>
      </div>
      {countries.length ? <p className="globe-country-note">{t(copy.note, locale)}</p> : null}
    </section>
  )
}
