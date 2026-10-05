'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../../web/src/lib/apiClient'
import { trackPrivateOperation } from '../activity'
import { isPublicationPending } from '../freshness'
import { useWriteFeedback } from '../write-feedback'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { useOnline } from '../awaiting'
import { FlightDetailSheet } from '../capture/flight-panels'
import { connectionChains } from '../../../../../functions/api/_services/connections'
import { Disclosure } from '../ui/disclosure'
import { JournalQueue } from './journal-queue'
import { useDeferredDelete } from './deferred-delete'
import { Button } from '../ui/button'
import { Sheet } from '../ui/sheet'
import { useMobile } from '../ui/use-mobile'
import { FloatingActionBar } from '../ui/floating-action-bar'
import { DestructiveConfirm } from '../ui/destructive-confirm'
import type { JournalData } from '../../server/journal'
import type { Locale } from '../../server/locale'
import { formatCount, formatDateOnly, formatDistanceKm } from '../../lib/format'
import { JOURNAL_FILTER_KEYS, JOURNAL_SORTS, normalizeJournalQuery, resetJournalFilters, withQuery } from '../../lib/url-state'

const countForms = { en: { one: '{count} flight', other: '{count} flights' }, ru: { one: '{count} перелёт', few: '{count} перелёта', many: '{count} перелётов', other: '{count} перелёта' } } as const
const labels = {
  en: { search: 'Search routes, cities, codes or flight number', year: 'Year', status: 'Status', all: 'All', upcoming: 'Upcoming', awaiting: 'Awaiting', logged: 'Logged', completed: 'Completed', airline: 'Airline', aircraft: 'Aircraft', airport: 'Airport', origin: 'Origin', destination: 'Destination', sort: 'Sort', order: 'Order', latest: 'Latest first', oldest: 'Oldest first', reset: 'Reset filters', empty: 'Your journal is empty.', filtered: 'Nothing matches these filters.', retry: 'Try again', backgroundError: 'Could not refresh the list. Showing the last loaded flights.', pending: 'Recent changes are still being prepared.', previous: 'Previous', next: 'Next', page: 'Page', of: 'of', filters: 'Filters', apply: 'Apply filters', close: 'Close filters', select: 'Select', selectAll: 'Select all matching flights', clear: 'Clear selection', delete: 'Delete selected flights', cancel: 'Cancel', undo: 'Undo', deleting: 'Deleting flights…', offline: 'Offline. Connect to change flights.', deleteFailed: 'Delete failed. Your flights are restored.', retryDelete: 'Retry deletion', addAircraft: 'Add aircraft', detail: 'Flight details', historical: 'Logged', flight: 'Flight', distance: 'Distance', date: 'Date' },
  ru: { search: 'Поиск по маршруту, городу, коду или номеру рейса', year: 'Год', status: 'Статус', all: 'Все', upcoming: 'Предстоящие', awaiting: 'Ждут подтверждения', logged: 'В журнале', completed: 'Завершённые', airline: 'Авиакомпания', aircraft: 'Самолёт', airport: 'Аэропорт', origin: 'Откуда', destination: 'Куда', sort: 'Сортировка', order: 'Порядок', latest: 'Сначала новые', oldest: 'Сначала старые', reset: 'Сбросить фильтры', empty: 'Журнал пока пуст.', filtered: 'По этим фильтрам ничего не найдено.', retry: 'Повторить', backgroundError: 'Не удалось обновить список. Показаны последние загруженные перелёты.', pending: 'Последние изменения ещё обрабатываются.', previous: 'Назад', next: 'Далее', page: 'Страница', of: 'из', filters: 'Фильтры', apply: 'Применить фильтры', close: 'Закрыть фильтры', select: 'Выбрать', selectAll: 'Выбрать все найденные перелёты', clear: 'Снять выделение', delete: 'Удалить выбранные перелёты', cancel: 'Отмена', undo: 'Отменить', deleting: 'Удаляем перелёты…', offline: 'Нет сети. Подключитесь, чтобы изменить перелёты.', deleteFailed: 'Не удалось удалить. Перелёты восстановлены.', retryDelete: 'Повторить удаление', addAircraft: 'Добавить самолёт', detail: 'Детали перелёта', historical: 'В журнале', flight: 'Рейс', distance: 'Расстояние', date: 'Дата' },
} as const

type Flight = JournalData['flights'][number]
type Props = { ownerId: string; locale: Locale; initial: JournalData; query: string; page: number; filtered: boolean }
function JournalInner({ ownerId, locale, initial, query, page, filtered }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const t = labels[locale]
  const params = new URLSearchParams(query)
  const online = useOnline()
  const feedback = useWriteFeedback(ownerId)
  const [selected, select] = useState<number[]>([])
  const selectionParams = new URLSearchParams(query)
  for (const key of ['flight', 'queue', 'batch']) selectionParams.delete(key)
  const [selectionQuery, setSelectionQuery] = useState(selectionParams.toString())
  if (selectionQuery !== selectionParams.toString()) { setSelectionQuery(selectionParams.toString()); select([]) }
  const [selectionError, setSelectionError] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [removed, setRemoved] = useState<number[]>([])
  const selectingController = useRef<AbortController | null>(null)
  useEffect(() => () => selectingController.current?.abort(), [])
  const listHeading = useRef<HTMLHeadingElement>(null)
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['journal', ownerId] }); router.refresh() }
  const deletion = useDeferredDelete((ack, deletedIds) => { feedback.acknowledge(ack); select([]); setRemoved(ids => [...ids, ...deletedIds]); refresh(); window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT)); listHeading.current?.focus() })
  const scheduleDelete = (ids: number[]) => { if (!online || deletion.pending) return; deletion.schedule(ids) }
  const hidden = [...removed, ...(deletion.pending?.ids ?? [])]
  const list = useQuery({
    queryKey: ['journal', ownerId, query],
    queryFn: async ({ signal }) => {
      const controller = new AbortController()
      const untrack = trackPrivateOperation(controller)
      signal.addEventListener('abort', () => controller.abort(), { once: true })
      try {
        const [value, publication] = await Promise.all([
          api.get<{ flights: Flight[]; total: number }>('/api/flights', { ...Object.fromEntries(params), page: undefined, flight: undefined, queue: undefined, batch: undefined, limit: 20, offset: (page - 1) * 20 }, { signal: controller.signal }),
          api.get<{ revision: number; published_revision: number; derived_state: JournalData['derivedState'] }>('/api/me/derived-state', undefined, { signal: controller.signal }),
        ])
        return { ...value, updatedAt: Date.now(), revision: publication.revision, publishedRevision: publication.published_revision, derivedState: publication.derived_state }
      } finally { untrack() }
    },
    initialData: initial, initialDataUpdatedAt: initial.updatedAt, staleTime: 60_000, refetchOnWindowFocus: true, retry: 1,
  })
  useEffect(() => {
    const key = ['journal', ownerId, query]
    const newer = (current: JournalData | undefined) => !current || (initial.revision >= current.revision && initial.publishedRevision >= current.publishedRevision && (initial.revision > current.revision || initial.publishedRevision > current.publishedRevision || initial.updatedAt > current.updatedAt))
    if (!newer(queryClient.getQueryData<JournalData>(key))) return
    let active = true
    void queryClient.cancelQueries({ queryKey: key, exact: true }).then(() => { if (active && newer(queryClient.getQueryData<JournalData>(key))) queryClient.setQueryData(key, initial, { updatedAt: initial.updatedAt }) })
    return () => { active = false }
  }, [queryClient, ownerId, query, initial])
  useEffect(() => {
    const refreshList = () => { void queryClient.invalidateQueries({ queryKey: ['journal', ownerId] }) }
    window.addEventListener(LIFECYCLE_CHANGED_EVENT, refreshList)
    return () => window.removeEventListener(LIFECYCLE_CHANGED_EVENT, refreshList)
  }, [queryClient, ownerId])
  const data = list.data
  const navigate = (key: string, value: string, replace = false) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (key !== 'flight' && key !== 'page') { next.delete('page'); select([]) }
    router[replace ? 'replace' : 'push'](withQuery('/journal', normalizeJournalQuery(next).query), { scroll: false })
  }
  const open = (id: number, edit = false) => { setEditing(edit); navigate('flight', String(id)) }
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / 20))
  async function selectAll() {
    if (selecting) return
    setSelecting(true); setSelectionError(false)
    const controller = new AbortController(); selectingController.current = controller; const release = trackPrivateOperation(controller)
    const selectionAtStart = window.location.search
    try { const { ids } = await api.get<{ ids: number[] }>('/api/flights/ids', Object.fromEntries(params), { signal: controller.signal }); if (!controller.signal.aborted && selectionAtStart === window.location.search) select(ids.filter(id => !hidden.includes(id))) } catch { if (!controller.signal.aborted) setSelectionError(true) } finally { release(); setSelecting(false) }
  }
  const groups = new Map<string, Flight[]>()
  for (const flight of data?.flights ?? []) {
    if (hidden.includes(flight.id)) continue
    const key = flight.lifecycle_state === 'upcoming' ? t.upcoming : `${flight.date.slice(0, 4)} · ${flight.lifecycle_state === 'awaiting' ? t.awaiting : t.historical}`
    groups.set(key, [...(groups.get(key) ?? []), flight])
  }
  const orderedGroups = [...groups].sort(([a], [b]) => a === t.upcoming ? -1 : b === t.upcoming ? 1 : 0)
  // ponytail: presentation chains use the current 20-row page; C4 owns full connection policy.
  const decisions = connectionChains((data?.flights ?? []).map(flight => ({ ...flight, origin_country: null, destination_country: null })))
  const chains = new Map<number, number[]>()
  for (const decision of decisions.values()) if (decision.kind === 'link' && decision.chainIds.length >= 3) for (const id of decision.chainIds) chains.set(id, decision.chainIds)
  const row = (flight: Flight) => <div className="journal-entry" key={flight.id}>
            <label className="journal-checkbox"><input type="checkbox" aria-label={`${t.select} ${flight.origin} ${flight.destination} ${flight.date}`} checked={selected.includes(flight.id)} onChange={event => select(ids => event.target.checked ? [...ids, flight.id] : ids.filter(id => id !== flight.id))} /></label>
            <button type="button" className="flight-row" aria-label={`${t.detail}: ${flight.origin} ${flight.destination} ${flight.date}`} onClick={() => open(flight.id)}><span className="mono">{formatDateOnly(locale, flight.date, 'padded')}</span><strong className="mono">{flight.origin} → {flight.destination}</strong><span>{flight.flight_number ?? flight.airline_iata ?? '—'}</span><span>{flight.aircraft_icao ?? '—'}</span><span>{flight.duration_minutes ? `${Math.round(flight.duration_minutes / 60)} ${locale === 'ru' ? 'ч' : 'h'}` : '—'}</span><span className="mono">{flight.distance_km ? formatDistanceKm(locale, flight.distance_km) : '—'}</span></button>
            {!flight.aircraft_icao && <Button className="journal-aircraft-action" disabledReason={!online ? t.offline : undefined} onClick={() => open(flight.id, true)}>{t.addAircraft}</Button>}
          </div>
  const flightRows = (flights: Flight[]) => {
    const shown = new Set<number>()
    return flights.map(flight => {
      if (shown.has(flight.id)) return null
      const chain = chains.get(flight.id)?.map(id => flights.find(item => item.id === id)).filter((item): item is Flight => !!item)
      if (chain && chain.length >= 3) {
        chain.forEach(item => shown.add(item.id))
        return <Disclosure key={flight.id} defaultOpen summary={`${locale === 'ru' ? 'Цепочка перелётов' : 'Flight chain'}: ${chain.map(item => item.origin).join(' → ')} → ${chain.at(-1)!.destination}`}>{chain.map(row)}</Disclosure>
      }
      shown.add(flight.id)
      return row(flight)
    })
  }
  return <section data-testid="journal-data" className="journal-data read-stack">
    <JournalQueue ownerId={ownerId} locale={locale} hiddenIds={hidden} onEdit={id => open(id, true)} onDelete={scheduleDelete} />
    <section className="read-section">
      <h2 ref={listHeading} tabIndex={-1}>{locale === 'ru' ? 'Перелёты' : 'Flights'}</h2>
      <JournalFilters key={query} locale={locale} query={query} filtered={filtered} navigate={navigate} />
      {data && isPublicationPending(data.revision, data.publishedRevision, data.derivedState) && <p role="status" className="status-note">{t.pending}</p>}
      {list.isError && <p role="alert" className="status-note">{t.backgroundError} <button onClick={() => void list.refetch()}>{t.retry}</button></p>}
      {data && <><p className="muted">{formatCount(locale, data.total, countForms)}{list.isFetching && <span role="status"> · …</span>}</p>
        {data.flights.length === 0 ? <div className="read-panel empty-panel"><h3>{data.total > 0 || filtered ? t.filtered : t.empty}</h3>{filtered ? <a className="button secondary" href={withQuery('/journal', resetJournalFilters(query))}>{t.reset}</a> : <a className="button primary" href="/add">{locale === 'ru' ? 'Добавить перелёт' : 'Add a flight'}</a>}</div> : <>
          <div className="read-actions"><Button loading={selecting} loadingLabel={t.selectAll} onClick={() => void selectAll()}>{t.selectAll}</Button>{selected.length > 0 && <Button onClick={() => select([])}>{t.clear}</Button>}</div>
          {selectionError && <p role="alert">{locale === 'ru' ? 'Не удалось выбрать все перелёты. Повторите.' : 'Could not select all flights. Try again.'}</p>}
          <div className="journal-sort-headers" aria-label={t.sort}>{[['date', t.date], ['origin', t.origin], ['destination', t.destination], ['distance_km', t.distance]].map(([key, label]) => <button key={key} aria-pressed={(params.get('sort') ?? 'date') === key} onClick={() => (params.get('sort') ?? 'date') === key ? navigate('order', params.get('order') === 'asc' ? 'desc' : 'asc') : navigate('sort', key)}>{label}</button>)}</div>
          {orderedGroups.map(([group, flights]) => <section key={group}><h3>{group}</h3><div className="flight-list">{flightRows(flights)}</div></section>)}
        </>}
        {pageCount > 1 && <nav className="page-controls" aria-label={t.page}><button disabled={page <= 1} onClick={() => { select([]); navigate('page', String(page - 1)) }}>{t.previous}</button><span>{t.page} {page} {t.of} {pageCount}</span><button disabled={page >= pageCount} onClick={() => { select([]); navigate('page', String(page + 1)) }}>{t.next}</button></nav>}
      </>}
      {selected.length > 0 && <FloatingActionBar label={locale === 'ru' ? 'Действия с выбранными' : 'Selection actions'} countLabel={formatCount(locale, selected.length, countForms)}><Button variant="danger" disabled={!!deletion.pending} disabledReason={!online ? t.offline : undefined} onClick={() => setDeleteOpen(true)}>{t.delete}</Button><Button onClick={() => select([])}>{t.cancel}</Button></FloatingActionBar>}
      {deletion.pending && <div role="status" aria-live="polite">{deletion.submitting ? t.deleting : `${formatCount(locale, deletion.pending.ids.length, countForms)} · ${deletion.pending.seconds} ${locale === 'ru' ? 'с' : 's'}`} {!deletion.submitting && <Button onClick={deletion.undo}>{t.undo}</Button>}</div>}
      {deletion.failed && <div role="alert">{t.deleteFailed}<Button disabledReason={!online ? t.offline : undefined} onClick={() => scheduleDelete(deletion.failed!)}>{t.retryDelete}</Button></div>}
      <DestructiveConfirm open={deleteOpen} onOpenChange={setDeleteOpen} title={t.delete} consequence={locale === 'ru' ? `Будут удалены выбранные перелёты (${selected.length}). Отмена доступна шесть секунд.` : `The selected flights (${selected.length}) will be removed. Undo is available for six seconds.`} confirmLabel={t.delete} cancelLabel={t.cancel} onConfirm={() => { if (online) { scheduleDelete(selected); setDeleteOpen(false) } }} />
    </section>
    {params.has('flight') && <FlightDetailSheet ownerId={ownerId} locale={locale} flightId={Number(params.get('flight'))} initialEditing={editing} onDelete={id => scheduleDelete([id])} onOpenChange={isOpen => { if (!isOpen) { navigate('flight', '', true); refresh(); requestAnimationFrame(() => listHeading.current?.focus()) } }} />}
  </section>
}

function JournalFilters({ locale, query, filtered, navigate }: { locale: Locale; query: string; filtered: boolean; navigate: (key: string, value: string) => void }) {
  const t = labels[locale]; const router = useRouter(); const mobile = useMobile()
  const [open, setOpen] = useState(false)
  const [staged, setStaged] = useState(() => Object.fromEntries(new URLSearchParams(query)))
  const [search, setSearch] = useState(staged.q ?? '')
  const change = (key: string, value: string) => { setStaged(old => ({ ...old, [key]: value })); if (!mobile) navigate(key, value) }
  const controls = <div className="journal-toolbar">
    <label>{t.year}<input type="number" min="1900" max={new Date().getUTCFullYear() + 1} defaultValue={staged.year ?? ''} onBlur={event => change('year', event.target.value)} placeholder={t.all} /></label>
    <label>{t.status}<select value={staged.status ?? ''} onChange={event => change('status', event.target.value)}><option value="">{t.all}</option>{(['upcoming', 'awaiting', 'logged', 'completed'] as const).map(status => <option key={status} value={status}>{t[status]}</option>)}</select></label>
    {(['airline', 'aircraft', 'airport', 'origin', 'destination'] as const).map(key => <label key={key}>{t[key]}<input maxLength={key === 'aircraft' ? 4 : 3} defaultValue={staged[key] ?? ''} onBlur={event => change(key, event.target.value.toUpperCase())} placeholder={key === 'aircraft' ? 'ICAO' : 'IATA'} /></label>)}
    <label>{t.sort}<select value={staged.sort ?? 'date'} onChange={event => change('sort', event.target.value)}>{JOURNAL_SORTS.map(sort => <option key={sort} value={sort}>{({ date: t.date, origin: t.origin, destination: t.destination, airline_iata: t.airline, aircraft_icao: t.aircraft, distance_km: t.distance, duration_minutes: locale === 'ru' ? 'Длительность' : 'Duration' })[sort]}</option>)}</select></label>
    <label>{t.order}<select value={staged.order ?? 'desc'} onChange={event => change('order', event.target.value)}><option value="desc">{t.latest}</option><option value="asc">{t.oldest}</option></select></label>
  </div>
  return <div className="journal-toolbar">
    <form role="search" onSubmit={event => { event.preventDefault(); navigate('q', search.trim()) }}><label className="sr-only" htmlFor="journal-search">{t.search}</label><input id="journal-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t.search} /><Button type="submit">{locale === 'ru' ? 'Найти' : 'Search'}</Button></form>
    {mobile ? <Sheet open={open} onOpenChange={next => { if (next) setStaged(Object.fromEntries(new URLSearchParams(query))); setOpen(next) }} title={t.filters} closeLabel={t.close} trigger={<Button>{t.filters}</Button>} footer={<Button variant="primary" onClick={() => { const next = new URLSearchParams(query); for (const key of [...JOURNAL_FILTER_KEYS, 'sort', 'order']) { if (staged[key]) next.set(key, staged[key]); else next.delete(key) } next.delete('page'); router.push(withQuery('/journal', normalizeJournalQuery(next).query), { scroll: false }); setOpen(false) }}>{t.apply}</Button>}>{controls}</Sheet> : controls}
    {filtered && <a className="text-link" href={withQuery('/journal', resetJournalFilters(query))}>{t.reset}</a>}
  </div>
}
export function JournalView(props: Props) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { gcTime: 5 * 60_000 } } }))
  return <QueryClientProvider client={client}><JournalInner {...props} /></QueryClientProvider>
}
