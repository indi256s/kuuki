'use client'

import { Car, PenLine, Plane, Train } from '@keyline-icons/react'
import type { ReactNode } from 'react'
import { CountryStamp } from '../stamps'
import { Button } from '../ui/button'
import { formatCount, type Locale } from '../../lib/format'
import {
  AWAITING_QUEUE_HREF,
  CATALOG_TOTAL,
  SOURCE_LABELS,
  formatVisitPoint,
  type PassportEntry,
  type PassportSource,
} from './model'
import { CARD_STAMP_SIZE } from './stamp-sizes'
import './passport.css'

const SOURCE_ICONS: Record<PassportSource, typeof Plane> = {
  flights: Plane,
  trains: Train,
  road: Car,
  manual: PenLine,
}

/** Compact source marks with a text alternative: the icons are decoration, the labels are read. */
function SourceMarks({ sources, locale }: { sources: PassportSource[]; locale: Locale }) {
  if (!sources.length) return null
  return (
    <>
      <span className="passport-card-sources" aria-hidden="true">
        {sources.map((source) => {
          const Icon = SOURCE_ICONS[source]
          return <Icon key={source} size={14} strokeWidth={1.75} />
        })}
      </span>
      <span className="sr-only">
        {', '}
        {sources.map((source) => SOURCE_LABELS[source][locale]).join(', ')}
      </span>
    </>
  )
}

/**
 * The collection as stamp cards. Each card is one button (click and keyboard) and the stamp's motion host. The owner
 * sees the last known date and the source marks; a visitor gets the stamp and the name only.
 */
export function PassportCards({
  entries,
  locale,
  name,
  owner,
  fresh,
  onOpen,
}: {
  entries: PassportEntry[]
  locale: Locale
  name: (code: string) => string
  owner: boolean
  /** Immutable press-event IDs for countries pressed since the owner last looked; the stamp plays them once. */
  fresh: ReadonlyMap<string, string>
  /** `pointer` is false for a keyboard activation (a click with no pointer behind it), which never plays the stamp hero. */
  onOpen: (code: string, opener: HTMLElement, pointer: boolean) => void
}) {
  const ru = locale === 'ru'
  return (
    <ul className="passport-cards" aria-label={ru ? 'Штампы' : 'Stamps'}>
      {entries.map((entry) => (
        <li key={entry.code}>
          <button
            type="button"
            className="passport-card"
            data-stamp-host
            data-code={entry.code}
            onClick={(event) => onOpen(entry.code, event.currentTarget, event.detail > 0)}
          >
            {/* The Import → Passport hero (route-motion.ts) pairs this stamp with the one on the Import page. */}
            <span className="passport-card-stamp" data-hero-enter-key={entry.code}>
              <CountryStamp
                iso2={entry.code}
                status="inked"
                size={CARD_STAMP_SIZE}
                impressionId={fresh.get(entry.code)}
              />
            </span>
            <span className="passport-card-name">{name(entry.code)}</span>
            {owner && entry.last ? (
              <span className="passport-card-date">
                <span className="sr-only">{ru ? ', последний визит ' : ', last visit '}</span>
                {formatVisitPoint(locale, entry.last, 'month')}
              </span>
            ) : null}
            {owner ? <SourceMarks sources={entry.sources} locale={locale} /> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

const AWAITING_FORMS = {
  en: { one: 'Awaiting confirmation · {count}', other: 'Awaiting confirmation · {count}' },
  ru: {
    one: 'Ждёт подтверждения · {count}',
    few: 'Ждут подтверждения · {count}',
    many: 'Ждут подтверждения · {count}',
    other: 'Ждут подтверждения · {count}',
  },
}
/** «Awaiting confirmation · 3», the label of the entry above the collection and the pending block's heading. */
export const awaitingLabel = (locale: Locale, count: number) =>
  formatCount(locale, count, AWAITING_FORMS)

/**
 * The owner's awaiting countries, apart from the collection: dashed outline without ink, and a Confirm action that
 * opens the arrival card of the flight behind the country. The link keeps the queue as its fallback target.
 */
export function PendingBlock({
  entries,
  locale,
  name,
  opening,
  onOpenArrival,
}: {
  entries: PassportEntry[]
  locale: Locale
  name: (code: string) => string
  /** The pending slot whose arrival card is being resolved: busy, and not activated again. */
  opening: string | null
  onOpenArrival: (code: string) => void
}) {
  const ru = locale === 'ru'
  return (
    <section
      id="passport-pending"
      className="passport-pending"
      aria-labelledby="passport-pending-title"
    >
      <h2 id="passport-pending-title" tabIndex={-1}>
        {awaitingLabel(locale, entries.length)}
      </h2>
      <p className="passport-note">
        {ru
          ? 'Перелёты в журнале, которые вы ещё не подтвердили. Штамп встанет после подтверждения.'
          : 'Flights in your journal you have not confirmed yet. The stamp is pressed once you confirm.'}
      </p>
      <ul
        className="passport-cards"
        aria-label={ru ? 'Ждут подтверждения' : 'Awaiting confirmation'}
      >
        {entries.map((entry) => (
          <li key={entry.code}>
            <a
              className="passport-card"
              data-stamp-host
              data-status="pending"
              href={AWAITING_QUEUE_HREF}
              aria-busy={opening === entry.code || undefined}
              aria-label={
                ru
                  ? `${name(entry.code)}: ждёт отметки. Подтвердить в карточке прилёта`
                  : `${name(entry.code)}: waiting for confirmation. Open the arrival card`
              }
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return
                event.preventDefault()
                if (opening !== entry.code) onOpenArrival(entry.code)
              }}
            >
              <CountryStamp iso2={entry.code} status="pending" size={CARD_STAMP_SIZE} />
              <span className="passport-card-name" aria-hidden="true">
                {name(entry.code)}
              </span>
              <span className="passport-card-action" aria-hidden="true">
                {ru ? 'Подтвердить' : 'Confirm'}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

const WAITING_FORMS = {
  en: { one: '{count} country is waiting for you', other: '{count} countries are waiting for you' },
  ru: {
    one: '{count} страна ждёт вас',
    few: '{count} страны ждут вас',
    many: '{count} стран ждут вас',
    other: '{count} страны ждут вас',
  },
}
const GHOSTS = ['round', 'rect', 'round', 'round', 'rect', 'round'] as const

/** An empty passport page: six ghost stamps, the catalog headline and the two ways in. */
export function EmptyPassport({ locale, onAdd }: { locale: Locale; onAdd: () => void }) {
  const ru = locale === 'ru'
  return (
    <section className="passport-empty" aria-labelledby="passport-empty-title">
      <ul className="passport-ghosts" aria-hidden="true">
        {GHOSTS.map((shape, index) => (
          <li key={index} className="passport-ghost" data-shape={shape} />
        ))}
      </ul>
      <h2 id="passport-empty-title">{formatCount(locale, CATALOG_TOTAL, WAITING_FORMS)}</h2>
      <p>
        {ru
          ? 'Добавьте страну, где вы были, или импортируйте перелёты: штампы появятся здесь.'
          : 'Add a country you have visited or import your flights, and the stamps appear here.'}
      </p>
      <p>
        {ru
          ? 'Страницы чисты. Формально — безупречная репутация.'
          : 'Every page is blank. Technically a clean record.'}
      </p>
      <div className="read-actions">
        <Button variant="primary" onClick={onAdd}>
          {ru ? 'Добавить страну' : 'Add country'}
        </Button>
        <a className="ui-button" data-variant="secondary" href="/import">
          <span>{ru ? 'Импортировать перелёты' : 'Import flights'}</span>
        </a>
      </div>
    </section>
  )
}

/** The collection is empty only because of the search or filters; one way back, and the add suggestion for the owner. */
export function FilteredEmpty({
  locale,
  suggestion,
  action,
  onReset,
}: {
  locale: Locale
  /** The unvisited country the query names, as a separate explicit offer (owner: an action; visitor: the name). */
  suggestion: ReactNode
  action: ReactNode
  onReset: () => void
}) {
  const ru = locale === 'ru'
  return (
    <section className="passport-filtered-empty" aria-labelledby="passport-filtered-title">
      <h2 id="passport-filtered-title">{ru ? 'Ничего не нашлось' : 'Nothing matches'}</h2>
      <p>
        {ru
          ? 'В этой коллекции нет стран под ваш поиск и фильтры.'
          : 'No country in this collection fits your search and filters.'}
      </p>
      <p>
        {ru
          ? 'Здесь пусто. Паспорт проверили дважды.'
          : 'Nothing here. The passport checked twice.'}
      </p>
      {suggestion}
      <div className="read-actions">
        {action}
        <Button onClick={onReset}>{ru ? 'Сбросить' : 'Reset'}</Button>
      </div>
    </section>
  )
}

/** Quiet line shown instead of the collection when there is nothing to list. */
export function QuietLine({ children }: { children: ReactNode }) {
  return <p className="passport-quiet">{children}</p>
}
