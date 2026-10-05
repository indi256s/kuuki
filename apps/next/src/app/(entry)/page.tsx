import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMemberLanding } from '../../server/gates'
import { getRequestLocale } from '../../server/locale'
import { LandingSamples } from '../../client/public/landing-samples'
import '../../client/public/onboarding.css'

export async function generateMetadata() { return { title: (await getRequestLocale()) === 'ru' ? 'Kuuki — журнал перелётов' : 'Kuuki — flight journal' } }
export default async function Home({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams
  if (mode === 'signin') redirect('/signin')
  if (mode === 'signup') redirect('/signup')
  const landing = await getMemberLanding()
  if (landing) redirect(landing)
  const ru = (await getRequestLocale()) === 'ru'
  return <div className="landing"><div className="landing-hero"><p className="eyebrow">{ru ? 'Место для каждого путешествия' : 'A place for every journey'}</p><h1>{ru ? <>Всё, где вы были,<br />остаётся с вами.</> : <>Where you’ve been<br />stays with you.</>}</h1><p className="lead">{ru ? 'Соберите перелёты в одном журнале, сохраняйте места и делитесь только тем, чем хотите.' : 'Keep your flights together, collect the places they took you, and share only what you choose.'}</p><div className="actions"><Link className="button primary" href="/signup">{ru ? 'Создать аккаунт' : 'Create an account'}</Link><Link className="button secondary" href="/signin">{ru ? 'Войти' : 'Sign in'}</Link></div></div>
    <LandingSamples locale={ru ? 'ru' : 'en'} />
    <section className="landing-faq"><h2>{ru ? 'Что такое Kuuki?' : 'What is Kuuki?'}</h2><p>{ru ? 'Личный журнал перелётов. Добавляйте рейсы вручную или с посадочного талона, изучайте маршруты и страны. Профиль можно открыть другим, когда вы сами решите.' : 'A private flight journal. Add flights by hand or import a boarding pass, then explore your routes and places. A profile can be shared when you choose to make it public.'}</p><h2>{ru ? 'Кто видит мои поездки?' : 'Who sees my journeys?'}</h2><p>{ru ? 'Вы решаете, будет ли профиль публичным и появитесь ли вы в рейтинге. Эти настройки можно изменить в любой момент.' : 'Your account controls whether your profile is public and whether you appear in the leaderboard. You can change those choices in Settings.'}</p></section>
  </div>
}
