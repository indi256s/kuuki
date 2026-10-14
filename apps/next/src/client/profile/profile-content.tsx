'use client'

import type { ComponentProps } from 'react'
import { useLocale } from '../preferences'
import { IdentitySnapshot } from '../activity'
import { AchievementCabinet } from './ladders/cabinet'
import { holderInitials, toTiles } from './ladders/model'
import { OwnerAccent } from '../owner-accent'
import { documentNumber, mrzLines } from './mrz'
import { remarksLine, type RemarksStats } from './remarks'
import { profileStamps } from './stamps'
import {
  Block,
  BlockHead,
  ClosedCover,
  HeadlineNumbers,
  HolderPage,
  JoinCard,
  Ranks,
  StampStrip,
} from './sections'
import { formatNumber, type Locale } from '../../lib/format'
import { resolveAccent } from '../../lib/theme-colors'
import './profile.css'

type ProfileContentProps = {
  locale: Locale
  profile: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    created_at: string | null
    bio: string | null
    is_public: boolean
    theme_color: string | null
  }
  username: string
  stats:
    | (ComponentProps<typeof HeadlineNumbers>['stats'] &
        NonNullable<ComponentProps<typeof AchievementCabinet>['stats']> &
        RemarksStats)
    | null
  badges: ComponentProps<typeof AchievementCabinet>['badges']
  rankings: ComponentProps<typeof Ranks>['rankings']
  countries: string[]
  ownStamps: { code: string; lastVisit: string | null }[]
  owner: boolean
  visibility: 'public' | 'private'
  memberViewer: boolean
  shareUrl: string | null
  derivedState: string
}

export function ProfileContent({
  locale: initialLocale,
  profile,
  username,
  stats,
  badges,
  rankings,
  countries,
  ownStamps,
  owner,
  visibility,
  memberViewer,
  shareUrl,
  derivedState,
}: ProfileContentProps) {
  const locale = useLocale(initialLocale)
  const ru = locale === 'ru'
  const tiles = toTiles(badges)
  const handle = profile.username ?? username
  const name = profile.display_name || profile.username || (ru ? 'Участник Kuuki' : 'Kuuki member')
  const stamps = profileStamps(
    owner ? { kind: 'owner', stamps: ownStamps } : { kind: 'visitor', countries },
    locale,
  )
  // The right page's blocks in spec order; a visitor never sees an empty block (board 21.8).
  let index = 0
  const content = (
    <article className="profile-spread" data-owner={owner || undefined}>
      {profile.is_public && <OwnerAccent accent={resolveAccent(profile.theme_color)} />}
      <HolderPage
        locale={locale}
        id={profile.id}
        name={name}
        handle={handle}
        avatarUrl={profile.avatar_url}
        founding={badges.some((item) => item.badge.code === 'founding-user')}
        issued={profile.created_at}
        bio={profile.bio}
        documentNumber={documentNumber(stats?.total_flights ?? 0)}
        uvStamp={stamps.stamps[0]?.code ?? null}
        mrz={mrzLines({
          name,
          handle,
          flights: stats?.total_flights ?? 0,
          countries: stats?.countries_count ?? 0,
          issued: profile.created_at,
        })}
        owner={
          owner
            ? {
                visibility,
                shareUrl,
                remarks: stats ? remarksLine(profile.id, stats, locale) : null,
              }
            : null
        }
      />
      <div className="profile-page">
        {derivedState === 'pending' && (
          <p className="profile-quiet" role="status">
            {ru
              ? 'Недавние изменения обрабатываются. Рейтинг может появиться позже.'
              : 'Recent changes are being prepared. Rankings may take a little longer to appear.'}
          </p>
        )}
        {stats ? (
          <HeadlineNumbers stats={stats} locale={locale} index={index++} />
        ) : (
          <p className="profile-quiet" role="status">
            {ru ? 'Статистика готовится.' : 'Statistics are being prepared.'}
          </p>
        )}
        {(owner || stamps.total > 0) && (
          <StampStrip {...stamps} owner={owner} locale={locale} index={index++} />
        )}
        {(owner || tiles.length > 0) && (
          <Block index={index++} className="profile-cabinet" label="profile-badges-title">
            <BlockHead
              id="profile-badges-title"
              title={ru ? 'Достижения' : 'Achievements'}
              aside={
                tiles.length > 0 && (
                  <p className="profile-block-aside">
                    {ru
                      ? `Получено: ${formatNumber(locale, tiles.length)}`
                      : `${formatNumber(locale, tiles.length)} earned`}
                  </p>
                )
              }
            />
            {tiles.length > 0 ? (
              <AchievementCabinet
                badges={badges}
                stats={stats}
                locale={locale}
                ownerId={owner ? profile.id : null}
                initials={holderInitials(profile.display_name || profile.username || '')}
              />
            ) : (
              <p className="profile-quiet">
                {ru ? 'Достижений пока нет.' : 'No achievements yet.'}
              </p>
            )}
          </Block>
        )}
        {(owner || rankings.length > 0) && (
          <Ranks rankings={rankings} owner={owner} locale={locale} index={index++} />
        )}
        {!memberViewer && <JoinCard locale={locale} index={index++} />}
      </div>
    </article>
  )
  return owner ? <IdentitySnapshot ownerId={profile.id}>{content}</IdentitySnapshot> : content
}

export function ProfileClosed(props: ComponentProps<typeof ClosedCover>) {
  const locale = useLocale(props.locale)
  return <ClosedCover {...props} locale={locale} />
}

export function ProfileLoading({ locale: initialLocale }: { locale: Locale }) {
  const locale = useLocale(initialLocale)
  return <p role="status">{locale === 'ru' ? 'Загружаем профиль…' : 'Loading profile…'}</p>
}
