// The profile's server-rendered layout (spec + boards 21.x): the holder page, the closed covers and the right-page
// blocks. Client islands (Share, the badge cabinet, the founding crew keepsake, the avatar) are imported, not owned.
import { Globe, Lock } from '@keyline-icons/react'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { EARTH_CIRCUMFERENCE_KM } from '@kuuki/shared/constants'
import { ProfileAvatar } from './avatar'
import { DataPage, DataPageMrz, UvToggle } from './data-page'
import { Guilloche, OviPatch, Perforation, UvPrint, initials } from './data-page-art'
import { FoundingCrew } from './founding-crew'
import { ShareProfile } from './profile'
import type { ProfileStamp } from './stamps'
import { categoryName } from '../leaderboard/categories'
import { formatCount, formatNumber, type CountForms, type Locale } from '../../lib/format'

const MONTHS = {
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  ru: ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'],
}
/** Each stamp lands at its own small angle, as if pressed by hand (board 21.1b order). */
const ROTATIONS = [-6, 4, -2, 8, -9, 4, -9, -2]

/** "MAR 2024" in the passport's issue-date style; the year is read from the string, never shifted. */
export function issuedLabel(value: string, locale: Locale) {
  const match = /^(\d{4})-(\d{2})/.exec(value)
  return match ? `${MONTHS[locale][Number(match[2]) - 1]} ${match[1]}` : value
}

/** A printed field label, in both languages in every locale by design; assistive tech reads only `spoken`. */
function PrintedLabel({ printed, spoken }: { printed: string; spoken?: string }) {
  return (
    <>
      <span className="profile-label" aria-hidden="true">
        {printed}
      </span>
      {spoken && <span className="sr-only">{spoken}</span>}
    </>
  )
}

export function HolderPage({
  locale,
  id,
  name,
  handle,
  avatarUrl,
  founding,
  issued,
  bio,
  mrz,
  documentNumber,
  uvStamp,
  owner,
}: {
  locale: Locale
  id: string
  name: string
  handle: string
  avatarUrl: string | null
  founding: boolean
  issued: string | null
  bio: string | null
  mrz: [string, string]
  /** "0142", printed as "№ KU 0142" and perforated down the right edge. */
  documentNumber: string
  /** A public stamp code for the UV ring stamp; the crest shows alone without one. */
  uvStamp: string | null
  owner: null | {
    visibility: 'public' | 'private'
    shareUrl: string | null
    remarks: string | null
  }
}) {
  const ru = locale === 'ru'
  const privateOwner = owner?.visibility === 'private'
  return (
    <aside className="profile-holder" aria-labelledby="profile-name">
      <DataPage>
        <Guilloche className="profile-guilloche" />
        <UvPrint stamp={uvStamp} />
        <span className="profile-laminate" aria-hidden="true" />
        <span className="profile-stitches" aria-hidden="true" />
        <Perforation number={documentNumber} />
        <span className="profile-ghost" aria-hidden="true">
          {initials(name)}
        </span>
        <div className="profile-data-content">
          <div className="profile-holder-head">
            <div className="profile-holder-mark">
              <UvToggle locale={locale} />
              <p className="eyebrow">
                {ru ? 'Бортовой журнал · Владелец' : 'Flight journal · Holder'}
              </p>
            </div>
            <span className="profile-doc-number" aria-hidden="true">
              № KU {documentNumber}
            </span>
          </div>
          <span className="profile-photo-window">
            <ProfileAvatar id={id} url={avatarUrl} name={name} size={88} />
            <OviPatch />
          </span>
          <div className="profile-field profile-field-name">
            <PrintedLabel printed="Holder / Владелец" />
            <h1 id="profile-name">{name}</h1>
          </div>
          <div className="profile-field">
            <PrintedLabel printed="Handle / Имя пользователя" />
            <p className="profile-handle-row">
              <span className="profile-handle">@{handle}</span>
              {founding && <FoundingCrew locale={locale} />}
            </p>
          </div>
          {(issued || bio) && (
            <dl className="profile-fields">
              {issued && (
                <div className="profile-field profile-field-issued">
                  <dt>
                    <PrintedLabel printed="Issued / Дата выдачи" spoken={ru ? 'Выдан' : 'Issued'} />
                  </dt>
                  <dd>
                    <time dateTime={issued}>{issuedLabel(issued, locale)}</time>
                  </dd>
                </div>
              )}
              {bio && (
                <div className="profile-field profile-field-bio">
                  <dt>
                    <PrintedLabel printed="Bio / О себе" spoken={ru ? 'О себе' : 'Bio'} />
                  </dt>
                  <dd>{bio}</dd>
                </div>
              )}
            </dl>
          )}
          {owner?.remarks && (
            <div className="profile-field profile-remarks">
              <p>
                <PrintedLabel printed="Remarks / Замечания" spoken={ru ? 'Замечания' : 'Remarks'} />
              </p>
              <p className="profile-remarks-line">{owner.remarks}</p>
              <p className="profile-remarks-note">
                {ru ? 'Видите только вы' : 'Only you see this'}
              </p>
            </div>
          )}
        </div>
        <DataPageMrz lines={mrz} page="2" />
        {privateOwner && (
          <div className="profile-private-stamp" aria-hidden="true">
            <span>{ru ? 'СКРЫТ' : 'PRIVATE'}</span>
            <span>{ru ? 'ВИДИТЕ ТОЛЬКО ВЫ' : 'ONLY YOU CAN SEE THIS'}</span>
          </div>
        )}
      </DataPage>
      {/* Owner controls are actions, not printed fields: they sit below the page, off it. */}
      {owner && !privateOwner && (
        <div className="profile-owner-actions">
          {owner.shareUrl && <ShareProfile url={owner.shareUrl} title={name} locale={locale} />}
          <Link
            href="/settings"
            className="profile-visibility"
            aria-label={
              ru ? 'Открытый профиль, изменить в настройках' : 'Public profile, change in Settings'
            }
          >
            <Globe size={16} strokeWidth={1.75} aria-hidden="true" />
            {ru ? 'Открыт' : 'Public'}
          </Link>
        </div>
      )}
      {privateOwner && (
        <div className="profile-owner-private">
          <Link
            href="/settings"
            className="profile-visibility"
            data-private
            aria-label={
              ru ? 'Скрытый профиль, изменить в настройках' : 'Private profile, change in Settings'
            }
          >
            <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
            {ru ? 'Скрыт' : 'Private'}
          </Link>
          <p className="profile-owner-note">
            {ru
              ? 'Ваш профиль скрыт. Другие видят закрытый паспорт.'
              : 'Your profile is private. Others see a closed passport.'}{' '}
            <Link href="/settings">{ru ? 'Изменить в настройках' : 'Change in Settings'}</Link>
          </p>
        </div>
      )}
    </aside>
  )
}

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
      <h2 className="sr-only" id="profile-numbers-title">
        {ru ? 'Статистика' : 'Statistics'}
      </h2>
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

export function StampStrip({
  stamps,
  more,
  total,
  owner,
  locale,
  index,
}: {
  stamps: ProfileStamp[]
  more: number
  total: number
  owner: boolean
  locale: Locale
  index: number
}) {
  const ru = locale === 'ru'
  const count = formatCount(locale, total, {
    en: { one: '{count} country', other: '{count} countries' },
    ru: {
      one: '{count} страна',
      few: '{count} страны',
      many: '{count} стран',
      other: '{count} страны',
    },
  })
  return (
    <Block index={index} className="profile-stamps-block" label="profile-stamps-title">
      <BlockHead
        id="profile-stamps-title"
        title={ru ? 'Штампы' : 'Stamps'}
        aside={
          <p className="profile-block-aside">
            {count}
            {owner && (
              <>
                {' · '}
                <Link href="/passport" className="profile-inline-link">
                  {ru ? 'Открыть паспорт' : 'Open passport'} →
                </Link>
              </>
            )}
          </p>
        }
      />
      {stamps.length > 0 ? (
        <ul className="profile-stamps">
          {stamps.map((stamp, i) => (
            <li
              key={stamp.code}
              className="profile-stamp"
              style={{ '--stamp-rot': `${ROTATIONS[i % ROTATIONS.length]}deg` } as CSSProperties}
            >
              <span className="sr-only">{stamp.name}</span>
              <span className="profile-stamp-code" aria-hidden="true">
                {stamp.code}
              </span>
              {stamp.date && (
                <span className="profile-stamp-date" aria-hidden="true">
                  {stamp.date}
                </span>
              )}
            </li>
          ))}
          {more > 0 && (
            <li className="profile-stamps-more">
              <span aria-hidden="true">+{formatNumber(locale, more)}</span>
              <span className="sr-only">
                {ru
                  ? `и ещё ${formatNumber(locale, more)}`
                  : `and ${formatNumber(locale, more)} more`}
              </span>
            </li>
          )}
        </ul>
      ) : (
        <p className="profile-quiet">
          {ru
            ? 'Штампов пока нет. Первый перелёт поставит первый.'
            : 'No stamps yet. Your first flight presses the first one.'}
        </p>
      )}
    </Block>
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
                <Link
                  href={`/leaderboard?category=${encodeURIComponent(rank.category)}`}
                  className="profile-gate"
                  aria-label={
                    ru
                      ? `Место ${rank.rank} в категории «${category}»`
                      : `Rank ${rank.rank} in ${category}`
                  }
                >
                  <span className="profile-gate-label" aria-hidden="true">
                    {category}
                  </span>
                  <span className="profile-gate-rank" aria-hidden="true">
                    #{rank.rank}
                  </span>
                </Link>
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
