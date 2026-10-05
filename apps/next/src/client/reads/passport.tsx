'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../../web/src/lib/apiClient'
import { trackPrivateOperation } from '../activity'
import { RouteMapPanel, type MapLayer } from '../maps/panel'
import type { CountryVisit } from '../maps/preview'
import { SegmentedControl } from '../ui/segmented-control'
import { useMobile } from '../ui/use-mobile'
import { AddCountrySheet } from '../passport/add-country-sheet'
import { EmptyPassport, PassportCover, StampGroups, StampKey } from '../passport/collection'
import { CountrySheet, countryDetailQuery } from '../passport/country-sheet'
import { arrivalFlightId, arrivalHref, countryNamer, groupByRegion, headerFigures, isCatalogCountry, passportEntries, sortEntries, type PassportSort } from '../passport/model'
import type { PassportData } from '../../server/passport'
import type { Locale } from '../../server/locale'
import { normalizePassportQuery, withQuery } from '../../lib/url-state'
import type { OverviewPeriod } from '../../../../../packages/shared/src/overview'

type Patch = Partial<Record<'view' | 'sort' | 'country' | 'layer', string | null>>

function Inner({ ownerId, locale, initial, period }: { ownerId: string; locale: Locale; initial: PassportData; period?: OverviewPeriod }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const search = useSearchParams()
  const state = normalizePassportQuery(search, isCatalogCountry).state
  const ru = locale === 'ru'
  const mobile = useMobile()
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  // A pending slot resolving its arrival card: shown while the evidence loads, dropped when the member leaves or acts.
  const [opening, setOpening] = useState<string | null>(null)
  const arrivalIntent = useRef<{ code: string } | null>(null)
  useEffect(() => () => { arrivalIntent.current = null }, [])
  // Countries added in this session press onto the grid once (Stamp keeps the per-ID memory).
  const [pressed, setPressed] = useState<ReadonlyMap<string, string>>(new Map())
  const [now] = useState(() => new Date())

  const collection = useQuery({
    queryKey: ['passport', ownerId],
    queryFn: async ({ signal }) => {
      const controller = new AbortController(); const untrack = trackPrivateOperation(controller)
      signal.addEventListener('abort', () => controller.abort(), { once: true })
      try { return await api.get<PassportData>('/api/passport/countries', undefined, { signal: controller.signal }) }
      finally { untrack() }
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
      if (active && newer(queryClient.getQueryData<PassportData>(key))) queryClient.setQueryData(key, initial, { updatedAt: initial.updatedAt })
    })
    return () => { active = false }
  }, [queryClient, ownerId, initial])

  const data = collection.data ?? initial
  const name = useMemo(() => countryNamer(locale), [locale])
  const entries = useMemo(() => passportEntries(data), [data])
  const groups = useMemo(() => groupByRegion(sortEntries(entries, state.sort, name, locale)), [entries, state.sort, name, locale])
  const figures = headerFigures(data, entries, now)
  const countryVisits = useMemo<CountryVisit[]>(() => entries.map(entry => ({
    countryCode: entry.code, count: entry.visits, claimed: entry.kind !== 'air', pending: entry.status === 'pending',
  })), [entries])

  // C1: view is a mode (a history entry and H1 focus, via the router); sort, layer and the detail sheet replace the
  // entry in place. Native replaceState keeps useSearchParams in sync without a server round trip.
  const navigate = useCallback((patch: Patch, mode: 'push' | 'replace' = 'replace') => {
    arrivalIntent.current = null; setOpening(null)
    const params = new URLSearchParams(search.toString())
    for (const [key, value] of Object.entries(patch)) { if (value) params.set(key, value); else params.delete(key) }
    const href = withQuery('/passport', normalizePassportQuery(params, isCatalogCountry).query)
    if (mode === 'push') router.push(href, { scroll: false })
    // Passing Next's own history state would mark the call as router-internal and skip the useSearchParams sync.
    else window.history.replaceState(null, '', href)
  }, [router, search])
  const opener = useRef<HTMLElement | null>(null)
  const openCountry = useCallback((code: string) => {
    opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    navigate({ country: code })
  }, [navigate])

  // A pending slot's arrival card comes from the country's published evidence, not from the queue page's flags.
  // Repeated activation of the same slot is ignored; a newer activation, any other navigation or leaving the page
  // supersedes it, so a late read never pulls the member away.
  async function openArrival(code: string) {
    if (arrivalIntent.current?.code === code) return
    const intent = { code }
    arrivalIntent.current = intent
    setOpening(code)
    const flight = await queryClient.fetchQuery(countryDetailQuery(ownerId, code)).then(arrivalFlightId, () => null)
    if (arrivalIntent.current !== intent) return
    arrivalIntent.current = null
    setOpening(null)
    router.push(arrivalHref(flight))
  }
  const startAdding = () => { arrivalIntent.current = null; setOpening(null); setAdding(true) }

  async function changed(code: string, added: boolean) {
    if (added) setPressed(current => new Map(current).set(code, `added:${code}:${Date.now()}`))
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['passport', ownerId], exact: true }),
      queryClient.invalidateQueries({ queryKey: ['passport-country', ownerId] }),
    ])
  }
  function removed(code: string) {
    navigate({ country: null })
    setNotice(ru ? `Страна «${name(code)}» удалена из паспорта.` : `${name(code)} was removed from your passport.`)
  }
  // Focus returns to the stamp (or map list item) that opened the sheet; when it is gone (a removed country, a
  // deep link), to the page heading.
  const restoreFocus = (event: Event) => {
    const opened = opener.current?.isConnected ? opener.current : null
    const target = opened ?? document.querySelector<HTMLElement>('main h1')
    if (!target) return
    event.preventDefault()
    // The heading is not focusable by itself; RouteFocus prepares it the same way.
    if (!opened) target.tabIndex = -1
    target.focus({ preventScroll: !opened })
  }

  return <section data-testid="passport-data" className="read-stack passport-data">
    {data.derivedState !== 'ready' && <p role="status" className="status-note">{ru
      ? 'Последние изменения ещё обрабатываются. Штампы могут отставать от сохранённых перелётов.'
      : 'Recent changes are still being prepared. Stamps may lag behind saved flights.'}</p>}
    {collection.isError && <p role="alert" className="status-note">{ru ? 'Не удалось обновить паспорт. Показаны последние загруженные места.' : 'Could not refresh your passport. Showing the last loaded places.'}{' '}
      <button type="button" onClick={() => void collection.refetch()}>{ru ? 'Повторить' : 'Try again'}</button></p>}
    <PassportCover locale={locale} figures={figures} regions={data.regions} name={name} onAdd={startAdding} now={now} />
    <p role="status" className="passport-caption">{opening
      ? (ru ? `Открываем карточку прилёта: ${name(opening)}…` : `Opening the arrival card for ${name(opening)}…`)
      : notice}</p>
    <div className="passport-toolbar">
      <SegmentedControl label={ru ? 'Вид паспорта' : 'Passport view'} value={state.view} onChange={view => navigate({ view: view === 'stamps' ? null : view }, 'push')}
        options={[{ value: 'stamps', label: ru ? 'Штампы' : 'Stamps' }, { value: 'map', label: ru ? 'Карта' : 'Map' }]} />
      {state.view === 'stamps' && entries.length ? <SegmentedControl<PassportSort> label={ru ? 'Порядок штампов' : 'Sort stamps'} value={state.sort}
        onChange={sort => navigate({ sort: sort === 'recent' ? null : sort })}
        options={[{ value: 'recent', label: ru ? 'Недавние' : 'Recent' }, { value: 'visits', label: ru ? 'По визитам' : 'Most visits' }, { value: 'name', label: ru ? 'А–Я' : 'A–Z' }]} /> : null}
    </div>
    {state.view === 'map'
      ? <RouteMapPanel ownerId={ownerId} locale={locale} period={period} countryVisits={countryVisits} initiallyOpen
        revision={data.publishedRevision} onSelectCountry={openCountry} layer={state.layer}
        onLayerChange={(layer: MapLayer) => navigate({ layer: layer === 'countries' ? null : layer })}
        describeCountry={visit => visit.pending ? (ru ? ' · ждёт отметки' : ' · waiting for confirmation') : null} />
      : entries.length === 0
        ? <EmptyPassport locale={locale} onAdd={startAdding} />
        : <>
          <StampKey locale={locale} />
          <StampGroups groups={groups} locale={locale} name={name} onOpen={openCountry} onOpenArrival={code => void openArrival(code)} opening={opening} pressed={pressed} now={now} />
        </>}
    {mobile === null ? null : <>
      <CountrySheet ownerId={ownerId} locale={locale} code={state.country} entry={entries.find(entry => entry.code === state.country)} publishedRevision={data.publishedRevision} mobile={mobile}
        name={name} onClose={() => navigate({ country: null })} onChanged={changed} onRemoved={removed}
        onCloseAutoFocus={restoreFocus} />
      <AddCountrySheet open={adding} onOpenChange={setAdding} locale={locale} mobile={mobile} entries={entries} name={name}
        onPick={(code, addOpener) => { setAdding(false); opener.current = addOpener; navigate({ country: code }) }} />
    </>}
  </section>
}

export function PassportView(props: { ownerId: string; locale: Locale; initial: PassportData; period?: OverviewPeriod }) {
  const [client] = useState(() => new QueryClient())
  return <QueryClientProvider client={client}><Inner {...props} /></QueryClientProvider>
}
