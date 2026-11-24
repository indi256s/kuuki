'use client'

import { useLocale } from '../preferences'
import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { ApiError, api, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from '../activity'
import { useOnline } from '../awaiting'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { ROUTE_LINK_EVENT } from '../navigation-link'
import type { Locale } from '../../server/locale'
import type { CloseGuard } from './flight-detail'
import { guardTraversals } from '../history-gate'
import { selectJournal, type JournalSelection } from './filter'
import {
  defaultSort,
  emptyFilters,
  type JournalFilters,
  type JournalFlight,
  type JournalPayload,
  type JournalRefs,
  type JournalSort,
  type JournalViewState,
} from './model'
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
  leaveGuard: RefObject<CloseGuard | null>
  selected: ReadonlySet<number>
  selectedVisible: number[]
  toggle: (id: number) => void
  selectAll: (ids: Iterable<number>) => void
  clear: () => void
  hidden: ReadonlySet<number>
  hide: (ids: Iterable<number>) => void
  unhide: (ids: Iterable<number>) => void
  refresh: (options?: { throwOnError?: boolean }) => Promise<void>
  applyFlight: (flight: JournalFlight, refs?: Partial<JournalRefs>) => void
  isFetching: boolean
  isError: boolean
  online: boolean
}

const JOURNAL_PATH = '/journal'
const SHEET_ENTRY = 'kuukiJournalSheet'
const ENTRY_KEY = 'kuukiJournalEntry'
const ARRIVAL_HASH = /^#arrival-/
const NEXT_HISTORY_KEYS = new Set(['__NA', '_N', '__PRIVATE_NEXTJS_INTERNALS_TREE'])
const LIST_KEYS = [
  'years',
  'airports',
  'countries',
  'airlines',
  'aircraft',
  'families',
  'status',
  'missing',
  'alliances',
] as const

const Context = createContext<JournalStore | null>(null)

const isOpen = (view: JournalViewState) => view.flight !== null || view.review
const closed = (view: JournalViewState): JournalViewState => ({
  ...view,
  flight: null,
  review: false,
})
const journalKey = (ownerId: string) => ['journal', ownerId] as const

function ownHistoryState(extra?: Record<string, unknown>): Record<string, unknown> {
  const state: Record<string, unknown> = {}
  const current: unknown = window.history.state
  if (current && typeof current === 'object')
    for (const [key, value] of Object.entries(current))
      if (!NEXT_HISTORY_KEYS.has(key)) state[key] = value
  return { ...state, ...extra }
}
const historyValue = (key: string): string | null => {
  const value = (window.history.state as Record<string, unknown> | null)?.[key]
  return typeof value === 'string' ? value : null
}
const newEntryId = () => Math.random().toString(36).slice(2)

function normalizeFilters(filters: JournalFilters): JournalFilters {
  const out = { ...filters }
  for (const key of LIST_KEYS) {
    const values = [...new Set<string | number>(filters[key])]
    ;(out[key] as (string | number)[]) =
      key === 'years' ? (values as number[]).sort((a, b) => a - b) : (values as string[]).sort()
  }
  return out
}

const isNewer = (candidate: JournalPayload, current: JournalPayload | undefined) =>
  !current ||
  (candidate.revision >= current.revision &&
    candidate.publishedRevision >= current.publishedRevision &&
    (candidate.revision > current.revision ||
      candidate.publishedRevision > current.publishedRevision ||
      candidate.updatedAt > current.updatedAt))

type Props = {
  ownerId: string
  locale: Locale
  initial: JournalPayload
  initialQuery: string
  children: ReactNode
}

function Store({ ownerId, locale: initialLocale, initial, initialQuery, children }: Props) {
  const locale = useLocale(initialLocale)
  const queryClient = useQueryClient()
  const online = useOnline()
  const identityReset = useRef(false)

  const requiredReads = useRef(new Set<AbortController>())
  const readJournal = useCallback(
    async (signal: AbortSignal) => {
      if (signal.aborted) throw new DOMException('Journal read cancelled', 'AbortError')
      const generation = getAuthGeneration()
      const controller = new AbortController()
      const abort = () => controller.abort()
      signal.addEventListener('abort', abort, { once: true })
      const untrack = trackPrivateOperation(controller)
      try {
        const data = await api.get<JournalPayload>(
          '/api/flights/journal',
          { owner: ownerId },
          { signal: controller.signal },
        )
        if (controller.signal.aborted)
          throw new DOMException('Journal read cancelled', 'AbortError')
        if (identityReset.current || generation !== getAuthGeneration())
          throw new ApiError(409, 'The signed-in account changed', 'OWNER_CHANGED')
        return data
      } catch (error) {
        if (error instanceof ApiError && error.code === 'OWNER_CHANGED')
          identityReset.current = true
        throw error
      } finally {
        signal.removeEventListener('abort', abort)
        untrack()
      }
    },
    [ownerId],
  )

  const list = useQuery({
    queryKey: journalKey(ownerId),
    queryFn: async ({ signal }) => {
      try {
        return await readJournal(signal)
      } catch (error) {
        if (error instanceof ApiError && error.code === 'OWNER_CHANGED')
          return queryClient.getQueryData<JournalPayload>(journalKey(ownerId)) ?? initial
        throw error
      }
    },
    initialData: initial,
    initialDataUpdatedAt: initial.updatedAt,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
  const payload = list.data

  useEffect(() => {
    const key = journalKey(ownerId)
    if (!isNewer(initial, queryClient.getQueryData<JournalPayload>(key))) return
    let active = true
    requiredReads.current.forEach((controller) => controller.abort())
    void queryClient.cancelQueries({ queryKey: key, exact: true }).then(() => {
      if (active && isNewer(initial, queryClient.getQueryData<JournalPayload>(key)))
        queryClient.setQueryData(key, initial, { updatedAt: initial.updatedAt })
    })
    return () => {
      active = false
    }
  }, [queryClient, ownerId, initial])

  const refresh = useCallback(
    async (options?: { throwOnError?: boolean }) => {
      const key = journalKey(ownerId)
      if (!options?.throwOnError) {
        await queryClient.invalidateQueries({ queryKey: key })
        return
      }
      if (!online || !onlineManager.isOnline())
        throw new Error('Cannot refresh the Journal while offline')
      const controller = new AbortController()
      requiredReads.current.add(controller)
      try {
        await queryClient.cancelQueries({ queryKey: key, exact: true })
        const data = await readJournal(controller.signal)
        if (controller.signal.aborted)
          throw new DOMException('Journal read cancelled', 'AbortError')
        if (!onlineManager.isOnline()) throw new Error('Cannot refresh the Journal while offline')
        queryClient.setQueryData<JournalPayload>(key, (current) =>
          current && isNewer(current, data) ? current : data,
        )
      } finally {
        requiredReads.current.delete(controller)
      }
    },
    [queryClient, ownerId, online, readJournal],
  )
  useEffect(() => {
    const running = requiredReads.current
    return () => {
      running.forEach((controller) => controller.abort())
    }
  }, [])
  const applyFlight = useCallback(
    (flight: JournalFlight, refs?: Partial<JournalRefs>) => {
      queryClient.setQueryData<JournalPayload>(journalKey(ownerId), (current) => {
        if (!current || !current.flights.some((item) => item.id === flight.id)) return current
        const flights = current.flights
          .map((item) => (item.id === flight.id ? flight : item))
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || b.id - a.id)
        const merged = refs
          ? {
              airports: { ...current.refs.airports, ...refs.airports },
              airlines: { ...current.refs.airlines, ...refs.airlines },
              aircraft: { ...current.refs.aircraft, ...refs.aircraft },
            }
          : current.refs
        return { ...current, flights, refs: merged }
      })
    },
    [queryClient, ownerId],
  )
  useEffect(() => {
    const changed = () => {
      void refresh()
    }
    const reset = () => {
      identityReset.current = true
      requiredReads.current.forEach((controller) => controller.abort())
      void queryClient.cancelQueries({ queryKey: journalKey(ownerId) })
    }
    window.addEventListener(LIFECYCLE_CHANGED_EVENT, changed)
    window.addEventListener('kuuki:identity-reset', reset)
    return () => {
      window.removeEventListener(LIFECYCLE_CHANGED_EVENT, changed)
      window.removeEventListener('kuuki:identity-reset', reset)
    }
  }, [queryClient, ownerId, refresh])

  const [view, setView] = useState(() => parseJournalUrl(initialQuery))
  const viewRef = useRef(view)
  const sheetParent = useRef<string | null>(null)

  const writeUrl = useCallback((next: JournalViewState, mode: 'push' | 'replace') => {
    const query = journalSearch(next)
    const hash = ARRIVAL_HASH.test(window.location.hash) ? '' : window.location.hash
    const url = `${JOURNAL_PATH}${query ? `?${query}` : ''}${hash}`
    const state = ownHistoryState()
    const currentEntry = historyValue(ENTRY_KEY)
    let parent: string | null
    if (mode === 'push') {
      parent = currentEntry ?? newEntryId()
      if (!currentEntry) {
        try {
          window.history.replaceState(
            { ...ownHistoryState(), [ENTRY_KEY]: parent },
            '',
            window.location.href,
          )
        } catch {}
      }
      state[ENTRY_KEY] = newEntryId()
    } else {
      parent = sheetParent.current !== null && isOpen(next) ? sheetParent.current : null
      state[ENTRY_KEY] = currentEntry ?? newEntryId()
    }
    if (parent === null) delete state[SHEET_ENTRY]
    else state[SHEET_ENTRY] = parent
    try {
      if (mode === 'push') window.history.pushState(state, '', url)
      else if (
        url !== window.location.pathname + window.location.search + window.location.hash ||
        parent !== historyValue(SHEET_ENTRY)
      )
        window.history.replaceState(state, '', url)
    } catch {}
    sheetParent.current = parent
  }, [])

  const commit = useCallback(
    (next: JournalViewState, mode: 'push' | 'replace' = 'replace') => {
      viewRef.current = next
      setView(next)
      writeUrl(next, mode)
    },
    [writeUrl],
  )

  const mounted = useRef(false)
  useEffect(() => {
    if (window.location.pathname !== JOURNAL_PATH) return
    if (mounted.current) {
      writeUrl(viewRef.current, 'replace')
      return
    }
    mounted.current = true
    const fromLocation = parseJournalUrl(window.location.search, window.location.hash)
    sheetParent.current = isOpen(fromLocation) ? historyValue(SHEET_ENTRY) : null
    if (journalSearch(fromLocation) !== journalSearch(viewRef.current)) {
      viewRef.current = fromLocation
      setView(fromLocation)
    }
    writeUrl(viewRef.current, 'replace')
  }, [writeUrl, initialQuery])

  const leaveGuard = useRef<CloseGuard | null>(null)
  useEffect(() => {
    const stopGuarding = guardTraversals((_from, rerun) => {
      const current = viewRef.current
      if (current.flight === null) return false
      const next =
        window.location.pathname === JOURNAL_PATH
          ? parseJournalUrl(window.location.search, window.location.hash)
          : null
      if (next && next.flight === current.flight) return false
      return leaveGuard.current?.(!next || next.flight === null ? 'close' : 'swap', rerun) ?? false
    })
    const traverse = () => {
      const parent = sheetParent.current
      if (window.location.pathname !== JOURNAL_PATH) return
      let next = parseJournalUrl(window.location.search, window.location.hash)
      sheetParent.current = isOpen(next) ? historyValue(SHEET_ENTRY) : null
      if (parent && !isOpen(next) && historyValue(ENTRY_KEY) === parent) {
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
      const next = parseJournalUrl(url.search, url.hash)
      sheetParent.current = null
      viewRef.current = next
      setView(next)
    }
    window.addEventListener('popstate', traverse)
    window.addEventListener(ROUTE_LINK_EVENT, follow)
    return () => {
      stopGuarding()
      window.removeEventListener('popstate', traverse)
      window.removeEventListener(ROUTE_LINK_EVENT, follow)
    }
  }, [writeUrl])

  const setFilters = useCallback(
    (patch: Partial<JournalFilters>) => {
      const current = viewRef.current
      commit({ ...current, filters: normalizeFilters({ ...current.filters, ...patch }) })
    },
    [commit],
  )
  const resetFilters = useCallback(
    () => commit({ ...viewRef.current, filters: emptyFilters() }),
    [commit],
  )
  const setSort = useCallback(
    (sort: JournalSort) => commit({ ...viewRef.current, sort: { ...defaultSort, ...sort } }),
    [commit],
  )
  const closeSheet = useCallback(() => {
    const current = viewRef.current
    if (!isOpen(current)) return
    if (sheetParent.current !== null) {
      viewRef.current = closed(current)
      setView(viewRef.current)
      window.history.back()
      return
    }
    commit(closed(current))
  }, [commit])
  const openFlight = useCallback(
    (id: number | null, opts?: { review?: boolean }) => {
      const show = () => {
        const current = viewRef.current
        const next: JournalViewState = { ...current, flight: id, review: !!opts?.review }
        if (!isOpen(next)) closeSheet()
        else if (next.flight !== current.flight || next.review !== current.review)
          commit(next, isOpen(current) ? 'replace' : 'push')
      }
      const current = viewRef.current
      const next: JournalViewState = { ...current, flight: id, review: !!opts?.review }
      const changes = next.flight !== current.flight || next.review !== current.review
      if (
        changes &&
        current.flight !== null &&
        leaveGuard.current?.(isOpen(next) ? 'swap' : 'close', show)
      )
        return
      show()
    },
    [commit, closeSheet],
  )

  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set())
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set())
  const hiddenRef = useRef(hidden)
  const toggle = useCallback((id: number) => {
    if (hiddenRef.current.has(id)) return
    setSelected((old) => {
      const next = new Set(old)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])
  const selectAll = useCallback((ids: Iterable<number>) => {
    setSelected((old) => {
      const next = new Set(old)
      for (const id of ids) if (!hiddenRef.current.has(id)) next.add(id)
      return next
    })
  }, [])
  const clear = useCallback(() => setSelected((old) => (old.size ? new Set() : old)), [])
  const hide = useCallback((ids: Iterable<number>) => {
    const list = [...ids]
    const next = new Set(hiddenRef.current)
    for (const id of list) next.add(id)
    hiddenRef.current = next
    setHidden(next)
    setSelected((old) =>
      list.some((id) => old.has(id)) ? new Set([...old].filter((id) => !next.has(id))) : old,
    )
  }, [])
  const unhide = useCallback((ids: Iterable<number>) => {
    const next = new Set(hiddenRef.current)
    for (const id of ids) next.delete(id)
    hiddenRef.current = next
    setHidden(next)
  }, [])

  const searchText = useDeferredValue(view.filters.q)
  const matchSearch = useMemo(() => {
    if (!searchText.trim()) return undefined
    const ctx = { refs: payload.refs, locale }
    const search = parseJournalSearch(searchText, ctx)
    return search.terms.length
      ? (flight: JournalFlight) => matchesJournalSearch(flight, search, ctx)
      : undefined
  }, [searchText, payload.refs, locale])
  const visiblePayload = useMemo(
    () =>
      hidden.size
        ? { ...payload, flights: payload.flights.filter((flight) => !hidden.has(flight.id)) }
        : payload,
    [payload, hidden],
  )
  const facetKey = JSON.stringify({ filters: { ...view.filters, q: '' }, sort: view.sort })
  const facets = useMemo(
    () => JSON.parse(facetKey) as { filters: JournalFilters; sort: JournalSort },
    [facetKey],
  )
  const selection = useMemo(
    () => selectJournal(visiblePayload, facets.filters, facets.sort, matchSearch),
    [visiblePayload, facets, matchSearch],
  )
  const selectedVisible = useMemo(
    () =>
      selected.size
        ? selection.matching.filter((flight) => selected.has(flight.id)).map((flight) => flight.id)
        : [],
    [selection, selected],
  )

  const store = useMemo<JournalStore>(
    () => ({
      payload,
      view,
      selection,
      setFilters,
      resetFilters,
      setSort,
      openFlight,
      closeSheet,
      leaveGuard,
      selected,
      selectedVisible,
      toggle,
      selectAll,
      clear,
      hidden,
      hide,
      unhide,
      refresh,
      applyFlight,
      isFetching: list.isFetching,
      isError: list.isError,
      online,
    }),
    [
      payload,
      view,
      selection,
      setFilters,
      resetFilters,
      setSort,
      openFlight,
      closeSheet,
      selected,
      selectedVisible,
      toggle,
      selectAll,
      clear,
      hidden,
      hide,
      unhide,
      refresh,
      applyFlight,
      list.isFetching,
      list.isError,
      online,
    ],
  )
  return <Context.Provider value={store}>{children}</Context.Provider>
}

export function JournalStoreProvider(props: Props) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { gcTime: 5 * 60_000 } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <Store {...props} />
    </QueryClientProvider>
  )
}

export function useJournalStore(): JournalStore {
  const store = useContext(Context)
  if (!store) throw new Error('useJournalStore needs a JournalStoreProvider')
  return store
}

export const useJournalSelection = () => useJournalStore().selection
