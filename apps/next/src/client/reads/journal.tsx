'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { DraftLinks } from './draft-links'
import * as Dialog from '@radix-ui/react-dialog'
import { api } from '../../../../web/src/lib/apiClient'
import { trackPrivateOperation } from '../activity'
import type { JournalData } from '../../server/journal'
import type { Locale } from '../../server/locale'
import { formatCount, formatDateOnly, formatDistanceKm, formatNumber } from '../../lib/format'

const countForms = {
  en: { one: '{count} flight', other: '{count} flights' },
  ru: { one: '{count} перелёт', few: '{count} перелёта', many: '{count} перелётов', other: '{count} перелёта' },
} as const
const labels = {
  en: { search: 'Search routes, codes or flight number', year: 'Year', status: 'Status', all: 'All', upcoming: 'Upcoming', completed: 'Completed', airline: 'Airline', aircraft: 'Aircraft', sort: 'Sort', latest: 'Latest first', oldest: 'Oldest first', reset: 'Reset filters', empty: 'Your journal is empty.', filtered: 'Nothing matches these filters.', import: 'Import flights', add: 'Add manually', retry: 'Try again', backgroundError: 'Could not refresh the list. Showing the last loaded flights.', failed: 'Your flights could not be loaded.', pending: 'Recent changes are still being prepared.', detail: 'Flight details', edit: 'Edit or delete flight', date: 'Date', route: 'Route', flight: 'Flight', distance: 'Distance', duration: 'Duration', close: 'Close', previous: 'Previous', next: 'Next', page: 'Page', of: 'of', noAircraft: 'Aircraft unknown' },
  ru: { search: 'Поиск по маршруту, коду или номеру рейса', year: 'Год', status: 'Статус', all: 'Все', upcoming: 'Предстоящие', completed: 'Завершённые', airline: 'Авиакомпания', aircraft: 'Самолёт', sort: 'Порядок', latest: 'Сначала новые', oldest: 'Сначала старые', reset: 'Сбросить фильтры', empty: 'Журнал пока пуст.', filtered: 'По этим фильтрам ничего не найдено.', import: 'Импортировать перелёты', add: 'Добавить вручную', retry: 'Повторить', backgroundError: 'Не удалось обновить список. Показаны последние загруженные перелёты.', failed: 'Не удалось загрузить перелёты.', pending: 'Последние изменения ещё обрабатываются.', detail: 'Детали перелёта', edit: 'Изменить или удалить перелёт', date: 'Дата', route: 'Маршрут', flight: 'Рейс', distance: 'Расстояние', duration: 'Длительность', close: 'Закрыть', previous: 'Назад', next: 'Далее', page: 'Страница', of: 'из', noAircraft: 'Самолёт не указан' },
} as const

type Flight = JournalData['flights'][number]
type Props = { ownerId: string; locale: Locale; initial: JournalData; query: string; page: number; filtered: boolean }
function JournalInner({ ownerId, locale, initial, query, page, filtered }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const t = labels[locale]
  const [selected, select] = useState<Flight | null>(null)
  const params = new URLSearchParams(query)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [year, setYear] = useState(params.get('year') ?? '')
  const [airline, setAirline] = useState(params.get('airlineIata') ?? '')
  const [aircraft, setAircraft] = useState(params.get('aircraftIcao') ?? '')
  const list = useQuery({
    queryKey: ['journal', ownerId, query],
    queryFn: async ({ signal }) => {
      const controller = new AbortController()
      const untrack = trackPrivateOperation(controller)
      signal.addEventListener('abort', () => controller.abort(), { once: true })
      try {
        return await api.get<JournalData>('/api/flights', { ...Object.fromEntries(params), page: undefined, limit: 20, offset: (page - 1) * 20 }, { signal: controller.signal })
      } finally { untrack() }
    },
    initialData: initial,
    initialDataUpdatedAt: initial.updatedAt,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
  useEffect(() => {
    const key = ['journal', ownerId, query]
    const newer = (current: JournalData | undefined) => !current ||
      (initial.revision >= current.revision && initial.publishedRevision >= current.publishedRevision &&
        (initial.revision > current.revision || initial.publishedRevision > current.publishedRevision || initial.updatedAt > current.updatedAt))
    if (!newer(queryClient.getQueryData<JournalData>(key))) return
    let active = true
    void queryClient.cancelQueries({ queryKey: key, exact: true }).then(() => {
      if (active && newer(queryClient.getQueryData<JournalData>(key))) {
        queryClient.setQueryData(key, initial, { updatedAt: initial.updatedAt })
      }
    })
    return () => { active = false }
  }, [queryClient, ownerId, query, initial])
  const data = list.data
  const date = (value: string) => formatDateOnly(locale, value, 'padded')
  const navigate = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    router.push(`/journal${next.size ? `?${next}` : ''}`)
  }
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / 20))
  const goPage = (number: number) => { const next = new URLSearchParams(params); next.set('page', String(number)); router.push(`/journal?${next}`) }
  return <section data-testid="journal-data" className="journal-data read-stack">
    <DraftLinks ownerId={ownerId} locale={locale} />
    {(data ?? initial).derivedState !== 'ready' && <p role="status" className="status-note">{t.pending}</p>}
    <div className="journal-toolbar"><form onSubmit={event => { event.preventDefault(); navigate('q', search.trim()) }} role="search"><label className="sr-only" htmlFor="journal-search">{t.search}</label><input id="journal-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t.search} /><button type="submit" className="button secondary">{locale === 'ru' ? 'Найти' : 'Search'}</button></form>
      <label>{t.year}<input type="number" min="1900" max="2199" value={year} onChange={event => setYear(event.target.value)} onBlur={() => { if (!year || /^(19|20|21)\d{2}$/.test(year)) navigate('year', year) }} placeholder={t.all} /></label>
      <label>{t.status}<select value={params.get('isUpcoming') ?? ''} onChange={event => navigate('isUpcoming', event.target.value)}><option value="">{t.all}</option><option value="false">{t.completed}</option><option value="true">{t.upcoming}</option></select></label>
      <label>{t.airline}<input maxLength={3} value={airline} onChange={event => setAirline(event.target.value.toUpperCase())} onBlur={() => navigate('airlineIata', airline)} placeholder="IATA" /></label>
      <label>{t.aircraft}<input maxLength={4} value={aircraft} onChange={event => setAircraft(event.target.value.toUpperCase())} onBlur={() => navigate('aircraftIcao', aircraft)} placeholder="ICAO" /></label>
      <label>{t.sort}<select value={params.get('sortOrder') ?? 'desc'} onChange={event => navigate('sortOrder', event.target.value)}><option value="desc">{t.latest}</option><option value="asc">{t.oldest}</option></select></label>
      {filtered && <a className="text-link" href="/journal">{t.reset}</a>}
    </div>
    {list.isError && data && <p role="alert" className="status-note">{t.backgroundError} <button onClick={() => void list.refetch()}>{t.retry}</button></p>}
    {!data && list.isError && <div className="read-panel error-state"><p>{t.failed}</p><button onClick={() => void list.refetch()}>{t.retry}</button></div>}
    {data && <><p className="muted">{formatCount(locale, data.total, countForms)}{list.isFetching && <span role="status"> · …</span>}</p>
      {data.flights.length === 0 ? <div className="read-panel empty-panel"><h2>{data.total > 0 || filtered ? t.filtered : t.empty}</h2><div className="read-actions">{data.total > 0 ? <button className="button secondary" onClick={() => goPage(1)}>{t.previous}</button> : filtered ? <a className="button secondary" href="/journal">{t.reset}</a> : <><a className="button primary" href="/import">{t.import}</a><a className="button secondary" href="/add">{t.add}</a></>}</div></div> : <div className="flight-list">{data.flights.map(flight => <button type="button" className="flight-row" key={flight.id} onClick={() => select(flight)}><span className="mono">{date(flight.date)}</span><strong className="mono">{flight.origin} → {flight.destination}</strong><span>{flight.flight_number ?? flight.airline_iata ?? '—'}</span><span>{flight.aircraft_icao ?? t.noAircraft}</span><span>{flight.duration_minutes ? `${Math.round(flight.duration_minutes / 60)} ${locale === 'ru' ? 'ч' : 'h'}` : '—'}</span><span className="mono">{flight.distance_km ? formatDistanceKm(locale, flight.distance_km) : '—'}</span></button>)}</div>}
      {pageCount > 1 && <nav className="page-controls" aria-label={t.page}><button disabled={page <= 1} onClick={() => goPage(page - 1)}>{t.previous}</button><span>{t.page} {page} {t.of} {pageCount}</span><button disabled={page >= pageCount} onClick={() => goPage(page + 1)}>{t.next}</button></nav>}
    </>}
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) select(null) }}><Dialog.Portal><Dialog.Overlay className="read-sheet-overlay" /><Dialog.Content className="read-sheet"><Dialog.Title>{t.detail}</Dialog.Title><Dialog.Description className="sr-only">{selected ? `${selected.origin} ${selected.destination}` : ''}</Dialog.Description>{selected && <><div className="flight-ticket"><strong className="ticket-route mono">{selected.origin} → {selected.destination}</strong><p>{date(selected.date)} · {selected.flight_number ?? '—'}</p></div><dl className="detail-list"><div><dt>{t.airline}</dt><dd>{selected.airline_iata ?? '—'}</dd></div><div><dt>{t.aircraft}</dt><dd>{selected.aircraft_icao ?? t.noAircraft}</dd></div><div><dt>{t.distance}</dt><dd>{selected.distance_km ? formatDistanceKm(locale, selected.distance_km) : '—'}</dd></div><div><dt>{t.duration}</dt><dd>{selected.duration_minutes ? `${formatNumber(locale, selected.duration_minutes)} min` : '—'}</dd></div></dl><a className="button secondary" href={`/journal/${selected.id}/edit`}>{t.edit}</a></>}<Dialog.Close className="button secondary">{t.close}</Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>
}
export function JournalView(props: Props) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { gcTime: 5 * 60_000 } } }))
  return <QueryClientProvider client={client}><JournalInner {...props} /></QueryClientProvider>
}
