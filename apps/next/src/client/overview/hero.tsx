'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { findAirport } from '@kuuki/data/airport-lookup'
import type { OverviewSummary } from '../../../../../packages/shared/src/overview'
import { formatCount, type Locale } from '../../lib/format'
import { useAwaiting, type AwaitingQueue } from '../awaiting'
import { Ticket } from '../signature/ticket'
import { Button } from '../ui/button'
import { S, forms, t } from './copy'
import { countdownLabel, daysUntil, localToday } from './model'

type Awaiting = AwaitingQueue['awaitingFlights'][number]['flight']
const subscribeNever = () => () => {}
const serverToday = (): string | null => null
const city = (iata: string) => ({ iata, city: findAirport(iata)?.city ?? iata })

/** The newest awaiting flight; ties on date go to the later id. */
export const newestAwaiting = (flights: Awaiting[]): Awaiting | null =>
  flights.reduce<Awaiting | null>((best, flight) => !best || flight.date > best.date || (flight.date === best.date && flight.id > best.id) ? flight : best, null)

/**
 * The hero slot: the newest awaiting flight from the queue, else the earliest upcoming flight. It is independent of
 * the selected period. A queue that failed to load is said out loud and never read as an empty queue.
 */
export function OverviewHero({ locale, upcoming }: { locale: Locale; upcoming: OverviewSummary['nextFlight'] }) {
  const queue = useAwaiting()
  // The member's local calendar day is known only in the browser: the server snapshot is null, so the countdown arrives after hydration.
  const today = useSyncExternalStore(subscribeNever, localToday, serverToday)
  const awaiting = newestAwaiting(queue.data?.awaitingFlights.map(entry => entry.flight) ?? [])
  const failed = queue.error && !queue.data
  const heading = <h2 className="sr-only">{t(S.nextFlight, locale)}</h2>

  if (awaiting && queue.data) {
    const others = queue.data.awaitingFlightCount - 1
    return <section className="ov-hero" aria-label={t(S.nextFlight, locale)} data-hero="awaiting">
      <Ticket locale={locale} state="awaiting" origin={city(awaiting.origin)} destination={city(awaiting.destination)} date={awaiting.date}
        flightNumber={awaiting.flight_number ?? undefined} prompt={t(S.arrivedPrompt, locale)}
        actions={<Link className="button primary" href="/journal?queue=awaiting">{t(S.reviewQueue, locale)}</Link>} />
      {others > 0 ? <p className="muted">{t(S.moreWaiting, locale)} {formatCount(locale, others, forms.flights)}.</p> : null}
    </section>
  }
  return <>
    {failed ? <section className="ov-hero" aria-label={t(S.nextFlight, locale)} data-hero="queue-unavailable">{heading}
      <p role="alert" className="status-note">{t(S.queueUnavailable, locale)}</p>
      <Button dense onClick={queue.reload}>{t(S.retry, locale)}</Button></section> : null}
    {upcoming ? <section className="ov-hero" aria-label={t(S.nextFlight, locale)} data-hero="upcoming">
      <Ticket locale={locale} state={today && daysUntil(upcoming.date, today) === 0 ? 'today' : 'upcoming'} origin={city(upcoming.origin)} destination={city(upcoming.destination)}
        date={upcoming.date} flightNumber={upcoming.flightNumber ?? undefined} statusLabel={today ? countdownLabel(locale, daysUntil(upcoming.date, today)) : undefined}
        actions={<Link className="button secondary" href={`/journal/${upcoming.id}/edit`}>{t(S.editFlight, locale)}</Link>} />
    </section> : null}
  </>
}
