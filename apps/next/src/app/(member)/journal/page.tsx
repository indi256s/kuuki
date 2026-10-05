import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getOwnJournal } from '../../../server/journal'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import { requireOnboardedMember } from '../../../server/gates'
import { normalizeJournalQuery, withQuery } from '../../../lib/url-state'
import { IdentitySnapshot } from '../../../client/activity'
import { ReadFreshness } from '../../../client/freshness'
import { JournalView } from '../../../client/reads/journal'
import '../../reads.css'

async function JournalData({ filters }: { filters: Record<string, string | string[] | undefined> }) {
  const [owned, locale] = await Promise.all([getOwnJournal(filters), getRequestLocale()])
  if (!owned) redirect('/signin')
  const { ownerId, data, normalized } = owned
  const query = normalized.params.toString()
  if (!normalized.canonical) redirect(`/journal${query ? `?${query}` : ''}`)
  const filtered = !!(normalized.search || normalized.filters.year || normalized.filters.airlineIata || normalized.filters.aircraftIcao || normalized.filters.status || normalized.filters.airport || normalized.filters.origin || normalized.filters.destination)
  return <IdentitySnapshot ownerId={ownerId}><ReadFreshness ownerId={ownerId} revision={data.revision} publishedRevision={data.publishedRevision} derivedState={data.derivedState} locale={locale} /><JournalView key={ownerId} ownerId={ownerId} locale={locale} initial={data} query={query} page={normalized.page} filtered={filtered} /></IdentitySnapshot>
}
export const generateMetadata = () => pageMetadata('Journal', 'Журнал')
export default async function Journal({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOnboardedMember()
  const filters = await searchParams
  // Redirect before the Journal flight/count/publication batch (the member gate has already read the own profile). Because journal/loading.tsx streams its shell first, this is an in-stream redirect (HTTP 200), not a 307; see issue 21.
  const canonical = normalizeJournalQuery(filters)
  if (!canonical.canonical) redirect(withQuery('/journal', canonical.query))
  const locale = await getRequestLocale()
  return <><div className="page-heading"><p className="eyebrow">{locale === 'ru' ? 'Все ваши путешествия' : 'Every journey'}</p><h1>{locale === 'ru' ? 'Журнал' : 'Journal'}</h1><p className="lead">{locale === 'ru' ? 'Найдите, проверьте или исправьте перелёт.' : 'Find, review and update a flight.'}</p><a className="button primary" href="/add">{locale === 'ru' ? 'Добавить перелёт' : 'Add a flight'}</a></div><Suspense fallback={<p className="loading" data-testid="journal-loading" role="status">{locale === 'ru' ? 'Загружаем журнал…' : 'Loading journal…'}</p>}><JournalData filters={filters} /></Suspense></>
}
