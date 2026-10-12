import { EARTH_CIRCUMFERENCE_KM } from '@kuuki/shared/constants'
import Link from 'next/link'
import { Suspense } from 'react'
import { getPublicProfile } from '../../../../server/public'
import { getOptionalPublicViewer } from '../../../../server/identity'
import {
  getOwnProfile,
  getOwnProfileStats,
  getOwnBadges,
  getProfileShareUrl,
} from '../../../../server/profile'
import { getRequestLocale } from '../../../../server/locale'
import { pageMetadata } from '../../../../server/metadata'
import { IdentitySnapshot } from '../../../../client/activity'
import { Achievements, ShareProfile } from '../../../../client/profile/profile'
import { ProfileAvatar } from '../../../../client/profile/avatar'
import { FoundingCrew } from '../../../../client/profile/founding-crew'
import { OwnerAccent } from '../../../../client/owner-accent'
import { formatDistanceKm, formatMonthYear, formatNumber } from '../../../../lib/format'
import { resolveAccent } from '../../../../lib/theme-colors'
import { categoryName } from '../../../../client/leaderboard/categories'
import '../../../../client/profile/profile.css'

export const generateMetadata = () => pageMetadata('Profile', 'Профиль')
export async function ProfileData({ username }: { username: string }) {
  const [data, viewer, locale] = await Promise.all([
    getPublicProfile(username),
    getOptionalPublicViewer(),
    getRequestLocale(),
  ])
  const ru = locale === 'ru'
  if (!data)
    return (
      <section className="public-state editorial-profile">
        <h1>{ru ? 'Профиль не найден' : 'Profile not found'}</h1>
        <p>
          {ru
            ? 'Возможно, профиль перемещён или удалён.'
            : 'This profile may have moved or may no longer exist.'}
        </p>
        <Link href="/">{ru ? 'На главную' : 'Go home'}</Link>
      </section>
    )
  const owner = viewer?.id === data.profile.id
  const privateOwner = owner && !data.profile.is_public
  const [own, privateStats, privateBadges, shareUrl] = await Promise.all([
    privateOwner ? getOwnProfile() : null,
    privateOwner ? getOwnProfileStats(data.profile.id) : null,
    privateOwner ? getOwnBadges(data.profile.id) : [],
    owner ? getProfileShareUrl(data.profile.username ?? username) : null,
  ])
  // Only allowlisted identity fields enter the client islands; own-profile includes private credentials.
  const profile = privateOwner && own ? own.profile : data.profile
  const stats = privateOwner ? privateStats : data.stats
  const badges = privateOwner ? privateBadges : data.badges
  const visible = owner || data.profile.is_public
  const name = visible
    ? profile.display_name || profile.username || (ru ? 'Участник Kuuki' : 'Kuuki member')
    : ru
      ? 'Скрытый профиль'
      : 'Private profile'
  const content = (
    <article className="editorial-profile">
      {data.profile.is_public && <OwnerAccent accent={resolveAccent(data.profile.theme_color)} />}
      <span className="profile-watermark" aria-hidden="true">
        くうき
      </span>
      <header className="profile-head">
        {visible && <ProfileAvatar id={profile.id} url={profile.avatar_url} name={name} />}
        <div>
          <p className="eyebrow">{ru ? 'Профиль путешественника' : 'Flight profile'}</p>
          <div className="profile-name">
            <h1>{name}</h1>
            {visible && badges.some((item) => item.badge.code === 'founding-user') && (
              <FoundingCrew locale={locale} />
            )}
          </div>
          {visible && <p className="handle">@{profile.username}</p>}
        </div>
      </header>
      {visible && (
        <>
          <p className="profile-meta">
            {profile.created_at && (
              <span>
                {ru ? 'В Kuuki с' : 'Joined'}{' '}
                <time dateTime={profile.created_at}>
                  {formatMonthYear(locale, profile.created_at)}
                </time>
              </span>
            )}
          </p>
          {profile.bio && <p>{profile.bio}</p>}
        </>
      )}
      {owner && (
        <div className="profile-actions">
          {shareUrl && <ShareProfile url={shareUrl} locale={locale} />}
          <Link href="/settings">
            {data.profile.is_public
              ? ru
                ? 'Открытый профиль'
                : 'Public profile'
              : ru
                ? 'Скрытый профиль'
                : 'Private profile'}
          </Link>
          <Link href="/settings">{ru ? 'Настройки и профиль' : 'Settings and profile'}</Link>
        </div>
      )}
      {!data.profile.is_public && (
        <p className="status-note" role="status">
          {owner
            ? ru
              ? 'Ваш профиль скрыт. Другие видят только это сообщение. Измените видимость в настройках.'
              : 'Your profile is private. Others see only this message. Change visibility in Settings.'
            : ru
              ? 'Этот профиль скрыт.'
              : 'This profile is private.'}
        </p>
      )}
      {visible && (
        <>
          {data.derivedState === 'pending' && (
            <p role="status">
              {ru
                ? 'Недавние изменения обрабатываются. Рейтинг может появиться позже.'
                : 'Recent changes are being prepared. Rankings may take a little longer to appear.'}
            </p>
          )}
          <section>
            <h2>
              {owner
                ? ru
                  ? 'Ваша статистика'
                  : 'Your statistics'
                : ru
                  ? 'Статистика'
                  : 'Statistics'}
            </h2>
            {stats ? (
              <>
                {Number.isFinite(stats.total_distance_km) &&
                  (stats.total_distance_km > 0 || stats.total_flights === 0) && (
                    <>
                      <dl className="profile-hero">
                        <div>
                          <dt>{ru ? 'Расстояние' : 'Distance'}</dt>
                          <dd>{formatDistanceKm(locale, stats.total_distance_km)}</dd>
                        </div>
                      </dl>
                      <p>
                        {ru ? 'Вокруг Земли' : 'Around the world'}:{' '}
                        {formatNumber(
                          locale,
                          Math.round((stats.total_distance_km / EARTH_CIRCUMFERENCE_KM) * 10) / 10,
                        )}
                        ×
                      </p>
                    </>
                  )}
                <dl className="profile-metrics">
                  {(
                    [
                      [ru ? 'Перелёты' : 'Flights', stats.total_flights],
                      [
                        ru ? 'Страны и территории' : 'Countries and territories',
                        stats.countries_count,
                      ],
                      [ru ? 'Аэропорты' : 'Airports', stats.airports_count],
                      ...(stats.airlines_count > 0 || stats.total_flights === 0
                        ? [[ru ? 'Авиакомпании' : 'Airlines', stats.airlines_count]]
                        : []),
                      ...(Number.isFinite(stats.total_duration_minutes) &&
                      (stats.total_duration_minutes > 0 || stats.total_flights === 0)
                        ? [
                            [
                              ru ? 'В воздухе, ч' : 'Air time, h',
                              Math.round(stats.total_duration_minutes / 60),
                            ],
                          ]
                        : []),
                      ...(stats.aircraft_count > 0
                        ? [[ru ? 'Типы самолётов' : 'Aircraft types', stats.aircraft_count]]
                        : []),
                    ] as [string, number][]
                  )
                    .filter(([, value]) => Number.isFinite(value))
                    .map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{formatNumber(locale, value)}</dd>
                      </div>
                    ))}
                </dl>
                {owner &&
                  stats.total_flights > 0 &&
                  (!stats.total_distance_km ||
                    !stats.total_duration_minutes ||
                    !stats.airlines_count) && (
                    <p>
                      {ru
                        ? 'Добавьте расстояние, время в пути и авиакомпании к перелётам, чтобы дополнить статистику.'
                        : 'Add distance, duration and airlines to your flights to complete these statistics.'}
                    </p>
                  )}
                {owner && stats.aircraft_count === 0 && (
                  <p>
                    {ru
                      ? 'Добавьте тип самолёта к перелётам, чтобы увидеть эту статистику.'
                      : 'Add aircraft types to your flights to see this statistic.'}
                  </p>
                )}
              </>
            ) : (
              <p>{ru ? 'Статистика готовится.' : 'Statistics are being prepared.'}</p>
            )}
          </section>
          <section>
            <h2>{ru ? 'Достижения' : 'Achievements'}</h2>
            <Achievements badges={badges} locale={locale} />
          </section>
          <section>
            <h2>
              {owner
                ? ru
                  ? 'Ваше место'
                  : 'Your place'
                : ru
                  ? 'Место в рейтинге'
                  : 'Leaderboard place'}
            </h2>
            {data.rankings.length ? (
              <ul>
                {data.rankings.map((rank) => (
                  <li key={rank.category}>
                    {categoryName(rank.category, locale)}: #{rank.rank}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {owner
                  ? ru
                    ? 'Рейтинг появится после пяти перелётов, если профиль открыт и включено участие.'
                    : 'Rankings appear after five flights with a public profile and participation enabled.'
                  : ru
                    ? 'Публичного места в рейтинге пока нет.'
                    : 'No public ranking yet.'}
              </p>
            )}
            <Link href="/leaderboard">{ru ? 'Открыть рейтинг' : 'View leaderboard'}</Link>
          </section>
        </>
      )}
      {!viewer && data.profile.is_public && (
        <footer className="profile-join">
          <p>{ru ? 'Соберите свой паспорт путешествий.' : 'Build your own travel passport.'}</p>
          <Link href="/signup">
            {ru ? 'Начните свой журнал перелётов' : 'Start your own flight journal'}
          </Link>
        </footer>
      )}
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
