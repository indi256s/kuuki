import { Suspense } from 'react'
import { getPublicProfile } from '../../../../server/public'
import { getOptionalPublicViewer } from '../../../../server/identity'
import {
  getOwnProfile,
  getOwnProfileStats,
  getOwnBadges,
  getOwnStamps,
  getProfileShareUrl,
} from '../../../../server/profile'
import { getRequestLocale } from '../../../../server/locale'
import { pageMetadata } from '../../../../server/metadata'
import { IdentitySnapshot } from '../../../../client/activity'
import { AchievementCabinet } from '../../../../client/profile/ladders/cabinet'
import { holderInitials, toTiles } from '../../../../client/profile/ladders/model'
import { OwnerAccent } from '../../../../client/owner-accent'
import { documentNumber, mrzLines } from '../../../../client/profile/mrz'
import { remarksLine } from '../../../../client/profile/remarks'
import { profileStamps } from '../../../../client/profile/stamps'
import { profileViewState } from '../../../../client/profile/view'
import {
  Block,
  BlockHead,
  ClosedCover,
  HeadlineNumbers,
  HolderPage,
  JoinCard,
  Ranks,
  StampStrip,
} from '../../../../client/profile/sections'
import { formatNumber } from '../../../../lib/format'
import { resolveAccent } from '../../../../lib/theme-colors'
import '../../../../client/profile/profile.css'

export const generateMetadata = () => pageMetadata('Profile', 'Профиль')
export async function ProfileData({ username }: { username: string }) {
  const [data, viewer, locale] = await Promise.all([
    getPublicProfile(username),
    getOptionalPublicViewer(),
    getRequestLocale(),
  ])
  const ru = locale === 'ru'
  const state = profileViewState(data?.profile, viewer?.id)
  if (!data || state.kind === 'not-found' || state.kind === 'closed')
    return (
      <ClosedCover
        kind={state.kind === 'closed' ? 'private' : 'missing'}
        viewer={viewer ? 'member' : 'guest'}
        locale={locale}
      />
    )
  const owner = state.kind === 'owner'
  const privateOwner = owner && state.visibility === 'private'
  const [own, privateStats, privateBadges, shareUrl, ownStamps] = await Promise.all([
    privateOwner ? getOwnProfile() : null,
    privateOwner ? getOwnProfileStats(data.profile.id) : null,
    privateOwner ? getOwnBadges(data.profile.id) : [],
    owner ? getProfileShareUrl(data.profile.username ?? username) : null,
    owner ? getOwnStamps(data.profile.id) : [],
  ])
  // Only allowlisted identity fields enter the client islands; own-profile includes private credentials.
  const profile = privateOwner && own ? own.profile : data.profile
  const stats = privateOwner ? privateStats : data.stats
  const badges = privateOwner ? privateBadges : data.badges
  // Legacy rows, cities and duplicates are hidden: the cabinet shows one tile per ladder (D10, amended).
  const tiles = toTiles(badges)
  const handle = profile.username ?? username
  const name = profile.display_name || profile.username || (ru ? 'Участник Kuuki' : 'Kuuki member')
  const stamps = profileStamps(
    owner ? { kind: 'owner', stamps: ownStamps } : { kind: 'visitor', countries: data.countries },
    locale,
  )
  // The right page's blocks in spec order; a visitor never sees an empty block (board 21.8).
  let index = 0
  const content = (
    <article className="profile-spread" data-owner={owner || undefined}>
      {data.profile.is_public && <OwnerAccent accent={resolveAccent(data.profile.theme_color)} />}
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
                visibility: state.visibility,
                shareUrl,
                remarks: stats ? remarksLine(profile.id, stats, locale) : null,
              }
            : null
        }
      />
      <div className="profile-page">
        {data.derivedState === 'pending' && (
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
        {(owner || data.rankings.length > 0) && (
          <Ranks rankings={data.rankings} owner={owner} locale={locale} index={index++} />
        )}
        {!viewer && <JoinCard locale={locale} index={index++} />}
      </div>
    </article>
  )
  return owner ? <IdentitySnapshot ownerId={data.profile.id}>{content}</IdentitySnapshot> : content
}
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, locale] = await Promise.all([params, getRequestLocale()])
  return (
    <Suspense
      fallback={<p role="status">{locale === 'ru' ? 'Загружаем профиль…' : 'Loading profile…'}</p>}
    >
      <ProfileData username={username} />
    </Suspense>
  )
}
