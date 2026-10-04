import { redirect } from 'next/navigation'
import { getOwnProfile } from '../../server/profile'
import { IdentitySnapshot } from '../../client/activity'
import { getRequestLocale } from '../../server/locale'
import { OnboardingName } from '../../client/public/onboarding-name'

export async function generateMetadata() { return { title: (await getRequestLocale()) === 'ru' ? 'Добро пожаловать — Kuuki' : 'Welcome — Kuuki' } }
export default async function Onboarding() {
  const [own, locale] = await Promise.all([getOwnProfile(), getRequestLocale()])
  const ru = locale === 'ru'
  if (!own) redirect('/signin')
  return <IdentitySnapshot ownerId={own.ownerId}><div className="onboarding-page"><p className="eyebrow">{ru ? '1 / 3 · Ваш профиль' : '1 / 3 · Your profile'}</p><h1>{ru ? 'Сделайте журнал своим' : 'Make this journal yours'}</h1><p className="lead">{ru ? 'Выберите имя для вашего профиля. Его можно оставить скрытым в настройках.' : 'Choose a name people can use to find your public profile. You can keep the profile private in Settings.'}</p><OnboardingName username={own.profile.username ?? ''} displayName={own.profile.display_name ?? ''} locale={locale} />
    <div className="onboarding-next"><p className="eyebrow">{ru ? '2 / 3 · Первые перелёты' : '2 / 3 · First flights'}</p><h2>{ru ? 'Добавьте первый перелёт' : 'Add your first flight'}</h2><p>{ru ? 'Введите рейс вручную или импортируйте посадочный талон. Журнал обновится после сохранения.' : 'Enter a flight or import a boarding pass. Your journal updates after each save.'}</p><a className="button secondary" href="/add">{ru ? 'Добавить перелёт' : 'Add a flight'}</a><a className="button secondary" href="/import">{ru ? 'Импортировать документ' : 'Import a document'}</a></div>
    <div className="onboarding-next"><p className="eyebrow">{ru ? '3 / 3 · Результат' : '3 / 3 · Reveal'}</p><h2>{ru ? 'Посмотрите свой путь' : 'See your story'}</h2><p>{ru ? 'Обзор и Паспорт покажут сохранённые перелёты и страны.' : 'Your Overview and Passport will show the flights and places you saved.'}</p><a className="button primary" href="/overview">{ru ? 'Перейти в Обзор' : 'Go to Overview'}</a><p><a href="/settings">{ru ? 'Настройки' : 'Settings'}</a></p></div></div></IdentitySnapshot>
}
