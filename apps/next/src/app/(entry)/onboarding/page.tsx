import { redirect } from 'next/navigation'
import { getGateProfile, hasSavedFlight } from '../../../server/gates'
import { pageMetadata } from '../../../server/metadata'
import { IdentitySnapshot } from '../../../client/activity'
import { getRequestLocale } from '../../../server/locale'
import { OnboardingName } from '../../../client/public/onboarding-name'
import { normalizeOnboardingQuery, withQuery, type OnboardingStep } from '../../../lib/url-state'

export const generateMetadata = () => pageMetadata('Welcome', 'Добро пожаловать')

function Placeholder({ step, ru }: { step: Exclude<OnboardingStep, 'name'>; ru: boolean }) {
  return step === 'capture'
    ? <div className="onboarding-page"><p className="eyebrow">{ru ? '2 / 3 · Первые перелёты' : '2 / 3 · First flights'}</p><h1>{ru ? 'Добавьте первый перелёт' : 'Add your first flight'}</h1><div className="actions"><a className="button secondary" href="/add">{ru ? 'Добавить перелёт' : 'Add a flight'}</a><a className="button secondary" href="/import">{ru ? 'Импортировать документ' : 'Import a document'}</a></div></div>
    : <div className="onboarding-page"><p className="eyebrow">{ru ? '3 / 3 · Результат' : '3 / 3 · Reveal'}</p><h1>{ru ? 'Посмотрите свой путь' : 'See your story'}</h1><div className="actions"><a className="button primary" href="/overview">{ru ? 'Перейти в Обзор' : 'Go to Overview'}</a></div></div>
}
export default async function Onboarding({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [own, locale, query] = await Promise.all([getGateProfile(), getRequestLocale(), searchParams])
  const ru = locale === 'ru'
  if (!own) redirect('/signin')
  const hasUsername = !!own.profile.username
  const normalized = normalizeOnboardingQuery(query, { hasUsername, hasFlight: hasUsername && await hasSavedFlight(own.ownerId) })
  if (!normalized.canonical) redirect(withQuery('/onboarding', normalized.query))
  if (normalized.state.step !== 'name') return <IdentitySnapshot ownerId={own.ownerId}><Placeholder step={normalized.state.step} ru={ru} /></IdentitySnapshot>
  return <IdentitySnapshot ownerId={own.ownerId}><div className="onboarding-page"><p className="eyebrow">{ru ? '1 / 3 · Ваш профиль' : '1 / 3 · Your profile'}</p><h1>{ru ? 'Сделайте журнал своим' : 'Make this journal yours'}</h1><p className="lead">{ru ? 'Выберите имя для вашего профиля. Его можно оставить скрытым в настройках.' : 'Choose a name people can use to find your public profile. You can keep the profile private in Settings.'}</p><OnboardingName username={own.profile.username ?? ''} displayName={own.profile.display_name ?? ''} locale={locale} />
    <div className="onboarding-next"><p className="eyebrow">{ru ? '2 / 3 · Первые перелёты' : '2 / 3 · First flights'}</p><h2>{ru ? 'Добавьте первый перелёт' : 'Add your first flight'}</h2><p>{ru ? 'Введите рейс вручную или импортируйте посадочный талон. Журнал обновится после сохранения.' : 'Enter a flight or import a boarding pass. Your journal updates after each save.'}</p><a className="button secondary" href="/add">{ru ? 'Добавить перелёт' : 'Add a flight'}</a><a className="button secondary" href="/import">{ru ? 'Импортировать документ' : 'Import a document'}</a></div>
    <div className="onboarding-next"><p className="eyebrow">{ru ? '3 / 3 · Результат' : '3 / 3 · Reveal'}</p><h2>{ru ? 'Посмотрите свой путь' : 'See your story'}</h2><p>{ru ? 'Обзор и Паспорт покажут сохранённые перелёты и страны.' : 'Your Overview and Passport will show the flights and places you saved.'}</p><a className="button primary" href="/overview">{ru ? 'Перейти в Обзор' : 'Go to Overview'}</a><p><a href="/settings">{ru ? 'Настройки' : 'Settings'}</a></p></div></div></IdentitySnapshot>
}
