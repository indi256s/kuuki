import { requireOnboardedMember } from '../../../server/gates'
import { pageMetadata } from '../../../server/metadata'
import { getRequestLocale } from '../../../server/locale'
import { IdentitySnapshot } from '../../../client/activity'
import { FlightCaptureDialog } from '../../../client/capture/flight-panels'

export const generateMetadata = () => pageMetadata('Add a flight', 'Новый перелёт')
export default async function AddFlight() {
  const [own, locale] = await Promise.all([requireOnboardedMember(), getRequestLocale()])
  const identity = { id: own.ownerId }
  return <IdentitySnapshot ownerId={identity.id}><div className="page-heading"><p className="eyebrow">{locale === 'ru' ? 'Журнал' : 'Journal'}</p><h1>{locale === 'ru' ? 'Новый перелёт' : 'Add a flight'}</h1></div><FlightCaptureDialog ownerId={identity.id} locale={locale} /></IdentitySnapshot>
}
