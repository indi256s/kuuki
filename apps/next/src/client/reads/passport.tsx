'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { api } from '../../../../web/src/lib/apiClient'
import { trackPrivateOperation } from '../activity'
import { RouteMapPanel } from '../maps/panel'
import type { PassportData } from '../../server/passport'
import type { Locale } from '../../server/locale'
import type { OverviewPeriod } from '../../../../../packages/shared/src/overview'

const words = {
  en: { stamps: 'Stamps', map: 'Map', countries: 'Countries', flights: 'Flight visits', claims: 'Claimed places', ground: 'Ground visits', add: 'Add a country', import: 'Import flights', empty: 'Your passport is waiting for its first place.', pending: 'Recent changes are still being prepared. Stamps may lag behind saved flights.', error: 'Could not refresh your passport. Showing the last loaded places.', fail: 'Your passport could not be loaded.', retry: 'Try again', close: 'Close', first: 'First visit', last: 'Last visit', visits: 'Visits', claimed: 'Claimed without flights', land: 'Land or sea visit', air: 'Visited by air', detail: 'Country details', edit: 'Add a visit or change claim', remove: 'Manage this country', unknown: 'Date unknown', byVisits: 'Most visited', recent: 'Recent', alphabetic: 'A–Z', sort: 'Sort stamps' },
  ru: { stamps: 'Штампы', map: 'Карта', countries: 'Страны', flights: 'Посещения перелётом', claims: 'Отмеченные места', ground: 'Наземные посещения', add: 'Добавить страну', import: 'Импортировать перелёты', empty: 'Паспорт ждёт первого места.', pending: 'Последние изменения ещё обрабатываются. Штампы могут отставать от сохранённых перелётов.', error: 'Не удалось обновить паспорт. Показаны последние загруженные места.', fail: 'Не удалось загрузить паспорт.', retry: 'Повторить', close: 'Закрыть', first: 'Первое посещение', last: 'Последнее посещение', visits: 'Посещения', claimed: 'Отмечено без перелётов', land: 'Посещение по земле или морю', air: 'Посещение самолётом', detail: 'Детали страны', edit: 'Добавить посещение или изменить отметку', remove: 'Управление страной', unknown: 'Дата неизвестна', byVisits: 'Частые', recent: 'Недавние', alphabetic: 'А–Я', sort: 'Порядок штампов' },
} as const

type CountryStats = { countryCode: string; firstVisit: string; lastVisit: string; totalVisits: number; airports: { iata: string; city: string; visitCount: number }[]; isClaimed: boolean; groundVisits: { id:string; visitYear:number|null; entryMethod:string|null; note:string|null }[] }
type Entry = { code: string; count: number; first: string; last: string; claimed: boolean; ground: number; air: boolean }
function merge(data: PassportData): Entry[] {
  const entries = new Map<string, Entry>()
  const ensure = (code: string) => {
    let entry = entries.get(code)
    if (!entry) { entry = { code, count: 0, first: '', last: '', claimed: false, ground: 0, air: false }; entries.set(code, entry) }
    return entry
  }
  for (const row of data.visits) {
    const entry = ensure(row.country_code)
    entry.count += row.visit_count ?? 1
    entry.air = true
    if (row.first_visit && (!entry.first || row.first_visit < entry.first)) entry.first = row.first_visit
    if (row.last_visit && (!entry.last || row.last_visit > entry.last)) entry.last = row.last_visit
  }
  for (const row of data.claims) ensure(row.country_code).claimed = true
  for (const row of data.groundVisits) { const entry = ensure(row.country_code); entry.ground++; entry.count++ }
  return [...entries.values()]
}
function Inner({ ownerId, locale, initial, period }: { ownerId: string; locale: Locale; initial: PassportData; period?: OverviewPeriod }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const search = useSearchParams()
  const t = words[locale]
  const view = search.get('view') === 'map' ? 'map' : 'stamps'
  const [sort, setSort] = useState<'recent'|'visits'|'alpha'>('recent')
  const [selected, select] = useState<string | null>(null)
  const collection = useQuery({
    queryKey: ['passport', ownerId],
    queryFn: async ({ signal }) => {
      const controller = new AbortController(); const untrack = trackPrivateOperation(controller)
      signal.addEventListener('abort', () => controller.abort(), { once: true })
      try {
        return await api.get<PassportData>('/api/passport/countries', undefined, { signal: controller.signal })
      } finally { untrack() }
    },
    initialData: initial, initialDataUpdatedAt: initial.updatedAt, staleTime: 60_000, refetchOnWindowFocus: true,
  })
  useEffect(() => {
    const key = ['passport', ownerId]
    const newer = (current: PassportData | undefined) => !current ||
      (initial.revision >= current.revision && initial.publishedRevision >= current.publishedRevision &&
        (initial.revision > current.revision || initial.publishedRevision > current.publishedRevision || initial.updatedAt > current.updatedAt))
    if (!newer(queryClient.getQueryData<PassportData>(key))) return
    let active = true
    void queryClient.cancelQueries({ queryKey: key, exact: true }).then(() => {
      if (active && newer(queryClient.getQueryData<PassportData>(key))) {
        queryClient.setQueryData(key, initial, { updatedAt: initial.updatedAt })
      }
    })
    return () => { active = false }
  }, [queryClient, ownerId, initial])
  const detail = useQuery({
    queryKey: ['passport-country', ownerId, selected], enabled: !!selected,
    queryFn: async ({ signal }) => {
      const controller = new AbortController(); const untrack = trackPrivateOperation(controller)
      signal.addEventListener('abort', () => controller.abort(), { once: true })
      try { return await api.get<CountryStats>(`/api/passport/countries/${selected}/stats`, undefined, { signal: controller.signal }) }
      finally { untrack() }
    }, staleTime: 30_000,
  })
  const regions = useMemo(() => new Intl.DisplayNames([locale], { type: 'region' }), [locale])
  const name = (code: string) => { try { return regions.of(code) ?? code } catch { return code } }
  const date = (value: string) => value ? new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : t.unknown
  const entries = merge(collection.data ?? initial)
  entries.sort((a,b) => sort === 'visits' ? b.count - a.count || name(a.code).localeCompare(name(b.code), locale) : sort === 'alpha' ? name(a.code).localeCompare(name(b.code), locale) : (b.last || '').localeCompare(a.last || '') || name(a.code).localeCompare(name(b.code), locale))
  const countryVisits = entries.map(entry => ({ countryCode: entry.code, count: entry.count, claimed: entry.claimed }))
  const changeView = (next: 'stamps'|'map') => { const p = new URLSearchParams(search.toString()); if (next === 'map') p.set('view','map'); else p.delete('view'); router.push(`/passport${p.size ? `?${p}` : ''}`) }
  return <section data-testid="passport-data" className="read-stack passport-data">
    {(collection.data ?? initial).revision > (collection.data ?? initial).publishedRevision && <p role="status" className="status-note">{t.pending}</p>}
    {collection.isError && <p role="alert" className="status-note">{t.error} <button onClick={() => void collection.refetch()}>{t.retry}</button></p>}
    <div className="figure-strip passport-figures"><div><span className="eyebrow">{t.countries}</span><strong>{new Intl.NumberFormat(locale).format(entries.length)}</strong></div><div><span className="eyebrow">{t.flights}</span><strong>{new Intl.NumberFormat(locale).format(entries.filter(e => e.air).length)}</strong></div><div><span className="eyebrow">{t.claims}</span><strong>{new Intl.NumberFormat(locale).format(entries.filter(e => e.claimed).length)}</strong></div><div><span className="eyebrow">{t.ground}</span><strong>{new Intl.NumberFormat(locale).format(entries.filter(e => e.ground > 0).length)}</strong></div></div>
    <div className="section-heading"><div className="period-switch" role="group" aria-label={t.countries}><button aria-pressed={view === 'stamps'} onClick={() => changeView('stamps')}>{t.stamps}</button><button aria-pressed={view === 'map'} onClick={() => changeView('map')}>{t.map}</button></div><a className="button primary" href="/passport/manage">{t.add}</a></div>
    {view === 'map' ? <RouteMapPanel ownerId={ownerId} locale={locale} period={period} countryVisits={countryVisits} revision={collection.data?.publishedRevision ?? initial.publishedRevision} initiallyOpen onSelectCountry={select} /> : entries.length === 0 ? <div className="read-panel empty-panel"><h2>{t.empty}</h2><div className="read-actions"><a className="button primary" href="/passport/manage">{t.add}</a><a className="button secondary" href="/import">{t.import}</a></div></div> : <><label className="sort-control">{t.sort}<select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="recent">{t.recent}</option><option value="visits">{t.byVisits}</option><option value="alpha">{t.alphabetic}</option></select></label><div className="stamp-grid">{entries.map(entry => <button key={entry.code} type="button" className={`stamp ${entry.air ? 'air' : 'claim'}`} onClick={() => select(entry.code)} aria-label={`${name(entry.code)}, ${entry.count} ${t.visits.toLowerCase()}`}><span className="stamp-face"><span className="stamp-code mono">{entry.code}</span><strong>{name(entry.code)}</strong><small>{entry.first ? entry.first.slice(0,4) : '—'}</small></span><span className="stamp-caption">{entry.air ? t.air : entry.ground ? t.land : t.claimed} · ×{entry.count}</span></button>)}</div></>}
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) select(null) }}><Dialog.Portal><Dialog.Overlay className="read-sheet-overlay" /><Dialog.Content className="read-sheet"><Dialog.Title>{selected ? name(selected) : t.detail}</Dialog.Title><Dialog.Description className="sr-only">{t.detail}</Dialog.Description>{detail.isLoading && <p role="status">…</p>}{detail.isError && <p role="alert">{t.fail} <button onClick={() => void detail.refetch()}>{t.retry}</button></p>}{detail.data && <><dl className="detail-list"><div><dt>{t.first}</dt><dd>{date(detail.data.firstVisit)}</dd></div><div><dt>{t.last}</dt><dd>{date(detail.data.lastVisit)}</dd></div><div><dt>{t.visits}</dt><dd>{detail.data.totalVisits}</dd></div></dl>{detail.data.airports.length > 0 && <ul>{detail.data.airports.map(airport => <li key={airport.iata}>{airport.iata} · {airport.city} · ×{airport.visitCount}</li>)}</ul>}{detail.data.groundVisits.length > 0 && <ul>{detail.data.groundVisits.map(visit => <li key={visit.id}>{visit.visitYear ?? t.unknown} · {visit.entryMethod ?? t.land}{visit.note && <p>{visit.note}</p>}</li>)}</ul>}<a className="button secondary" href={`/passport/manage?countryCode=${selected}`}>{t.edit}</a></>}<Dialog.Close className="button secondary">{t.close}</Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>
}
export function PassportView(props: {ownerId:string;locale:Locale;initial:PassportData;period?:OverviewPeriod}) {
  const [client] = useState(() => new QueryClient())
  return <QueryClientProvider client={client}><Inner {...props} /></QueryClientProvider>
}
