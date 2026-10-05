import Link from 'next/link'
import { Suspense } from 'react'
import { getPublicProfile } from '../../../../server/public'
import { getOptionalPublicViewer } from '../../../../server/identity'
import { getOwnProfile, getOwnProfileStats } from '../../../../server/profile'
import { getRequestLocale } from '../../../../server/locale'
import { pageMetadata } from '../../../../server/metadata'
import { IdentitySnapshot } from '../../../../client/activity'

export const generateMetadata = () => pageMetadata('Profile', 'Профиль')
async function ProfileData({ username }: { username: string }) {
  const [data, viewer, locale] = await Promise.all([getPublicProfile(username), getOptionalPublicViewer(), getRequestLocale()])
  const ru = locale === 'ru'
  if (!data) return <section className="public-state"><h1>{ru ? 'Профиль не найден' : 'Profile not found'}</h1><p>{ru ? 'Возможно, профиль перемещён или удалён.' : 'This profile may have moved or may no longer exist.'}</p><Link href="/">{ru ? 'На главную' : 'Go home'}</Link></section>
  const owner = viewer?.id === data.profile.id
  const own = owner && !data.profile.is_public ? await getOwnProfile() : null
  const privateStats = owner && !data.profile.is_public ? await getOwnProfileStats(data.profile.id) : null
  const name = !data.profile.is_public ? owner ? own?.profile.display_name || own?.profile.username || (ru ? 'Мой профиль' : 'My profile') : (ru ? 'Скрытый профиль' : 'Private profile') : data.profile.display_name || data.profile.username || (ru ? 'Участник Kuuki' : 'Kuuki member')
  const content = <article className="public-profile"><div className="profile-head"><span className="avatar" aria-hidden>{name.slice(0, 1).toUpperCase()}</span><div><p className="eyebrow">{ru ? 'Профиль путешественника' : 'Flight profile'}</p><h1>{name}</h1>{(owner || data.profile.is_public) && <p className="handle">@{data.profile.username}</p>}</div></div>
    {owner && <div className="profile-actions"><Link href="/settings">{ru ? 'Настройки' : 'Settings'}</Link><Link href="/leaderboard">{ru ? 'Рейтинг' : 'Leaderboard'}</Link><a href="/settings">{ru ? 'Редактировать профиль' : 'Edit profile'}</a></div>}
    {!data.profile.is_public ? <><p className="status-note" role="status">{owner ? (ru ? 'Ваш профиль скрыт. Другие видят только это сообщение. Измените видимость в настройках.' : 'Your profile is private. Others see only this message. Change visibility in Settings.') : (ru ? 'Этот профиль скрыт.' : 'This profile is private.')}</p>{owner && privateStats && <section><h2>{ru ? 'Ваша статистика' : 'Your statistics'}</h2><dl className="profile-stats"><div><dt>{ru ? 'Перелёты' : 'Flights'}</dt><dd>{privateStats.total_flights}</dd></div><div><dt>{ru ? 'Страны' : 'Countries'}</dt><dd>{privateStats.countries_count}</dd></div><div><dt>{ru ? 'Расстояние' : 'Distance'}</dt><dd>{new Intl.NumberFormat(locale).format(privateStats.total_distance_km)} {ru ? 'км' : 'km'}</dd></div></dl></section>}</> : <>
      {data.derivedState === 'pending' && <p role="status">{ru ? 'Недавние изменения обрабатываются. Рейтинг может появиться позже.' : 'Recent changes are being prepared. Rankings may take a little longer to appear.'}</p>}
      {data.profile.bio && <p className="profile-bio">{data.profile.bio}</p>}
      <section><h2>{ru ? 'Статистика' : 'Statistics'}</h2>{data.stats ? <dl className="profile-stats"><div><dt>{ru ? 'Перелёты' : 'Flights'}</dt><dd>{data.stats.total_flights}</dd></div><div><dt>{ru ? 'Страны' : 'Countries'}</dt><dd>{data.stats.countries_count}</dd></div><div><dt>{ru ? 'Расстояние' : 'Distance'}</dt><dd>{new Intl.NumberFormat(locale).format(data.stats.total_distance_km)} {ru ? 'км' : 'km'}</dd></div></dl> : <p>{ru ? 'Статистика готовится.' : 'Statistics are being prepared.'}</p>}</section>
      <section><h2>{ru ? 'Достижения' : 'Achievements'}</h2>{data.badges.length ? <ul className="badge-list">{data.badges.map(item => <li key={item.id}><strong>{item.badge.name}</strong><span>{item.badge.description}</span></li>)}</ul> : <p>{ru ? 'Достижений пока нет.' : 'No achievements yet.'}</p>}</section>
      <section><h2>{ru ? 'Рейтинг' : 'Leaderboard'}</h2>{data.rankings.length ? <ul>{data.rankings.map(rank => <li key={rank.category}>{({ cities: ru ? 'Аэропорты' : 'Airports', flights: ru ? 'Перелёты' : 'Flights', distance: ru ? 'Расстояние' : 'Distance', countries: ru ? 'Страны' : 'Countries', airlines: ru ? 'Авиакомпании' : 'Airlines' } as Record<string, string>)[rank.category] ?? rank.category}: #{rank.rank}</li>)}</ul> : <p>{owner ? (ru ? 'Рейтинг появится после пяти перелётов, если включено участие.' : 'Rankings appear after five flights when participation is enabled.') : (ru ? 'Публичного места в рейтинге пока нет.' : 'No public ranking yet.')}</p>}<Link href="/leaderboard">{ru ? 'Открыть рейтинг' : 'View leaderboard'}</Link></section>
    </>}
    {!viewer && data.profile.is_public && <p className="profile-join"><Link href="/signup">{ru ? 'Начните свой журнал перелётов' : 'Start your own flight journal'}</Link></p>}
  </article>
  return owner ? <IdentitySnapshot ownerId={data.profile.id}>{content}</IdentitySnapshot> : content
}
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, locale] = await Promise.all([params, getRequestLocale()])
  return <Suspense fallback={<p role="status">{locale === 'ru' ? 'Загружаем профиль…' : 'Loading profile…'}</p>}><ProfileData username={username} /></Suspense>
}
