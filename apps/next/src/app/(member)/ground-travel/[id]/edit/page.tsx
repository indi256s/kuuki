import { notFound } from 'next/navigation'
import { isUuid } from '@kuuki/shared/groundTravel'
import { requireOnboardedMember } from '../../../../../server/gates'
import { pageMetadata } from '../../../../../server/metadata'
import { getRequestLocale } from '../../../../../server/locale'
import { IdentitySnapshot } from '../../../../../client/activity'
import { EditJourneyWithOcr } from '../../../../../client/ground/form/ocr/with-ocr'
import { safeReturn } from '../../../../../client/ground/form/return-context'
import '../../../../../client/ground/form/ground-form.css'

export const generateMetadata = () => pageMetadata('Edit journey', 'Правка путешествия')
export default async function EditJourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [own, locale, { id }, query] = await Promise.all([
    requireOnboardedMember(),
    getRequestLocale(),
    params,
    searchParams,
  ])
  if (!isUuid(id)) notFound()
  const complete = query.complete === '1'
  const ru = locale === 'ru'
  return (
    <IdentitySnapshot ownerId={own.ownerId}>
      <div className="page-heading">
        <p className="eyebrow">{ru ? 'Наземные путешествия' : 'Ground travel'}</p>
        <h1>
          {complete
            ? ru
              ? 'Завершение путешествия'
              : 'Complete journey'
            : ru
              ? 'Правка путешествия'
              : 'Edit journey'}
        </h1>
      </div>
      <EditJourneyWithOcr
        ownerId={own.ownerId}
        locale={locale}
        id={id.toLowerCase()}
        complete={complete}
        returnTo={safeReturn(query.return)}
      />
    </IdentitySnapshot>
  )
}
