import Link from 'next/link'
import { Car, Train } from '@keyline-icons/react'
import { requireOnboardedMember } from '../../../../server/gates'
import { pageMetadata } from '../../../../server/metadata'
import { getRequestLocale } from '../../../../server/locale'
import { IdentitySnapshot } from '../../../../client/activity'
import { JourneyFormWithOcr } from '../../../../client/ground/form/ocr/with-ocr'
import { safeReturn } from '../../../../client/ground/form/return-context'
import '../../../../client/ground/form/ground-form.css'

export const generateMetadata = () => pageMetadata('New journey', 'Новое путешествие')
export default async function NewJourney({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [own, locale, params] = await Promise.all([
    requireOnboardedMember(),
    getRequestLocale(),
    searchParams,
  ])
  const ru = locale === 'ru'
  const mode = params.mode === 'rail' || params.mode === 'road' ? params.mode : null
  const returnTo = safeReturn(params.return)
  const keep = returnTo.includes('?') ? `&return=${encodeURIComponent(returnTo.split('?')[1])}` : ''
  return (
    <IdentitySnapshot ownerId={own.ownerId}>
      <div className="page-heading">
        <p className="eyebrow">{ru ? 'Наземные путешествия' : 'Ground travel'}</p>
        <h1>
          {mode === 'rail'
            ? ru
              ? 'Новая поездка на поезде'
              : 'New train journey'
            : mode === 'road'
              ? ru
                ? 'Новый роуд-трип'
                : 'New road trip'
              : ru
                ? 'Новое путешествие'
                : 'New journey'}
        </h1>
      </div>
      {mode ? (
        <JourneyFormWithOcr
          key={mode}
          ownerId={own.ownerId}
          locale={locale}
          mode={mode}
          returnTo={returnTo}
        />
      ) : (
        <nav className="gt-choose" aria-label={ru ? 'Вид путешествия' : 'Kind of journey'}>
          <p className="gt-muted">
            {ru ? 'Сначала выберите вид путешествия.' : 'Choose the kind of journey first.'}
          </p>
          <ul>
            <li>
              <Link href={`/ground-travel/new?mode=rail${keep}`}>
                <Train size={20} aria-hidden="true" />
                {ru ? 'Поезд' : 'Train'}
              </Link>
            </li>
            <li>
              <Link href={`/ground-travel/new?mode=road${keep}`}>
                <Car size={20} aria-hidden="true" />
                {ru ? 'Авто' : 'Road trip'}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </IdentitySnapshot>
  )
}
