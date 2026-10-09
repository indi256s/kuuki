'use client'
/**
 * The Journal's in-memory store (spec "Data and state", D4). One provider per page owns the payload, the view state
 * the URL mirrors, row selection and optimistically hidden rows. Not shared with the Overview.
 *
 * `useJournalStore()` returns:
 * - `payload`: the whole `JournalPayload` (TanStack Query `['journal', ownerId]`, seeded by the server page).
 * - `view`: `JournalViewState` (filters, sort, open flight, review mode). Initialised from the server's raw query, so
 *   the first render already matches the URL.
 * - `selection`: memoised `selectJournal` over the payload minus hidden rows, with the deferred search text.
 * - `setFilters(patch)`, `resetFilters()`, `setSort(sort)`: update state at once and `history.replaceState`. Never push,
 *   never move focus.
 * - `openFlight(id, { review })`: from closed pushes one history entry; while open replaces it. `closeSheet()` steps
 *   Back over the entry it pushed (keeping the current filters), otherwise replaces. Browser Back closes the sheet.
 * - `selected` (all ticked ids), `selectedVisible` (ticked ids among `selection.matching`, in ledger order; act on
 *   these), `toggle(id)`, `selectAll(ids)`, `clear()`. Ticks survive filter changes; hidden ids can't be ticked.
 * - `hidden`, `hide(ids)`, `unhide(ids)`: rows a deferred delete has taken out of the ledger until it commits or undoes.
 * - `refresh()` (refetch the payload), `isFetching`, `isError` (a background refresh failed; rows stay), `online`.
 *
 * `useJournalSelection()` is a shortcut for `useJournalStore().selection`.
 */
import { createContext, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from '../activity'
import { useOnline } from '../awaiting'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { ROUTE_LINK_EVENT } from '../navigation-link'
import type { Locale } from '../../server/locale'
import { selectJournal, type JournalSelection } from './filter'
import { defaultSort, emptyFilters, type JournalFilters, type JournalFlight, type JournalPayload, type JournalSort, type JournalViewState } from './model'
import { matchesJournalSearch, parseJournalSearch } from './search'
import { journalSearch, parseJournalUrl } from './url'

export type JournalStore = {
  payload: JournalPayload
  view: JournalViewState
  selection: JournalSelection
  setFilters: (patch: Partial<JournalFilters>) => void
  resetFilters: () => void
  setSort: (sort: JournalSort) => void
  openFlight: (id: number | null, opts?: { review?: boolean }) => void
  closeSheet: () => void
  selected: ReadonlySet<number>
  selectedVisible: number[]
  toggle: (id: number) => void
  selectAll: (ids: Iterable<number>) => void
  clear: () => void
  hidden: ReadonlySet<number>
  hide: (ids: Iterable<number>) => void
  unhide: (ids: Iterable<number>) => void
  refresh: () => Promise<void>
  isFetching: boolean
  isError: boolean
  online: boolean
}

const JOURNAL_PATH = '/journal'
/** Marks a history entry this store pushed for the sheet, so closing it can step Back instead of adding history. */
const SHEET_ENTRY = 'kuukiJournalSheet'
const ARRIVAL_HASH = /^#arrival-/
const NEXT_HISTORY_KEYS = new Set(['__NA', '_N', '__PRIVATE_NEXTJS_INTERNALS_TREE'])
const LIST_KEYS = ['years', 'airports', 'countries', 'airlines', 'aircraft', 'families', 'status', 'missing', 'alliances'] as const

const Context = createContext<JournalStore | null>(null)

const isOpen = (view: JournalViewState) => view.flight !== null || view.review
const closed = (view: JournalViewState): JournalViewState => ({ ...view, flight: null, review: false })
const journalKey = (ownerId: string) => ['journal', ownerId] as const

/** The app's own keys in `history.state`. Next's patched history copies its internals back in, and only syncs
 * `useSearchParams` when the state passed in does not already carry them. */
function ownHistoryState(extra?: Record<string, unknown>): Record<string, unknown> {
  const state: Record<string, unknown> = {}
  const current: unknown = window.history.state
  if (current && typeof current === 'object') for (const [key, value] of Object.entries(current)) if (!NEXT_HISTORY_KEYS.has(key)) state[key] = value
  return { ...state, ...extra }
}
const onSheetEntry = () => !!(window.history.state as Record<string, unknown> | null)?.[SHEET_ENTRY]

function normalizeFilters(filters: JournalFilters): JournalFilters {
  const out = { ...filters }
  for (const key of LIST_KEYS) {
    const values = [...new Set<string | number>(filters[key])]
    ;(out[key] as (string | number)[]) = key === 'years' ? (values as number[]).sort((a, b) => a - b) : (values as string[]).sort()
  }
  return out
}

/** A newer server payload replaces the cached one; an older one (a late or cached page render) never does. */
const isNewer = (candidate: JournalPayload, current: JournalPayload | undefined) => !current
  || (candidate.revision >= current.revision && candidate.publishedRevision >= current.publishedRevision
    && (candidate.revision > current.revision || candidate.publishedRevision > current.publishedRevision || candidate.updatedAt > current.updatedAt))

type Props = { ownerId: string; locale: Locale; initial: JournalPayload; initialQuery: string; children: ReactNode }

function Store({ ownerId, locale, initial, initialQuery, children }: Props) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const identityReset = useRef(false)

  const list = useQuery({
    queryKey: journalKey(ownerId),
    queryFn: async ({ signal }) => {
      const generation = getAuthGeneration()
      const controller = new AbortController()
      const untrack = trackPrivateOperation(controller)
      signal.addEventListener('abort', () => controller.abort(), { once: true })
      try {
        const data = await api.get<JournalPayload>('/api/flights/journal', undefined, { signal: controller.signal })
        // A response that outlived the session it was asked for is never shown; the page is navigating away.
        if (identityReset.current || generation !== getAuthGeneration()) return queryClient.getQueryData<JournalPayload>(journalKey(ownerId)) ?? initial
        return data
      } finally { untrack() }
    },
    initialData: initial, initialDataUpdatedAt: initial.updatedAt, staleTime: 60_000, refetchOnWindowFocus: true, retry: 1,
  })
  const payload = list.data

  // A later server render (router.refresh, freshness) brings a new `initial`; adopt it only when it is newer than the cache.
  useEffect(() => {
    const key = journalKey(ownerId)
    if (!isNewer(initial, queryClient.getQueryData<JournalPayload>(key))) return
    let active = true
    void queryClient.cancelQueries({ queryKey: key, exact: true }).then(() => {
      if (active && isNewer(initial, queryClient.getQueryData<JournalPayload>(key))) queryClient.setQueryData(key, initial, { updatedAt: initial.updatedAt })
    })
    return () => { active = false }
  }, [queryClient, ownerId, initial])

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: journalKey(ownerId) }), [queryClient, ownerId])
  useEffect(() => {
    const changed = () => { void refresh() }
    const reset = () => { identityReset.current = true; void queryClient.cancelQueries({ queryKey: journalKey(ownerId) }) }
    window.addEventListener(LIFECYCLE_CHANGED_EVENT, changed)
    window.addEventListener('kuuki:identity-reset', reset)
    return () => { window.removeEventListener(LIFECYCLE_CHANGED_EVENT, changed); window.removeEventListener('kuuki:identity-reset', reset) }
  }, [queryClient, ownerId, refresh])

  // View state. `viewRef` is the latest committed view, so handlers that run between renders build on it.
  const [view, setView] = useState(() => parseJournalUrl(initialQuery))
  const viewRef = useRef(view)
  /** Whether the current history entry is one this store pushed for the sheet. */
  const sheetEntry = useRef(false)

  const writeUrl = useCallback((next: JournalViewState, mode: 'push' | 'replace') => {
    const query = journalSearch(next)
    const hash = ARRIVAL_HASH.test(window.location.hash) ? '' : window.location.hash
    const url = `${JOURNAL_PATH}${query ? `?${query}` : ''}${hash}`
    const sheet = mode === 'push' || (sheetEntry.current && isOpen(next))
    const state = ownHistoryState()
    delete state[SHEET_ENTRY]
    if (sheet) state[SHEET_ENTRY] = true
    try {
      if (mode === 'push') window.history.pushState(state, '', url)
      else if (url !== window.location.pathname + window.location.search + window.location.hash || sheet !== onSheetEntry()) window.history.replaceState(state, '', url)
    } catch {
      // Browsers throttle history writes (Safari: 100 per 30 s). The view state stays right; the next write catches the URL up.
    }
    sheetEntry.current = sheet
  }, [])

  const commit = useCallback((next: JournalViewState, mode: 'push' | 'replace' = 'replace') => {
    viewRef.current = next
    setView(next)
    writeUrl(next, mode)
  }, [writeUrl])

  // Canonicalise on mount: legacy aliases and `#arrival-<id>` (the server never sees the hash) become the current form.
  // A later server render (a shell link to a legacy `/journal?queue=awaiting`) only rewrites the URL to the current view.
  const mounted = useRef(false)
  useEffect(() => {
    if (window.location.pathname !== JOURNAL_PATH) return
    if (mounted.current) { writeUrl(viewRef.current, 'replace'); return }
    mounted.current = true
    const fromLocation = parseJournalUrl(window.location.search, window.location.hash)
    sheetEntry.current = onSheetEntry() && isOpen(fromLocation)
    if (journalSearch(fromLocation) !== journalSearch(viewRef.current)) {
      viewRef.current = fromLocation
      // The location hash cannot be read during the server render.
      setView(fromLocation)
    }
    writeUrl(viewRef.current, 'replace')
  }, [writeUrl, initialQuery])

  // Back/Forward and shell links to /journal replace the view from their URL.
  useEffect(() => {
    const traverse = () => {
      const wasSheetEntry = sheetEntry.current
      if (window.location.pathname !== JOURNAL_PATH) return
      let next = parseJournalUrl(window.location.search, window.location.hash)
      sheetEntry.current = onSheetEntry() && isOpen(next)
      if (wasSheetEntry && !isOpen(next)) {
        // Back from the sheet's own entry only closes it: filters changed while it was open stay.
        next = closed(viewRef.current)
        viewRef.current = next
        setView(next)
        writeUrl(next, 'replace')
        return
      }
      viewRef.current = next
      setView(next)
    }
    const follow = (event: Event) => {
      const url = new URL((event as CustomEvent<string>).detail, window.location.href)
      if (url.pathname !== JOURNAL_PATH) return
      // The link's own navigation writes the URL; only the view follows it here.
      const next = parseJournalUrl(url.search, url.hash)
      sheetEntry.current = false
      viewRef.current = next
      setView(next)
    }
    window.addEventListener('popstate', traverse)
    window.addEventListener(ROUTE_LINK_EVENT, follow)
    return () => { window.removeEventListener('popstate', traverse); window.removeEventListener(ROUTE_LINK_EVENT, follow) }
  }, [writeUrl])

  const setFilters = useCallback((patch: Partial<JournalFilters>) => {
    const current = viewRef.current
    commit({ ...current, filters: normalizeFilters({ ...current.filters, ...patch }) })
  }, [commit])
  const resetFilters = useCallback(() => commit({ ...viewRef.current, filters: emptyFilters() }), [commit])
  const setSort = useCallback((sort: JournalSort) => commit({ ...viewRef.current, sort: { ...defaultSort, ...sort } }), [commit])
  const closeSheet = useCallback(() => {
    const current = viewRef.current
    if (!isOpen(current)) return
    if (sheetEntry.current) {
      // Step Back over the entry the sheet pushed; `traverse` then keeps the current filters on the entry below.
      viewRef.current = closed(current)
      setView(viewRef.current)
      window.history.back()
      return
    }
    commit(closed(current))
  }, [commit])
  const openFlight = useCallback((id: number | null, opts?: { review?: boolean }) => {
    const current = viewRef.current
    const next: JournalViewState = { ...current, flight: id, review: !!opts?.review }
    if (!isOpen(next)) { closeSheet(); return }
    if (next.flight === current.flight && next.review === current.review) return
    commit(next, isOpen(current) ? 'replace' : 'push')
  }, [commit, closeSheet])

  // Selection and optimistically hidden rows.
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set())
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set())
  const hiddenRef = useRef(hidden)
  const toggle = useCallback((id: number) => {
    if (hiddenRef.current.has(id)) return
    setSelected(old => { const next = new Set(old); if (!next.delete(id)) next.add(id); return next })
  }, [])
  const selectAll = useCallback((ids: Iterable<number>) => {
    setSelected(old => { const next = new Set(old); for (const id of ids) if (!hiddenRef.current.has(id)) next.add(id); return next })
  }, [])
  const clear = useCallback(() => setSelected(old => old.size ? new Set() : old), [])
  const hide = useCallback((ids: Iterable<number>) => {
    const list = [...ids]
    const next = new Set(hiddenRef.current)
    for (const id of list) next.add(id)
    hiddenRef.current = next
    setHidden(next)
    setSelected(old => list.some(id => old.has(id)) ? new Set([...old].filter(id => !next.has(id))) : old)
  }, [])
  const unhide = useCallback((ids: Iterable<number>) => {
    const next = new Set(hiddenRef.current)
    for (const id of ids) next.delete(id)
    hiddenRef.current = next
    setHidden(next)
  }, [])

  // Derived list. Search text is deferred so typing stays responsive; facets apply at once.
  const searchText = useDeferredValue(view.filters.q)
  const matchSearch = useMemo(() => {
    if (!searchText.trim()) return undefined
    const ctx = { refs: payload.refs, locale }
    const search = parseJournalSearch(searchText, ctx)
    return search.terms.length ? (flight: JournalFlight) => matchesJournalSearch(flight, search, ctx) : undefined
  }, [searchText, payload.refs, locale])
  const visiblePayload = useMemo(() => hidden.size ? { ...payload, flights: payload.flights.filter(flight => !hidden.has(flight.id)) } : payload, [payload, hidden])
  // Facets keyed by value without `q`, so a keystroke does not rerun the selection with the old search before the deferred one.
  const facetKey = JSON.stringify({ filters: { ...view.filters, q: '' }, sort: view.sort })
  const facets = useMemo(() => JSON.parse(facetKey) as { filters: JournalFilters; sort: JournalSort }, [facetKey])
  const selection = useMemo(() => selectJournal(visiblePayload, facets.filters, facets.sort, matchSearch), [visiblePayload, facets, matchSearch])
  const selectedVisible = useMemo(() => selected.size ? selection.matching.filter(flight => selected.has(flight.id)).map(flight => flight.id) : [], [selection, selected])

  const store = useMemo<JournalStore>(() => ({
    payload, view, selection, setFilters, resetFilters, setSort, openFlight, closeSheet,
    selected, selectedVisible, toggle, selectAll, clear, hidden, hide, unhide,
    refresh, isFetching: list.isFetching, isError: list.isError, online,
  }), [payload, view, selection, setFilters, resetFilters, setSort, openFlight, closeSheet, selected, selectedVisible, toggle, selectAll, clear, hidden, hide, unhide, refresh, list.isFetching, list.isError, online])
  return <Context.Provider value={store}>{children}</Context.Provider>
}

export function JournalStoreProvider(props: Props) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { gcTime: 5 * 60_000 } } }))
  return <QueryClientProvider client={client}><Store {...props} /></QueryClientProvider>
}

export function useJournalStore(): JournalStore {
  const store = useContext(Context)
  if (!store) throw new Error('useJournalStore needs a JournalStoreProvider')
  return store
}

export const useJournalSelection = () => useJournalStore().selection
