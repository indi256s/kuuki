import { notFound, redirect } from 'next/navigation'
import { requireOnboardedMember } from '../../../../server/gates'
import { getRequestLocale } from '../../../../server/locale'
import { airportEntry, airportQuery } from '../../../../server/airport-models'
import { airportCatalog } from '../../../../lib/airport-models/catalog.generated'
import { IdentitySnapshot } from '../../../../client/activity'
import { AirportScreen } from '../../../../client/airport-models/airport-screen'
import { pageMetadata } from '../../../../server/metadata'

export const generateMetadata = () => pageMetadata('Airport', 'Аэропорт')
export default async function AirportPage({
  params,
  searchParams,
}: {
  params: Promise<{ iata: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const own = await requireOnboardedMember()
  const { iata } = await params
  if (!/^[a-z]{3}$/i.test(iata)) notFound()
  const entry = airportEntry(iata.toUpperCase())
  if (!entry) notFound()
  const query = await searchParams
  if (iata !== entry.iata) {
    const preserved = new URLSearchParams()
    for (const key of ['scope', 'back', 'compare']) {
      const value = query[key]
      for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
        preserved.append(key, item)
    }
    redirect(`/airports/${entry.iata}${preserved.size ? `?${preserved}` : ''}`)
  }
  return (
    <IdentitySnapshot ownerId={own.ownerId}>
      <AirportScreen
        key={`${own.ownerId}:${entry.iata}`}
        entry={entry}
        catalog={airportCatalog}
        ownerId={own.ownerId}
        locale={await getRequestLocale()}
        {...airportQuery(query)}
      />
    </IdentitySnapshot>
  )
}
