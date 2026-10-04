import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getOwnJournal } from '../../server/journal'
import { getRequestLocale } from '../../server/locale'
import { IdentitySnapshot } from '../../client/activity'
import { ReadFreshness } from '../../client/freshness'
import { JournalView } from '../../client/reads/journal'
import '../reads.css'

async function JournalData({ filters }: { filters: Record<string, string | string[] | undefined> }) {
  const [owned, locale] = await Promise.all([getOwnJournal(filters), getRequestLocale()])
  if (!owned) redirect('/signin')
  const { ownerId, data, normalized } = owned
  const query = normalized.params.toString()
  const filtered = !!(normalized.search || normalized.filters.year || normalized.filters.airlineIata || normalized.filters.airlineIataCodes?.length || normalized.filters.aircraftIcao || normalized.filters.isUpcoming !== undefined || normalized.filters.origin || normalized.filters.originCodes?.length || normalized.filters.destination || normalized.filters.destinationCodes?.length)
  return <IdentitySnapshot ownerId={ownerId}><ReadFreshness ownerId={ownerId} revision={data.revision} publishedRevision={data.publishedRevision} locale={locale} /><JournalView key={`${ownerId}:${query}`} ownerId={ownerId} locale={locale} initial={data} query={query} page={normalized.page} filtered={filtered} /></IdentitySnapshot>
}
export default async function Journal({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const locale = await getRequestLocale()
  return <><div className="page-heading"><p className="eyebrow">{locale === 'ru' ? 'Все ваши путешествия' : 'Every journey'}</p><h1>{locale === 'ru' ? 'Журнал' : 'Journal'}</h1><p className="lead">{locale === 'ru' ? 'Найдите, проверьте или исправьте перелёт.' : 'Find, review and update a flight.'}</p><a className="button primary" href="/add">{locale === 'ru' ? 'Добавить перелёт' : 'Add a flight'}</a></div><Suspense fallback={<p className="loading" data-testid="journal-loading" role="status">{locale === 'ru' ? 'Загружаем журнал…' : 'Loading journal…'}</p>}><JournalData filters={await searchParams} /></Suspense></>
}
