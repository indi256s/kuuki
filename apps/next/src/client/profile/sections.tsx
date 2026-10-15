// Passport blocks shared by the owner and public page: closed covers, headline numbers, ranks and the join card.
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { EARTH_CIRCUMFERENCE_KM } from '@kuuki/shared/constants'
import { GateTile } from '../ui/gate-tile'
import { categoryName } from '../leaderboard/categories'
import { formatCount, formatNumber, type CountForms, type Locale } from '../../lib/format'

function CoverArt({ ru }: { ru: boolean }) {
  return (
    <div className="profile-cover" aria-hidden="true">
      <span className="profile-cover-title">{ru ? 'БОРТОВОЙ ЖУРНАЛ' : 'FLIGHT JOURNAL'}</span>
      <span className="profile-cover-emblem">
        <svg viewBox="0 0 104 104" width="104" height="104" focusable="false">
          <circle cx="52" cy="52" r="40" />
          <ellipse cx="52" cy="52" rx="17" ry="40" />
          <path d="M12 52H92M18 33H86M18 71H86" />
          <path
            className="profile-cover-plane"
            transform="translate(70 18) rotate(40)"
            d="M0 -12L3 -3L13 3V6L3 3L2 9L5 11V13L0 12L-5 13V11L-2 9L-3 3L-13 6V3L-3 -3Z"
          />
        </svg>
        <span className="profile-cover-kana">くうき</span>
      </span>
      <span className="profile-cover-foot">{ru ? 'ПАСПОРТ' : 'PASSPORT'}</span>
    </div>
  )
}

/** Visitor on a private profile (no name, no data) or a handle that does not exist (spec "States"). */
export function ClosedCover({
  kind,
  viewer,
  locale,
}: {
  kind: 'private' | 'missing'
  viewer: 'guest' | 'member'
  locale: Locale
}) {
  const ru = locale === 'ru'
  return (
    <section className="profile-closed" data-kind={kind}>
      <CoverArt ru={ru} />
      {kind === 'private' ? (
        <>
          <h1>{ru ? 'Этот паспорт скрыт.' : 'This passport is private.'}</h1>
          <p>
            {ru
              ? 'Владелец держит свои перелёты при себе.'
              : 'Its holder keeps their flights to themselves.'}
          </p>
          {viewer === 'guest' ? (
            <Link href="/signup" className="profile-closed-link">
              {ru ? 'Начните свой журнал' : 'Start your own journal'}
            </Link>
          ) : (
            <Link href="/journal" className="profile-closed-link">
              {ru ? 'Вернуться к своему журналу' : 'Back to your journal'}
            </Link>
          )}
        </>
      ) : (
        <>
          <h1>{ru ? 'Такого паспорта нет.' : 'No such passport.'}</h1>
          <p>
            {ru
              ? 'Возможно, он переехал или никогда не существовал.'
              : 'It may have moved, or never existed.'}
          </p>
          <Link href="/" className="ui-button" data-variant="secondary">
            {ru ? 'На главную' : 'Go home'}
          </Link>
        </>
      )}
    </section>
  )
}

const totalsForms: Record<'flights' | 'countries' | 'hours', CountForms> = {
  flights: {
    en: { one: 'Flight', other: 'Flights' },
    ru: { one: 'перелёт', few: 'перелёта', many: 'перелётов', other: 'перелёта' },
  },
  countries: {
    en: { one: 'Country', other: 'Countries' },
    ru: { one: 'страна', few: 'страны', many: 'стран', other: 'страны' },
  },
  hours: {
    en: { one: 'Hour in the air', other: 'Hours in the air' },
    ru: { one: 'ч в воздухе', few: 'ч в воздухе', many: 'ч в воздухе', other: 'ч в воздухе' },
  },
}

export type ProfileTotals = {
  total_flights: number
  total_distance_km: number
  total_duration_minutes: number
  countries_count: number
}

/** The order the right page stacks its blocks in; each one's entrance waits 60ms longer (spec "Motion"). */
export function Block({
  index,
  className = '',
  label,
  children,
}: {
  index: number
  className?: string
  label?: string
  children: ReactNode
}) {
  return (
    <section
      className={`profile-block ${className}`}
      style={{ '--block-i': index } as CSSProperties}
      aria-labelledby={label}
    >
      {children}
    </section>
  )
}

/** Headline numbers: distance with its Earth caption, then flights, countries and air-time hours. */
export function HeadlineNumbers({
  stats,
  locale,
  index,
}: {
  stats: ProfileTotals
  locale: Locale
  index: number
}) {
  const ru = locale === 'ru'
  const flights = stats.total_flights
  const shown = (value: number) => Number.isFinite(value) && (value > 0 || flights === 0)
  const distance = shown(stats.total_distance_km) ? Math.round(stats.total_distance_km) : null
  const laps = distance === null ? 0 : distance / EARTH_CIRCUMFERENCE_KM
  const hours = shown(stats.total_duration_minutes)
    ? Math.round(stats.total_duration_minutes / 60)
    : null
  const totals: [keyof typeof totalsForms, number][] = [
    ['flights', flights],
    ['countries', stats.countries_count],
  ]
  if (hours !== null) totals.push(['hours', hours])
  return (
    <Block index={index} className="profile-numbers" label="profile-numbers-title">
      <BlockHead id="profile-numbers-title" title={ru ? 'В перелётах' : 'On flights'} />
      {distance !== null && (
        <div className="profile-distance">
          <p className="eyebrow">{ru ? 'Налетано' : 'Distance flown'}</p>
          <p className="profile-distance-value">
            <span>{formatNumber(locale, distance)}</span>{' '}
            <span className="profile-distance-unit">{ru ? 'км' : 'km'}</span>
          </p>
          {laps >= 0.5 && (
            <p className="profile-earth">
              {ru ? 'Вокруг Земли' : 'Around the Earth'} ×
              {formatNumber(locale, Math.round(laps * 10) / 10)}
            </p>
          )}
        </div>
      )}
      <dl className="profile-totals">
        {totals.map(([key, value]) => (
          <div key={key}>
            <dt>{formatCount(locale, value, totalsForms[key])}</dt>
            <dd>{formatNumber(locale, value)}</dd>
          </div>
        ))}
      </dl>
    </Block>
  )
}

export function BlockHead({ id, title, aside }: { id: string; title: string; aside?: ReactNode }) {
  return (
    <div className="profile-block-head">
      <h2 id={id}>{title}</h2>
      {aside}
    </div>
  )
}

export function Ranks({
  rankings,
  owner,
  locale,
  index,
}: {
  rankings: { category: string; rank: number }[]
  owner: boolean
  locale: Locale
  index: number
}) {
  const ru = locale === 'ru'
  const sorted = [...rankings].sort((a, b) => a.rank - b.rank)
  return (
    <Block index={index} className="profile-ranks" label="profile-ranks-title">
      <BlockHead
        id="profile-ranks-title"
        title={ru ? 'Рейтинг' : 'Leaderboard'}
        aside={
          <Link href="/leaderboard" className="profile-inline-link profile-ranks-all">
            {ru ? 'Открыть рейтинг' : 'View leaderboard'} →
          </Link>
        }
      />
      {sorted.length > 0 ? (
        <ul className="profile-gates">
          {sorted.map((rank) => {
            const category = categoryName(rank.category, locale)
            return (
              <li key={rank.category}>
                <GateTile
                  href={`/leaderboard?category=${encodeURIComponent(rank.category)}`}
                  label={category}
                  value={`#${rank.rank}`}
                  ariaLabel={
                    ru
                      ? `Место ${rank.rank} в категории «${category}»`
                      : `Rank ${rank.rank} in ${category}`
                  }
                />
              </li>
            )
          })}
        </ul>
      ) : (
        owner && (
          <p className="profile-quiet">
            {ru
              ? 'Рейтинг появится после пяти перелётов, если профиль открыт и включено участие.'
              : 'Rankings appear after five flights with a public profile and participation on.'}
          </p>
        )
      )}
    </Block>
  )
}

export function JoinCard({ locale, index }: { locale: Locale; index: number }) {
  const ru = locale === 'ru'
  return (
    <Block index={index} className="profile-join" label="profile-join-title">
      <h2 id="profile-join-title">
        {ru ? 'Соберите свой паспорт путешественника.' : 'Build your own travel passport.'}
      </h2>
      <p>
        {ru
          ? 'Записывайте перелёты, собирайте штампы и получайте награды.'
          : 'Log flights, collect stamps and earn badges.'}
      </p>
      <Link href="/signup" className="ui-button" data-variant="primary">
        {ru ? 'Начните свой журнал перелётов' : 'Start your own flight journal'}
      </Link>
    </Block>
  )
}
