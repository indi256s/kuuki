import Link from 'next/link'
import { Suspense } from 'react'
import { getLeaderboard, getOwnLeaderboardEligibility } from '../../../server/public'
import { getOptionalPublicViewer } from '../../../server/identity'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import { IdentitySnapshot } from '../../../client/activity'
import { leaderboardCategories, type LeaderboardCategory } from '../../../../../../functions/api/_services/publicLeaderboard'

const names: Record<LeaderboardCategory, [string, string]> = { flights: ['Flights', 'Перелёты'], distance: ['Distance', 'Расстояние'], countries: ['Countries', 'Страны'], cities: ['Airports', 'Аэропорты'], airlines: ['Airlines', 'Авиакомпании'] }
export const generateMetadata = () => pageMetadata('Leaderboard', 'Рейтинг')
async function Ranking({ category }: { category: LeaderboardCategory }) {
  const [{ entries, total, updatedAt }, identity, locale] = await Promise.all([getLeaderboard(category), getOptionalPublicViewer(), getRequestLocale()])
  const eligibility = identity ? await getOwnLeaderboardEligibility() : null
  const ru = locale === 'ru'
  const label = names[category][ru ? 1 : 0]
  const published = updatedAt && Number.isFinite(Date.parse(updatedAt)) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(updatedAt)) : null
  return <section className="ranking-list"><p className="ranking-caption">{ru ? `Рейтинг: ${label.toLowerCase()}. Для участия нужно от 5 перелётов.` : `Ranked by ${label.toLowerCase()}. At least 5 flights required.`}</p>
    {published && <p className="ranking-caption">{ru ? `Опубликовано: ${published}` : `Published: ${published}`}</p>}
    {entries.length ? <ol>{entries.map(entry => <li key={entry.user_id} className={identity?.id === entry.user_id ? 'own-rank' : ''}><span className="rank">#{entry.rank}</span><span>{entry.username ? <Link href={`/fly/${encodeURIComponent(entry.username)}`}>{entry.display_name || `@${entry.username}`}</Link> : entry.display_name || (ru ? 'Участник' : 'Member')}</span><strong>{new Intl.NumberFormat(locale).format(entry.value)}{category === 'distance' ? (ru ? ' км' : ' km') : ''}</strong></li>)}</ol> : <p>{ru ? 'Опубликованного рейтинга в этой категории пока нет.' : 'No published ranking is available in this category yet.'}</p>}
    {total > entries.length && <p>{ru ? `Показано ${entries.length} из ${total}.` : `Showing ${entries.length} of ${total} members.`}</p>}
    {!identity && <p><Link href="/signin">{ru ? 'Войдите' : 'Sign in'}</Link>{ru ? ', чтобы участвовать.' : ' to participate.'}</p>}
    {identity && eligibility && <IdentitySnapshot ownerId={eligibility.ownerId}><p role="status">{eligibility.status.pending
      ? ru ? 'Ваши последние изменения ещё обрабатываются. Место в рейтинге может обновиться позже.' : 'Your recent changes are still being prepared. Your rank may update later.'
      : !eligibility.status.isPublic ? ru ? 'Откройте профиль, чтобы участвовать в рейтинге.' : 'Make your profile public to join the leaderboard.'
      : !eligibility.status.optedIn ? ru ? 'Включите участие в рейтинге в настройках.' : 'Turn on leaderboard participation in Settings.'
      : eligibility.status.totalFlights < 5 ? ru ? `До участия осталось ${5 - eligibility.status.totalFlights} перелётов.` : `${5 - eligibility.status.totalFlights} more flights to join.`
      : ru ? 'Вы участвуете в рейтинге.' : 'You are eligible for the leaderboard.'}</p><p><Link href="/settings">{ru ? 'Настроить участие в рейтинге' : 'Manage leaderboard participation'}</Link></p></IdentitySnapshot>}
  </section>
}
export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [query, locale] = await Promise.all([searchParams, getRequestLocale()])
  const ru = locale === 'ru'
  const category = leaderboardCategories.includes(query.category as LeaderboardCategory) ? query.category as LeaderboardCategory : 'flights'
  return <div className="leaderboard-page"><p className="eyebrow">{ru ? 'Сообщество' : 'The community'}</p><h1>{ru ? 'Рейтинг' : 'Leaderboard'}</h1><nav aria-label={ru ? 'Категории рейтинга' : 'Leaderboard categories'} className="category-tabs">{leaderboardCategories.map(value => <Link key={value} href={`/leaderboard?category=${value}`} aria-current={value === category ? 'page' : undefined}>{names[value][ru ? 1 : 0]}</Link>)}</nav><Suspense key={category} fallback={<p role="status">{ru ? 'Загружаем рейтинг…' : 'Loading rankings…'}</p>}><Ranking category={category} /></Suspense></div>
}
