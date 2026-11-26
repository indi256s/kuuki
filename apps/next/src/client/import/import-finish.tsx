'use client'

import { useEffect, useRef } from 'react'
import { formatDistanceKm, formatNumber, type Locale } from '../../lib/format'
import { NavigationLink as Link } from '../navigation-link'
import { countryNamer } from '../passport/model'
import { Button } from '../ui/button'
import { SplitFlap } from '../ui/split-flap'
import { count, S } from './copy'
import { R, rcount } from './route-copy'
import { MAX_STAMPS, StampSection, type NewStamp } from './stamp-section'

export interface Finish {
  id: string
  flights: number
  km: number
  land: number
  firstFlightId: number | null
  touched: string[]
  before: ReadonlySet<string> | null
  stamps: string[] | null
}

export function ImportFinish({
  locale,
  finish,
  publication,
  remaining,
  onReview,
}: {
  locale: Locale
  finish: Finish
  publication: 'idle' | 'ready' | 'pending' | 'delayed'
  remaining: number
  onReview: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const name = countryNamer(locale)
  const stamps = (finish.stamps ?? []).map((code): NewStamp => ({
    code,
    name: name(code),
    eventId: `import:${finish.id}:${code}`,
  }))
  const hero = stamps.length > 0 && stamps.length <= MAX_STAMPS
  const lead = finish.flights > 0 ? finish.flights : finish.land
  const summary = [
    finish.km > 0 ? formatDistanceKm(locale, Math.round(finish.km)) : null,
    finish.flights > 0 && finish.land > 0 ? rcount(locale, 'landTrips', finish.land) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="import-done import-finish" aria-labelledby="import-finish-title">
      <h2 id="import-finish-title" ref={heading} tabIndex={-1} className="sr-only">
        {R.finished[locale]}
      </h2>
      <p className="import-hero import-finish-hero">
        <SplitFlap
          className="import-hero-count history-hero-flaps"
          value={formatNumber(locale, lead)}
          entering
        />{' '}
        <span className="import-hero-label">
          {finish.flights > 0
            ? count(locale, 'flightsAdded', finish.flights)
            : rcount(locale, 'landAdded', finish.land)}
        </span>
      </p>
      {summary ? <p className="import-done-summary">{summary}</p> : null}
      <StampSection
        locale={locale}
        publication={finish.stamps === null ? publication : 'idle'}
        stamps={stamps}
        hero={hero}
      />
      <div className="import-actions import-final-actions">
        <Link
          className="ui-button"
          data-variant="primary"
          href={finish.firstFlightId ? `/journal?flight=${finish.firstFlightId}` : '/journal'}
        >
          {R.openJournal[locale]}
        </Link>
        <Link
          className="ui-button"
          data-variant="secondary"
          href="/passport"
          prefetch={hero ? true : undefined}
        >
          {S.passport[locale]}
        </Link>
      </div>
      {remaining > 0 ? (
        <div className="import-remaining">
          <Button variant="ghost" className="import-text-action import-each" onClick={onReview}>
            {count(locale, 'stillInReview', remaining)}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
