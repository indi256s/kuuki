'use client'

import { formatNumber, type Locale } from '../../lib/format'
import Link from 'next/link'
import { CountryStamp } from '../stamps'
import { S } from './copy'

export interface NewStamp {
  code: string
  name: string
  firstYear?: number
  eventId: string
}

export const MAX_STAMPS = 8
const STAMP_SIZE = 104

export function StampSection({
  locale,
  publication,
  stamps,
  hero,
}: {
  locale: Locale
  publication: 'idle' | 'ready' | 'pending' | 'delayed'
  stamps: NewStamp[]
  hero: boolean
}) {
  const shown = stamps.slice(0, MAX_STAMPS)
  const shortNames = new Intl.DisplayNames([locale], { type: 'region', style: 'short' })
  const shortName = ({ code, name }: NewStamp) => {
    const short = name.length > 14 ? shortNames.of(code) : undefined
    return short && short.length < name.length ? short : name
  }
  return (
    <>
      {publication === 'pending' ? (
        <p className="import-hint" role="status">
          {S.stampsWaiting[locale]}
        </p>
      ) : null}
      {publication === 'delayed' ? (
        <p className="import-hint" role="status">
          {S.stampsDelayed[locale]}
        </p>
      ) : null}

      {shown.length > 0 ? (
        <div className="import-stamps">
          <h3>
            {S.newCountries[locale]}
            {stamps.length > shown.length ? (
              <span className="import-stamps-count"> · {formatNumber(locale, stamps.length)}</span>
            ) : null}
          </h3>
          <ul className="import-stamp-grid">
            {shown.map((stamp) => (
              <li key={stamp.code} className="import-stamp">
                <span data-hero-exit-key={hero ? stamp.code : undefined}>
                  <CountryStamp
                    iso2={stamp.code}
                    status="inked"
                    size={STAMP_SIZE}
                    impressionId={stamp.eventId}
                  />
                </span>
                <span className="import-stamp-name">{shortName(stamp)}</span>
              </li>
            ))}
          </ul>
          {stamps.length > shown.length ? (
            <Link className="ui-button import-stamps-more" data-variant="ghost" href="/passport">
              {S.moreStamps[locale].replace(
                '{count}',
                formatNumber(locale, stamps.length - shown.length),
              )}
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
