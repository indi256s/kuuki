import { LocaleText } from '../../../client/locale-text'
import { requireOnboardedMember } from '../../../server/gates'
import { pageMetadata } from '../../../server/metadata'
import { getRequestLocale } from '../../../server/locale'
import { IdentitySnapshot } from '../../../client/activity'
import { FlightCaptureDialog } from '../../../client/capture/flight-panels'

export const generateMetadata = () => pageMetadata('Add a flight', 'Новый перелёт')
export default async function AddFlight({
  searchParams,
}: {
  searchParams: Promise<{ passportVisit?: string | string[] }>
}) {
  const [own, locale, params] = await Promise.all([
    requireOnboardedMember(),
    getRequestLocale(),
    searchParams,
  ])
  const passportVisitId =
    typeof params.passportVisit === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(params.passportVisit)
      ? params.passportVisit
      : undefined
  const identity = { id: own.ownerId }
  return (
    <IdentitySnapshot ownerId={identity.id}>
      <div className="page-heading mobile-sr-only">
        <p className="eyebrow">
          <LocaleText locale={locale} en="Journal" ru="Журнал" />
        </p>
        <h1>
          <LocaleText locale={locale} en="Add a flight" ru="Новый перелёт" />
        </h1>
      </div>
      <FlightCaptureDialog
        key={passportVisitId ?? 'new'}
        ownerId={identity.id}
        locale={locale}
        passportVisitId={passportVisitId}
      />
    </IdentitySnapshot>
  )
}
