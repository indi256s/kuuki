import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getOwnPassport } from '../../../server/passport'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import { requireOnboardedMember } from '../../../server/gates'
import { normalizePassportQuery, withQuery } from '../../../lib/url-state'
import { isCatalogCountry } from '../../../client/passport/model'
import { IdentitySnapshot } from '../../../client/activity'
import { ReadFreshness } from '../../../client/freshness'
import { PassportView } from '../../../client/reads/passport'
import type { OverviewPeriod } from '../../../../../../packages/shared/src/overview'
import '../../reads.css'

async function PassportData({ period }: {period?: OverviewPeriod}) {
  const [owned, locale] = await Promise.all([getOwnPassport(), getRequestLocale()])
  if (!owned) redirect('/signin')
  return <IdentitySnapshot ownerId={owned.ownerId}><ReadFreshness ownerId={owned.ownerId} revision={owned.data.revision} publishedRevision={owned.data.publishedRevision} derivedState={owned.data.derivedState} locale={locale} /><PassportView ownerId={owned.ownerId} locale={locale} initial={owned.data} period={period} /></IdentitySnapshot>
}
export const generateMetadata = () => pageMetadata('Passport', 'Паспорт')
export default async function Passport({ searchParams }: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  await requireOnboardedMember()
  const locale = await getRequestLocale()
  const normalized = normalizePassportQuery(await searchParams, isCatalogCountry)
  if (!normalized.canonical) redirect(withQuery('/passport', normalized.query))
  const period = (normalized.state.year ?? undefined) as OverviewPeriod | undefined
  return <><div className="page-heading"><h1>{locale === 'ru' ? 'Паспорт' : 'Passport'}</h1></div><Suspense fallback={<p className="loading" data-testid="passport-loading" role="status">{locale === 'ru' ? 'Загружаем паспорт…' : 'Loading passport…'}</p>}><PassportData period={period} /></Suspense></>
}
