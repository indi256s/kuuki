import clsx from 'clsx'
import { Check, Plane } from '@keyline-icons/react'
import type { ReactNode } from 'react'
import { formatDateOnly, formatDistanceKm, type Locale } from '../../lib/format'
import './signature.css'

export type TicketState = 'upcoming' | 'today' | 'awaiting' | 'logged'
export type TicketEndpoint = { iata: string; city: string }

export type TicketProps = {
  /** Presentation only: the caller decides the state (no lifecycle logic in here). */
  state: TicketState
  locale: Locale
  origin: TicketEndpoint
  destination: TicketEndpoint
  /** 'YYYY-MM-DD', formatted without time-zone shifts. */
  date: string
  flightNumber?: string
  airline?: string
  distanceKm?: number
  /** Overrides the default chip text, e.g. «Через 12 дней». The countdown is the caller's concern. */
  statusLabel?: string
  /** Question for the awaiting state, e.g. «Вы долетели до Бостона?». */
  prompt?: ReactNode
  /** Lifecycle buttons. Rendered as HTML outside the decorative SVG. */
  actions?: ReactNode
  /** Perforated stub content, e.g. a pressed Stamp for the logged state. */
  stub?: ReactNode
  className?: string
}

const STATUS: Record<TicketState, { en: string; ru: string }> = {
  upcoming: { en: 'Upcoming', ru: 'Скоро' },
  today: { en: 'Today', ru: 'Сегодня' },
  awaiting: { en: 'Landed, waiting for you', ru: 'Рейс приземлился, ждёт отметки' },
  logged: { en: 'Logged', ru: 'В журнале' },
}
const TO = { en: 'to', ru: '—' } as const

export function Ticket({
  state,
  locale,
  origin,
  destination,
  date,
  flightNumber,
  airline,
  distanceKm,
  statusLabel,
  prompt,
  actions,
  stub,
  className,
}: TicketProps) {
  const Icon = state === 'logged' ? Check : Plane
  return (
    <article
      className={clsx('ticket', className)}
      data-state={state}
      aria-label={`${origin.iata} ${TO[locale]} ${destination.iata}`}
    >
      <div className="ticket-main">
        <p className="ticket-status" data-state={state}>
          <Icon size={14} strokeWidth={2} aria-hidden="true" />
          {statusLabel ?? STATUS[state][locale]}
        </p>
        {prompt ? <p className="ticket-prompt">{prompt}</p> : null}
        <div className="ticket-route">
          <div className="ticket-end">
            <span className="ticket-code">{origin.iata}</span>
            <span className="ticket-city">{origin.city}</span>
          </div>
          <svg className="ticket-line" viewBox="0 0 48 12" aria-hidden="true" focusable="false">
            <path
              d="M1 6h40M36 1l6 5-6 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="ticket-end">
            <span className="ticket-code">{destination.iata}</span>
            <span className="ticket-city">{destination.city}</span>
          </div>
        </div>
        <dl className="ticket-meta">
          <div>
            <dt className="sr-only">{locale === 'ru' ? 'Дата' : 'Date'}</dt>
            <dd>{formatDateOnly(locale, date, 'medium')}</dd>
          </div>
          {flightNumber ? (
            <div>
              <dt className="sr-only">{locale === 'ru' ? 'Рейс' : 'Flight'}</dt>
              <dd className="ticket-mono">{flightNumber}</dd>
            </div>
          ) : null}
          {airline ? (
            <div>
              <dt className="sr-only">{locale === 'ru' ? 'Авиакомпания' : 'Airline'}</dt>
              <dd>{airline}</dd>
            </div>
          ) : null}
          {distanceKm ? (
            <div>
              <dt className="sr-only">{locale === 'ru' ? 'Расстояние' : 'Distance'}</dt>
              <dd>{formatDistanceKm(locale, distanceKm)}</dd>
            </div>
          ) : null}
        </dl>
        {actions ? <div className="ticket-actions">{actions}</div> : null}
      </div>
      {stub ? (
        <>
          <div className="ticket-perforation" aria-hidden="true" />
          <div className="ticket-stub">{stub}</div>
        </>
      ) : null}
    </article>
  )
}
