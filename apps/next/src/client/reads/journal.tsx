'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp } from 'lucide-react'
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
import { DeleteUndo } from './delete-undo'
import { JournalFilters } from './journal-filters'
import { FloatingActionBar } from '../ui/floating-action-bar'
import { DestructiveConfirm } from '../ui/destructive-confirm'
import type { JournalData } from '../../server/journal'
import type { Locale } from '../../server/locale'
import { formatCount, formatDateOnly, formatDistanceKm, formatDuration } from '../../lib/format'
import { normalizeJournalQuery, resetJournalFilters, withQuery } from '../../lib/url-state'

const countForms = { en: { one: '{count} flight', other: '{count} flights' }, ru: { one: '{count} перелёт', few: '{count} перелёта', many: '{count} перелётов', other: '{count} перелёта' } } as const
const selectedForms = { en: { one: '{count} flight selected', other: '{count} flights selected' }, ru: { one: 'Выбран {count} перелёт', few: 'Выбрано {count} перелёта', many: 'Выбрано {count} перелётов', other: 'Выбрано {count} перелёта' } } as const
const consequenceForms = {
  en: { one: '{count} selected flight will be deleted. You can undo it for six seconds.', other: '{count} selected flights will be deleted. You can undo it for six seconds.' },
  ru: { one: 'Будет удалён {count} выбранный перелёт. Отменить удаление можно в течение шести секунд.', few: 'Будут удалены {count} выбранных перелёта. Отменить удаление можно в течение шести секунд.', many: 'Будут удалены {count} выбранных перелётов. Отменить удаление можно в течение шести секунд.', other: 'Будут удалены {count} выбранных перелёта. Отменить удаление можно в течение шести секунд.' },
} as const
const labels = {
  en: { origin: 'Origin', destination: 'Destination', sort: 'Sort', asc: 'ascending', desc: 'descending', upcoming: 'Upcoming', awaiting: 'Awaiting', reset: 'Reset filters', empty: 'Your journal is empty.', filtered: 'Nothing matches these filters.', pageEmpty: 'There are no flights on this page.', firstPage: 'Back to the first page', importFlights: 'Import flights', retry: 'Try again', backgroundError: 'Could not refresh the list. Showing the last loaded flights.', pending: 'Recent changes are still being prepared.', previous: 'Previous', next: 'Next', page: 'Page', of: 'of', select: 'Select', selectAll: 'Select all matching flights', clear: 'Clear selection', delete: 'Delete selected flights', cancel: 'Cancel', offline: 'Offline. Connect to change flights.', deleteFailed: 'Delete failed. Your flights are restored.', retryDelete: 'Retry deletion', addAircraft: 'Add aircraft', historical: 'Logged', distance: 'Distance', date: 'Date', airline: 'Airline', aircraft: 'Aircraft', duration: 'Duration', selectionActions: 'Selection actions' },
  ru: { origin: 'Откуда', destination: 'Куда', sort: 'Сортировка', asc: 'по возрастанию', desc: 'по убыванию', upcoming: 'Предстоящие', awaiting: 'Ждут подтверждения', reset: 'Сбросить фильтры', empty: 'Журнал пока пуст.', filtered: 'По этим фильтрам ничего не найдено.', pageEmpty: 'На этой странице нет перелётов.', firstPage: 'Вернуться на первую страницу', importFlights: 'Импортировать перелёты', retry: 'Повторить', backgroundError: 'Не удалось обновить список. Показаны последние загруженные перелёты.', pending: 'Последние изменения ещё обрабатываются.', previous: 'Назад', next: 'Далее', page: 'Страница', of: 'из', select: 'Выбрать', selectAll: 'Выбрать все найденные перелёты', clear: 'Снять выделение', delete: 'Удалить выбранные перелёты', cancel: 'Отмена', offline: 'Нет сети. Подключитесь, чтобы изменить перелёты.', deleteFailed: 'Не удалось удалить. Перелёты восстановлены.', retryDelete: 'Повторить удаление', addAircraft: 'Добавить самолёт', historical: 'В журнале', distance: 'Расстояние', date: 'Дата', airline: 'Авиакомпания', aircraft: 'Самолёт', duration: 'Длительность', selectionActions: 'Действия с выбранными' },
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
  const [focusField, setFocusField] = useState<'aircraft' | undefined>()
  const [removed, setRemoved] = useState<number[]>([])
  const selectingController = useRef<AbortController | null>(null)
  useEffect(() => () => selectingController.current?.abort(), [])
  const listHeading = useRef<HTMLHeadingElement>(null)
  const root = useRef<HTMLElement>(null)
  const undoButton = useRef<HTMLButtonElement>(null)
  const offlineId = useId()
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['journal', ownerId] }); router.refresh() }
  // Focus moves when the user acts (schedule, Undo, close), never when the network answers.
  const deletion = useDeferredDelete((ack, deletedIds) => { feedback.acknowledge(ack); select([]); setRemoved(ids => [...ids, ...deletedIds]); refresh(); window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT)) })
  const restore = useRef<{ origin: 'queue' | 'list'; id: number } | null>(null)
  const confirmed = useRef(false)
  const lastFlight = useRef<number | null>(null)
  const scheduleDelete = (ids: number[], origin: 'queue' | 'list' = 'list') => {
    if (!online || deletion.pending || !ids.length) return
    restore.current = { origin, id: ids[0] }
    select([])
    deletion.schedule(ids)
  }
  const wasPending = useRef(false)
  const undoing = useRef(false)
  const undo = () => { undoing.current = true; deletion.undo() }
  const focusRow = (id: number) => { const row = root.current?.querySelector<HTMLElement>(`[data-flight-row="${id}"]`); row?.focus(); return !!row }
  const isPending = deletion.pending !== null
  const settleFocus = () => { if (document.activeElement === document.body || document.activeElement === null) listHeading.current?.focus() }
  useEffect(() => {
    const was = wasPending.current
    wasPending.current = isPending
    if (isPending) { undoButton.current?.focus(); return }
    if (!was) return
    if (undoing.current) {
      undoing.current = false
      const target = restore.current
      const card = target?.origin === 'queue' ? root.current?.querySelector<HTMLElement>(`[data-confirm-flight="${target.id}"]`) : null
      if (card) card.focus()
      else if (!target || !focusRow(target.id)) listHeading.current?.focus()
      return
    }
    // Committed or failed: focus was already settled when the request started; this only catches a user who ended up on the body since.
    settleFocus()
  }, [isPending])
  // The Undo button leaves the page when the request starts, not when the network answers. A user resting on it (focus fell to the body) moves then; anyone elsewhere keeps their place.
  useEffect(() => { if (deletion.submitting) settleFocus() }, [deletion.submitting])
  const hidden = [...removed, ...(deletion.pending?.ids ?? [])]
  const list = useQuery({
    queryKey: ['journal', ownerId, query],
    queryFn: async ({ signal }) => {
      const controller = new AbortController()
      const untrack = trackPrivateOperation(controller)
      signal.addEventListener('abort', () => controller.abort(), { once: true })
      try {
        return await api.get<JournalData>('/api/flights', { ...Object.fromEntries(params), page: undefined, flight: undefined, queue: undefined, batch: undefined, limit: 20, offset: (page - 1) * 20 }, { signal: controller.signal })
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
  /** One URL change. `refine` replaces the history entry when every changed field already had a value (editing within a field) and pushes otherwise. */
  // The URL prop lags a navigation by a server round trip. Changes made in that window build on the last requested URL, not the stale prop.
  const requested = useRef(query)
  useEffect(() => { requested.current = query }, [query])
  const [navigating, startNavigation] = useTransition()
  /** Returns whether a navigation was started. It runs in a transition, so `navigating` stays true until the new page has committed. */
  const apply = (changes: Record<string, string>, mode: 'push' | 'replace' | 'refine' = 'push'): boolean => {
    const base = new URLSearchParams(requested.current)
    const next = new URLSearchParams(base)
    let refine = true
    for (const [key, value] of Object.entries(changes)) {
      if (!(base.get(key) ?? '') || !value) refine = false
      if (value) next.set(key, value); else next.delete(key)
    }
    const listChanged = Object.keys(changes).some(key => key !== 'flight' && key !== 'page')
    if (listChanged) next.delete('page')
    const target = normalizeJournalQuery(next).query
    if (target === normalizeJournalQuery(base).query) return false
    if (listChanged) select([])
    requested.current = target
    startNavigation(() => router[mode === 'replace' || (mode === 'refine' && refine) ? 'replace' : 'push'](withQuery('/journal', target), { scroll: false }))
    return true
  }
  const navigate = (key: string, value: string, mode: 'push' | 'replace' = 'push') => apply({ [key]: value }, mode)
  const open = (id: number, edit = false, field?: 'aircraft') => { setEditing(edit); setFocusField(field); navigate('flight', String(id)) }
  const sheetFlight = params.has('flight') ? Number(params.get('flight')) : null
  useEffect(() => { if (sheetFlight) lastFlight.current = sheetFlight }, [sheetFlight])
  const closeFocus = (event: Event) => {
    event.preventDefault()
    if (undoButton.current) { undoButton.current.focus(); return } // the flight is being deleted
    if (!lastFlight.current || !focusRow(lastFlight.current)) listHeading.current?.focus()
  }
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
  // The nearest trip leads the upcoming group; an explicit sort other than date is left alone.
  if (!params.get('sort') || params.get('sort') === 'date') { const upcoming = groups.get(t.upcoming); if (upcoming) upcoming.sort((a, b) => a.date.localeCompare(b.date)) }
  // ponytail: presentation chains use the current 20-row page; C4 owns full connection policy.
  const decisions = connectionChains((data?.flights ?? []).map(flight => ({ ...flight, origin_country: null, destination_country: null })))
  const chains = new Map<number, number[]>()
  for (const decision of decisions.values()) if (decision.kind === 'link' && decision.chainIds.length >= 3) for (const id of decision.chainIds) chains.set(id, decision.chainIds)
  const route = (flight: Flight) => locale === 'ru' ? `из ${flight.origin} в ${flight.destination}` : `${flight.origin} to ${flight.destination}`
  const rowName = (flight: Flight) => [route(flight), formatDateOnly(locale, flight.date, 'long'), flight.flight_number ?? flight.airline_iata, flight.aircraft_icao, flight.duration_minutes ? formatDuration(locale, flight.duration_minutes) : null, flight.distance_km ? formatDistanceKm(locale, flight.distance_km) : null].filter(Boolean).join(', ')
  const row = (flight: Flight) => <div className="journal-entry" key={flight.id}>
            <label className="journal-checkbox"><input type="checkbox" aria-label={`${t.select}: ${route(flight)}, ${formatDateOnly(locale, flight.date, 'long')}`} checked={selected.includes(flight.id)} onChange={event => select(ids => event.target.checked ? [...ids, flight.id] : ids.filter(id => id !== flight.id))} /></label>
            <div className="flight-row">
              <button type="button" className="flight-row-open" data-flight-row={flight.id} aria-label={rowName(flight)} onClick={() => open(flight.id)} />
              <span className="flight-row-date mono" aria-hidden="true">{formatDateOnly(locale, flight.date, 'padded')}</span>
              <strong className="flight-row-route mono" aria-hidden="true">{flight.origin} → {flight.destination}</strong>
              <span className="flight-row-number" aria-hidden="true">{flight.flight_number ?? flight.airline_iata ?? '—'}</span>
              {flight.aircraft_icao
                ? <span className="journal-aircraft-cell" aria-hidden="true">{flight.aircraft_icao}</span>
                : <span className="journal-aircraft-cell" data-action="add-aircraft"><Button dense aria-label={`${t.addAircraft}, ${route(flight)}, ${formatDateOnly(locale, flight.date, 'long')}`} disabled={!online} aria-describedby={!online ? offlineId : undefined} onClick={() => open(flight.id, true, 'aircraft')}>{t.addAircraft}</Button></span>}
              <span className="flight-row-duration" aria-hidden="true">{flight.duration_minutes ? formatDuration(locale, flight.duration_minutes) : '—'}</span>
              <span className="flight-row-distance mono" aria-hidden="true">{flight.distance_km ? formatDistanceKm(locale, flight.distance_km) : '—'}</span>
            </div>
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
  const sortKey = params.get('sort') ?? 'date'
  const direction = params.get('order') === 'asc' ? 'asc' : 'desc'
  const sortButton = (key: string, label: string) => {
    const active = sortKey === key
    return <Button key={key} dense aria-pressed={active} aria-label={active ? `${label}, ${t[direction]}` : undefined} onClick={() => active ? navigate('order', direction === 'asc' ? 'desc' : 'asc') : navigate('sort', key)}>{label}{active && (direction === 'asc' ? <ArrowUp size={14} strokeWidth={2} aria-hidden="true" /> : <ArrowDown size={14} strokeWidth={2} aria-hidden="true" />)}</Button>
  }
  const withoutPage = (() => { const next = new URLSearchParams(query); next.delete('page'); return next.toString() })()
  return <section ref={root} data-testid="journal-data" className="journal-data read-stack">
    <JournalQueue ownerId={ownerId} locale={locale} filtered={filtered} hiddenIds={hidden} onEdit={id => open(id, true)} onDelete={ids => scheduleDelete(ids, 'queue')} />
    <section className="read-section">
      <h2 ref={listHeading} tabIndex={-1}>{locale === 'ru' ? 'Перелёты' : 'Flights'}</h2>
      <JournalFilters locale={locale} query={query} filtered={filtered} navigating={navigating} apply={changes => apply(changes, 'refine')} />
      {!online && <p id={offlineId} className="status-note">{t.offline}</p>}
      {data && isPublicationPending(data.revision, data.publishedRevision, data.derivedState) && <p role="status" className="status-note">{t.pending}</p>}
      {list.isError && <p role="alert" className="status-note">{t.backgroundError} <Button dense onClick={() => void list.refetch()}>{t.retry}</Button></p>}
      {data && <><p className="muted">{formatCount(locale, data.total, countForms)}{list.isFetching && <span aria-hidden="true"> · …</span>}</p>
        {data.flights.length === 0 ? <div className="read-panel empty-panel"><h3>{data.total > 0 && !filtered ? t.pageEmpty : filtered ? t.filtered : t.empty}</h3>{data.total > 0 && !filtered ? <Link className="button secondary" href={withQuery('/journal', withoutPage)}>{t.firstPage}</Link> : filtered ? <Link className="button secondary" href={withQuery('/journal', resetJournalFilters(query))}>{t.reset}</Link> : <div className="read-actions"><Link className="button primary" href="/import">{t.importFlights}</Link><Link className="button secondary" href="/add">{locale === 'ru' ? 'Добавить перелёт' : 'Add a flight'}</Link></div>}</div> : <>
          <div className="read-actions"><Button loading={selecting} loadingLabel={t.selectAll} disabled={!online} aria-describedby={!online ? offlineId : undefined} onClick={() => void selectAll()}>{t.selectAll}</Button>{selected.length > 0 && <Button onClick={() => select([])}>{t.clear}</Button>}</div>
          {selectionError && <p role="alert">{locale === 'ru' ? 'Не удалось выбрать все перелёты. Повторите.' : 'Could not select all flights. Try again.'}</p>}
          <div className="journal-sort-headers" role="group" aria-label={t.sort}>{[['date', t.date], ['origin', t.origin], ['destination', t.destination], ['airline_iata', t.airline], ['aircraft_icao', t.aircraft], ['duration_minutes', t.duration], ['distance_km', t.distance]].map(([key, label]) => sortButton(key, label))}</div>
          {orderedGroups.map(([group, flights]) => <section key={group}><h3>{group}</h3><div className="flight-list">{flightRows(flights)}</div></section>)}
        </>}
        {pageCount > 1 && <nav className="page-controls" aria-label={t.page}><button disabled={page <= 1} onClick={() => { select([]); navigate('page', String(page - 1)) }}>{t.previous}</button><span>{t.page} {page} {t.of} {pageCount}</span><button disabled={page >= pageCount} onClick={() => { select([]); navigate('page', String(page + 1)) }}>{t.next}</button></nav>}
      </>}
      {selected.length > 0 && <FloatingActionBar label={t.selectionActions} countLabel={formatCount(locale, selected.length, selectedForms)}><Button variant="danger" disabled={!online} aria-describedby={!online ? offlineId : undefined} onClick={() => setDeleteOpen(true)}>{t.delete}</Button><Button onClick={() => select([])}>{t.clear}</Button></FloatingActionBar>}
      {deletion.failed && <div role="alert" className="status-note">{t.deleteFailed}<Button disabled={!online} aria-describedby={!online ? offlineId : undefined} onClick={() => scheduleDelete(deletion.failed!)}>{t.retryDelete}</Button></div>}
      <DestructiveConfirm open={deleteOpen} onOpenChange={setDeleteOpen} title={t.delete} consequence={formatCount(locale, selected.length, consequenceForms)} confirmLabel={t.delete} cancelLabel={t.cancel}
        onCloseAutoFocus={event => { if (confirmed.current) { confirmed.current = false; event.preventDefault(); undoButton.current?.focus() } }}
        onConfirm={() => { if (online) { confirmed.current = true; scheduleDelete(selected); setDeleteOpen(false) } }} />
    </section>
    <DeleteUndo ref={undoButton} locale={locale} pending={deletion.pending} submitting={deletion.submitting} onUndo={undo} />
    {sheetFlight !== null && <FlightDetailSheet ownerId={ownerId} locale={locale} flightId={sheetFlight} initialEditing={editing} focusField={focusField} onDelete={id => scheduleDelete([id])} onCloseAutoFocus={closeFocus} onOpenChange={isOpen => { if (!isOpen) { navigate('flight', '', 'replace'); refresh() } }} />}
  </section>
}

export function JournalView(props: Props) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { gcTime: 5 * 60_000 } } }))
  return <QueryClientProvider client={client}><JournalInner {...props} /></QueryClientProvider>
}
