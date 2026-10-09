import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getOwnJournalAll } from '../../../server/journal'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import { requireOnboardedMember } from '../../../server/gates'
import { IdentitySnapshot } from '../../../client/activity'
import { ReadFreshness } from '../../../client/freshness'
import { JournalStoreProvider } from '../../../client/journal/store'
import { JournalShell } from '../../../client/journal/journal-page'
import { LedgerSkeleton } from '../../../client/journal/ledger-skeleton'
import '../../reads.css'

type SearchParams = Record<string, string | string[] | undefined>

/** The raw query as the browser sent it. The client codec (`client/journal/url.ts`) owns parsing; the URL is a mirror (spec D4). */
function rawQuery(params: SearchParams) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item)
  return query.toString()
}

async function JournalData({ initialQuery }: { initialQuery: string }) {
  const [owned, locale] = await Promise.all([getOwnJournalAll(), getRequestLocale()])
  if (!owned) redirect('/signin')
  const { ownerId, data } = owned
  return <IdentitySnapshot ownerId={ownerId}><ReadFreshness ownerId={ownerId} revision={data.revision} publishedRevision={data.publishedRevision} derivedState={data.derivedState} locale={locale} />
    <JournalStoreProvider key={ownerId} ownerId={ownerId} locale={locale} initial={data} initialQuery={initialQuery}><JournalShell ownerId={ownerId} locale={locale} /></JournalStoreProvider></IdentitySnapshot>
}
export const generateMetadata = () => pageMetadata('Journal', 'Журнал')
export default async function Journal({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOnboardedMember()
  const [params, locale] = await Promise.all([searchParams, getRequestLocale()])
  return <Suspense fallback={<LedgerSkeleton locale={locale} />}><JournalData initialQuery={rawQuery(params)} /></Suspense>
}
