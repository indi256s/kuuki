import { redirect, notFound } from 'next/navigation'
import { getRequestIdentity } from '../../../../server/identity'
import { getRequestLocale } from '../../../../server/locale'
import { IdentitySnapshot } from '../../../../client/activity'
import { FlightForm } from '../../../../client/capture/flight-form'

export default async function EditFlight({ params }: { params: Promise<{ id: string }> }) {
  const [identity, locale, { id }] = await Promise.all([getRequestIdentity(), getRequestLocale(), params])
  if (!identity) redirect('/signin')
  const flightId = Number(id)
  if (!Number.isSafeInteger(flightId) || flightId <= 0) notFound()
  return <IdentitySnapshot ownerId={identity.id}><div className="page-heading"><p className="eyebrow">{locale === 'ru' ? 'Журнал' : 'Journal'}</p><h1>{locale === 'ru' ? 'Изменить перелёт' : 'Edit flight'}</h1></div><FlightForm ownerId={identity.id} locale={locale} editId={flightId} /></IdentitySnapshot>
}
