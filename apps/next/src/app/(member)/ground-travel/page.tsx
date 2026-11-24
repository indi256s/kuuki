import { pageMetadata } from '../../../server/metadata'
import { requireOnboardedMember } from '../../../server/gates'
import { getRequestLocale } from '../../../server/locale'
import { IdentitySnapshot } from '../../../client/activity'
import { GroundTravelPage } from '../../../client/ground/ground-page'
import '../../reads.css'

type SearchParams = Record<string, string | string[] | undefined>

function rawQuery(params: SearchParams) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
      query.append(key, item)
  return query.toString()
}

export const generateMetadata = () => pageMetadata('Journal · Ground', 'Журнал · По земле')

export default async function GroundTravel({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const own = await requireOnboardedMember()
  const [params, locale] = await Promise.all([searchParams, getRequestLocale()])
  return (
    <IdentitySnapshot ownerId={own.ownerId}>
      <GroundTravelPage
        key={own.ownerId}
        ownerId={own.ownerId}
        locale={locale}
        initialQuery={rawQuery(params)}
      />
    </IdentitySnapshot>
  )
}
