import { redirect } from 'next/navigation'
import { getGateProfile, hasSavedFlight } from '../../../server/gates'
import { getProfileShareUrl } from '../../../server/profile'
import { pageMetadata } from '../../../server/metadata'
import { IdentitySnapshot } from '../../../client/activity'
import { getRequestLocale } from '../../../server/locale'
import { OnboardingName } from '../../../client/public/onboarding-name'
import { OnboardingFlow } from '../../../client/public/onboarding-flow'
import { normalizeOnboardingQuery, normalizeImportQuery, withQuery } from '../../../lib/url-state'
import '../../../client/public/onboarding.css'

export const generateMetadata = () => pageMetadata('Welcome', 'Добро пожаловать')
export default async function Onboarding({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [own, locale, query] = await Promise.all([getGateProfile(), getRequestLocale(), searchParams])
  if (!own) redirect('/signin')
  const ru = locale === 'ru'
  const hasUsername = !!own.profile.username
  const normalized = normalizeOnboardingQuery(query, { hasUsername, hasFlight: hasUsername && await hasSavedFlight(own.ownerId) })
  const importQuery = normalizeImportQuery(new URLSearchParams(normalized.query))
  if (!normalized.canonical || !importQuery.canonical) redirect(withQuery('/onboarding', importQuery.query))
  const step = normalized.state.step
  return <IdentitySnapshot ownerId={own.ownerId}><div className="onboarding-flow">
    <ol className="onboarding-progress" aria-label={ru ? 'Шаги знакомства' : 'Getting started steps'}>{(['name', 'capture', 'reveal'] as const).map((value, index) => <li key={value} aria-current={step === value ? 'step' : undefined}><span>{index + 1}</span> {({ name: ru ? 'Имя' : 'Name', capture: ru ? 'Перелёты' : 'Capture', reveal: ru ? 'Результат' : 'Reveal' })[value]}</li>)}</ol>
    {step === 'name' ? <><h1>{ru ? 'Сделайте журнал своим' : 'Make this journal yours'}</h1><p>{ru ? 'Выберите имя. Видимость профиля можно изменить в настройках.' : 'Choose a name. You can change profile visibility in Settings.'}</p><OnboardingName ownerId={own.ownerId} username={own.profile.username ?? ''} displayName={own.profile.display_name ?? ''} profileUrl={await getProfileShareUrl(own.profile.username ?? 'your-name')} locale={locale} /></>
      : <OnboardingFlow key={own.ownerId} ownerId={own.ownerId} locale={locale} step={step} batchId={importQuery.state.batch} source={importQuery.state.source} />}
  </div></IdentitySnapshot>
}
