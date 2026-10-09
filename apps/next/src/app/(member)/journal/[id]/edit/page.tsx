import { notFound } from 'next/navigation'
import { requireOnboardedMember } from '../../../../../server/gates'
import { pageMetadata } from '../../../../../server/metadata'
import { getRequestLocale } from '../../../../../server/locale'
import { IdentitySnapshot } from '../../../../../client/activity'
import { FlightDetailSheet } from '../../../../../client/capture/flight-panels'

export const generateMetadata = () => pageMetadata('Edit flight', 'Изменить перелёт')
export default async function EditFlight({ params }: { params: Promise<{ id: string }> }) {
  const [own, locale, { id }] = await Promise.all([
    requireOnboardedMember(),
    getRequestLocale(),
    params,
  ])
  const identity = { id: own.ownerId }
  const flightId = Number(id)
  if (!Number.isSafeInteger(flightId) || flightId <= 0) notFound()
  return (
    <IdentitySnapshot ownerId={identity.id}>
      <div className="page-heading">
        <p className="eyebrow">{locale === 'ru' ? 'Журнал' : 'Journal'}</p>
        <h1>{locale === 'ru' ? 'Изменить перелёт' : 'Edit flight'}</h1>
      </div>
      <FlightDetailSheet ownerId={identity.id} locale={locale} flightId={flightId} initialEditing />
    </IdentitySnapshot>
  )
}
