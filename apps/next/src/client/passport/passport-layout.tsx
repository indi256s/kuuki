'use client'

import { useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import Link from 'next/link'
import { OwnerAccent } from '../owner-accent'
import { AchievementCabinet } from '../profile/ladders/cabinet'
import { RUNG_NAME, toGo } from '../profile/ladders/copy'
import { holderInitials, nearestRung, toTiles } from '../profile/ladders/model'
import type { EarnedBadge } from '../profile/achievements'
import type { RemarksStats } from '../profile/remarks'
import { Block, BlockHead, HeadlineNumbers, JoinCard, Ranks } from '../profile/sections'
import { Button } from '../ui/button'
import { formatNumber, type Locale } from '../../lib/format'
import { resolveAccent } from '../../lib/theme-colors'
import { PassportAtlas } from './atlas'
import {
  EmptyPassport,
  FilteredEmpty,
  PassportCards,
  PendingBlock,
  QuietLine,
  awaitingLabel,
} from './collection'
import {
  activeFilterCount,
  filterEntries,
  foundText,
  searchSuggestion,
  sortEntries,
  totalsText,
  visitorEntries,
  type PassportEntry,
} from './model'
import { PassportIdentity, type IdentityOwner, type IdentityProfile } from './passport-identity'
import { PassportToolbar } from './passport-toolbar'
import type { usePassportQuery } from './use-passport-query'
import '../profile/profile.css'
import './passport.css'

export type PassportStats = ComponentProps<typeof HeadlineNumbers>['stats'] &
  NonNullable<ComponentProps<typeof AchievementCabinet>['stats']> &
  RemarksStats

/** The slim bar above the page when it is not a plain visitor read. */
export type PassportBar = 'preview-public' | 'preview-private' | 'own-public-page'

export type OwnerLayout = {
  ownerId: string
  identity: IdentityOwner
  /** The pending slot whose arrival card is being resolved. */
  opening: string | null
  /** Live status line: opening an arrival card, a removed country. */
  status: string
  onOpenArrival: (code: string) => void
  onAdd: () => void
  onOpenHidden: () => void
}

export type PassportLayoutProps = {
  locale: Locale
  mode: 'owner' | 'visitor' | 'preview'
  profile: IdentityProfile & { bio: string | null; is_public: boolean; theme_color: string | null }
  /** The handle from the route when the read carries none. */
  routeHandle: string
  stats: PassportStats | null
  badges: EarnedBadge[]
  rankings: { category: string; rank: number }[]
  memberViewer: boolean
  /** `ready`, `pending` or `error`: a passport still being derived is never shown as an empty one. */
  derivedState: string
  /** The visited total: the owner's factual count (hidden countries included) or the public set's size. */
  visited: number
  /** Visible pressed collection, unfiltered. */
  entries: PassportEntry[]
  /** Awaiting countries (owner only; always empty otherwise). */
  pending: PassportEntry[]
  /** Hidden country codes (owner only). */
  hiddenCodes: string[]
  name: (code: string) => string
  query: ReturnType<typeof usePassportQuery>
  /** Press-event IDs for newly pressed countries. */
  fresh: ReadonlyMap<string, string>
  /** `pointer` is true when a pointer opened the card: only then may the stamp grow into the sheet. */
  onOpen: (code: string, opener?: HTMLElement, pointer?: boolean) => void
  bar: PassportBar | null
  /** Status notes above the page: preparing, error, refresh failure. */
  notices: ReactNode
  owner: OwnerLayout | null
  /** The sheets this mode opens. */
  sheets: ReactNode
}

const norm = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 64).trim()

/**
 * The one Passport tree behind `/passport`, `/passport?as=visitor` and `/fly/<handle>`. Owner-only controls render
 * only when `owner` is set; the public modes receive no owner data at all.
 */
export function PassportLayout(props: PassportLayoutProps) {
  const { locale, mode, name, query, entries, pending, hiddenCodes, owner } = props
  const ru = locale === 'ru'
  const isOwner = !!owner
  const { state, navigate } = query

  // The search text is local so typing is instant; the URL follows it and, on Back, the field follows the URL.
  const [draft, setDraft] = useState(state.q)
  const [syncedQ, setSyncedQ] = useState(state.q)
  if (state.q !== syncedQ) {
    setSyncedQ(state.q)
    if (norm(draft) !== state.q) setDraft(state.q)
  }
  const filters = useMemo(
    () => ({ q: draft, region: state.region, sources: state.sources }),
    [draft, state.region, state.sources],
  )
  const filterCount = activeFilterCount(filters, { visitor: !isOwner })
  const filtersActive = norm(draft) !== '' || filterCount > 0

  const sorted = useMemo(
    () => sortEntries(entries, isOwner ? state.sort : 'name', name, locale),
    [entries, isOwner, state.sort, name, locale],
  )
  const filtered = useMemo(
    () => filterEntries(sorted, filters, name, { visitor: !isOwner }),
    [sorted, filters, name, isOwner],
  )
  const suggestion = useMemo(
    () =>
      norm(draft) && filtered.length === 0
        ? searchSuggestion(draft, [...entries, ...pending, ...visitorEntries(hiddenCodes)], name)
        : null,
    [draft, filtered.length, entries, pending, hiddenCodes, name],
  )

  const setQuery = (value: string) => {
    setDraft(value)
    navigate({ q: norm(value) || null })
  }
  const reset = () => {
    setDraft('')
    navigate({ q: null, region: null, src: null })
  }
  const showPending = () => {
    document.getElementById('passport-pending')?.scrollIntoView({ block: 'start' })
    document.getElementById('passport-pending-title')?.focus()
  }

  let index = 0
  const tiles = toTiles(props.badges)
  const next = isOwner ? nearestRung(props.badges, props.stats) : null
  const hiddenCount = hiddenCodes.length

  let collection: ReactNode
  if (entries.length === 0) {
    if (!owner) {
      collection = (
        <QuietLine>
          {ru ? 'Пока нечего показать.' : 'No countries to show yet.'}{' '}
          {ru ? 'Этот паспорт путешествует налегке.' : 'This passport is travelling light.'}
        </QuietLine>
      )
    } else if (pending.length > 0) {
      collection = (
        <QuietLine>
          {ru
            ? 'Штампов пока нет: страны ждут вашего подтверждения.'
            : 'No stamps yet: the countries below are waiting for you to confirm them.'}{' '}
          {ru ? 'Вылет состоялся — по документам.' : 'Departed, as far as the paperwork knows.'}{' '}
          <Button dense onClick={showPending}>
            {ru ? 'К ожидающим' : 'Go to awaiting'}
          </Button>
        </QuietLine>
      )
    } else if (hiddenCount > 0) {
      collection = (
        <QuietLine>
          {ru ? 'Все ваши страны скрыты.' : 'All of your countries are hidden.'}{' '}
          <Button dense onClick={owner.onOpenHidden}>
            {ru ? 'Скрытые страны' : 'Hidden countries'}
          </Button>
        </QuietLine>
      )
    } else if (props.derivedState !== 'ready') {
      collection = (
        <QuietLine>
          {props.derivedState === 'error'
            ? ru
              ? 'Паспорт пока не удалось собрать. Ваши записи сохранены, штампы появятся, когда обработка завершится.'
              : 'Your passport could not be assembled yet. Your records are saved, and the stamps appear once processing finishes.'
            : ru
              ? 'Паспорт собирается. Штампы появятся через несколько минут.'
              : 'Your passport is being prepared. The stamps appear in a few minutes.'}
        </QuietLine>
      )
    } else {
      collection = <EmptyPassport locale={locale} onAdd={owner.onAdd} />
    }
  } else if (filtered.length === 0) {
    collection = (
      <FilteredEmpty
        locale={locale}
        onReset={reset}
        suggestion={
          suggestion ? (
            <p className="passport-note">
              {isOwner
                ? ru
                  ? `${name(suggestion)} пока не в вашем паспорте.`
                  : `${name(suggestion)} is not in your passport yet.`
                : ru
                  ? `${name(suggestion)} нет в этом паспорте.`
                  : `${name(suggestion)} is not in this passport.`}
            </p>
          ) : null
        }
        action={
          suggestion && isOwner ? (
            <Button
              variant="primary"
              onClick={(event) => props.onOpen(suggestion, event.currentTarget)}
            >
              {ru ? `Добавить: ${name(suggestion)}` : `Add ${name(suggestion)}`}
            </Button>
          ) : null
        }
      />
    )
  } else if (state.view === 'map') {
    collection = (
      <PassportAtlas
        locale={locale}
        entries={filtered}
        pending={isOwner ? pending : []}
        owner={isOwner}
        name={name}
        onSelectCountry={(code) => props.onOpen(code)}
      />
    )
  } else {
    collection = (
      <PassportCards
        entries={filtered}
        locale={locale}
        name={name}
        owner={isOwner}
        fresh={props.fresh}
        onOpen={props.onOpen}
      />
    )
  }

  const showTotals = isOwner || props.visited > 0
  return (
    <section data-testid="passport-data" className="passport-page" data-mode={mode}>
      {mode !== 'owner' && props.profile.is_public ? (
        <OwnerAccent accent={resolveAccent(props.profile.theme_color)} />
      ) : null}
      {props.bar ? <PassportBarView locale={locale} bar={props.bar} /> : null}
      {props.notices}
      <PassportIdentity
        locale={locale}
        profile={props.profile}
        bio={props.profile.bio}
        fallbackHandle={props.routeHandle}
        founding={props.badges.some((item) => item.badge.code === 'founding-user')}
        owner={owner?.identity ?? null}
      />
      {owner ? (
        <p role="status" className="passport-caption">
          {owner.status}
        </p>
      ) : null}
      {showTotals ? (
        <p className="passport-total">
          {totalsText(locale, { visited: props.visited, hidden: isOwner ? hiddenCount : 0 })}
        </p>
      ) : null}
      <PassportToolbar
        locale={locale}
        owner={isOwner}
        state={state}
        query={draft}
        onQuery={setQuery}
        filterCount={filterCount}
        filtersActive={filtersActive}
        onReset={reset}
        navigate={navigate}
      />
      {filtersActive && entries.length > 0 ? (
        <p role="status" className="passport-found">
          {foundText(locale, filtered.length, entries.length)}
        </p>
      ) : null}
      {owner && pending.length > 0 ? (
        <button type="button" className="passport-awaiting-entry" onClick={showPending}>
          {awaitingLabel(locale, pending.length)}
        </button>
      ) : null}
      {collection}
      {owner && pending.length > 0 ? (
        <PendingBlock
          entries={pending}
          locale={locale}
          name={name}
          opening={owner.opening}
          onOpenArrival={owner.onOpenArrival}
        />
      ) : null}
      <div className="passport-sections">
        {isOwner || tiles.length > 0 ? (
          <Block index={index++} className="profile-cabinet" label="profile-badges-title">
            <BlockHead
              id="profile-badges-title"
              title={ru ? 'Достижения' : 'Achievements'}
              aside={
                tiles.length > 0 ? (
                  <p className="profile-block-aside">
                    {ru
                      ? `Получено: ${formatNumber(locale, tiles.length)}`
                      : `${formatNumber(locale, tiles.length)} earned`}
                  </p>
                ) : null
              }
            />
            {tiles.length > 0 ? (
              <AchievementCabinet
                badges={props.badges}
                stats={props.stats}
                locale={locale}
                ownerId={owner?.ownerId ?? null}
                initials={holderInitials(
                  props.profile.display_name || props.profile.username || '',
                )}
              />
            ) : (
              <p className="profile-quiet">
                {ru ? 'Достижений пока нет.' : 'No achievements yet.'}
              </p>
            )}
            {next ? (
              <p className="profile-quiet passport-next-rung">
                {ru ? 'Ближайшая ступень' : 'Nearest rung'}
                {': '}
                {RUNG_NAME[next.ladder][next.rung - 1][locale]}
                {' · '}
                {toGo(next.ladder, next.remaining, locale)}
              </p>
            ) : null}
          </Block>
        ) : null}
        {isOwner || props.rankings.length > 0 ? (
          <Ranks rankings={props.rankings} owner={isOwner} locale={locale} index={index++} />
        ) : null}
        {props.stats ? (
          <HeadlineNumbers stats={props.stats} locale={locale} index={index++} />
        ) : (
          <p className="profile-quiet" role="status">
            {ru ? 'Статистика готовится.' : 'Statistics are being prepared.'}
          </p>
        )}
        {mode === 'visitor' && !props.memberViewer ? (
          <JoinCard locale={locale} index={index++} />
        ) : null}
      </div>
      {props.sheets}
    </section>
  )
}

function PassportBarView({ locale, bar }: { locale: Locale; bar: PassportBar }) {
  const ru = locale === 'ru'
  const text =
    bar === 'preview-public'
      ? ru
        ? 'Вы смотрите как посетитель: так видят ваш паспорт другие.'
        : 'Previewing as a visitor: this is what others see.'
      : bar === 'preview-private'
        ? ru
          ? 'Ваш профиль скрыт. Так паспорт выглядел бы для посетителей, если открыть профиль.'
          : 'Your profile is private. This is what visitors would see if you published it.'
        : ru
          ? 'Это ваша публичная страница.'
          : 'This is your public page.'
  return (
    <aside className="passport-bar" aria-label={ru ? 'Режим просмотра' : 'Viewing mode'}>
      <p>{text}</p>
      <Link href="/passport" className="profile-inline-link">
        {ru ? 'Вернуться к своему паспорту' : 'Back to my passport'}
      </Link>
    </aside>
  )
}
