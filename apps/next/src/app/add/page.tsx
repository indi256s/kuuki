import { redirect } from 'next/navigation'
import { getRequestIdentity } from '../../server/identity'
import { getRequestLocale } from '../../server/locale'
import { IdentitySnapshot } from '../../client/activity'
import { FlightForm } from '../../client/capture/flight-form'

export default async function AddFlight() {
  const [identity, locale] = await Promise.all([getRequestIdentity(), getRequestLocale()])
  if (!identity) redirect('/signin')
  return <IdentitySnapshot ownerId={identity.id}><div className="page-heading"><p className="eyebrow">{locale === 'ru' ? 'Журнал' : 'Journal'}</p><h1>{locale === 'ru' ? 'Новый перелёт' : 'Add a flight'}</h1></div><FlightForm ownerId={identity.id} locale={locale} /></IdentitySnapshot>
}
