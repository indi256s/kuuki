'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ROUTE_LINK_EVENT } from '../navigation-link'
import { GROUND_PATH, emptyView, groundSearch, parseGroundUrl, type GroundView } from './url'

const SHEET_ENTRY = 'kuukiGroundSheet'
const ENTRY_KEY = 'kuukiGroundEntry'
const NEXT_HISTORY_KEYS = new Set(['__NA', '_N', '__PRIVATE_NEXTJS_INTERNALS_TREE'])

function ownHistoryState(): Record<string, unknown> {
  const state: Record<string, unknown> = {}
  const current: unknown = window.history.state
  if (current && typeof current === 'object')
    for (const [key, value] of Object.entries(current))
      if (!NEXT_HISTORY_KEYS.has(key)) state[key] = value
  return state
}
const historyValue = (key: string): string | null => {
  const value = (window.history.state as Record<string, unknown> | null)?.[key]
  return typeof value === 'string' ? value : null
}
const newEntryId = () => Math.random().toString(36).slice(2)

export type GroundViewApi = {
  view: GroundView
  setMode: (mode: GroundView['mode']) => void
  setCancelled: (cancelled: boolean) => void
  showAll: () => void
  openJourney: (id: string) => void
  closeJourney: () => void
}

export function useGroundView(initialQuery: string): GroundViewApi {
  const [view, setView] = useState(() => parseGroundUrl(initialQuery))
  const viewRef = useRef(view)
  const sheetParent = useRef<string | null>(null)

  const writeUrl = useCallback((next: GroundView, mode: 'push' | 'replace') => {
    const query = groundSearch(next)
    const url = `${GROUND_PATH}${query ? `?${query}` : ''}`
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
      parent = sheetParent.current !== null && next.journey !== null ? sheetParent.current : null
      state[ENTRY_KEY] = currentEntry ?? newEntryId()
    }
    if (parent === null) delete state[SHEET_ENTRY]
    else state[SHEET_ENTRY] = parent
    try {
      if (mode === 'push') window.history.pushState(state, '', url)
      else if (
        url !== window.location.pathname + window.location.search ||
        parent !== historyValue(SHEET_ENTRY)
      )
        window.history.replaceState(state, '', url)
    } catch {}
    sheetParent.current = parent
  }, [])

  const commit = useCallback(
    (next: GroundView, mode: 'push' | 'replace' = 'replace') => {
      viewRef.current = next
      setView(next)
      writeUrl(next, mode)
    },
    [writeUrl],
  )

  useEffect(() => {
    if (window.location.pathname !== GROUND_PATH) return
    const fromLocation = parseGroundUrl(window.location.search)
    sheetParent.current = fromLocation.journey !== null ? historyValue(SHEET_ENTRY) : null
    if (groundSearch(fromLocation) !== groundSearch(viewRef.current)) {
      viewRef.current = fromLocation
      setView(fromLocation)
    }
    writeUrl(viewRef.current, 'replace')
  }, [writeUrl])

  useEffect(() => {
    const traverse = () => {
      const parent = sheetParent.current
      if (window.location.pathname !== GROUND_PATH) return
      let next = parseGroundUrl(window.location.search)
      sheetParent.current = next.journey !== null ? historyValue(SHEET_ENTRY) : null
      if (parent && next.journey === null && historyValue(ENTRY_KEY) === parent) {
        next = { ...viewRef.current, journey: null }
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
      if (url.pathname !== GROUND_PATH) return
      const next = parseGroundUrl(url.search)
      sheetParent.current = null
      viewRef.current = next
      setView(next)
    }
    window.addEventListener('popstate', traverse)
    window.addEventListener(ROUTE_LINK_EVENT, follow)
    return () => {
      window.removeEventListener('popstate', traverse)
      window.removeEventListener(ROUTE_LINK_EVENT, follow)
    }
  }, [writeUrl])

  const closeJourney = useCallback(() => {
    const current = viewRef.current
    if (current.journey === null) return
    if (sheetParent.current !== null) {
      viewRef.current = { ...current, journey: null }
      setView(viewRef.current)
      window.history.back()
      return
    }
    commit({ ...current, journey: null })
  }, [commit])
  const openJourney = useCallback(
    (id: string) => {
      const current = viewRef.current
      if (current.journey === id) return
      commit({ ...current, journey: id }, current.journey !== null ? 'replace' : 'push')
    },
    [commit],
  )
  const setMode = useCallback(
    (mode: GroundView['mode']) => commit({ ...viewRef.current, mode }),
    [commit],
  )
  const setCancelled = useCallback(
    (cancelled: boolean) => commit({ ...viewRef.current, cancelled }),
    [commit],
  )
  const showAll = useCallback(
    () => commit({ ...emptyView, journey: viewRef.current.journey }),
    [commit],
  )
  return { view, setMode, setCancelled, showAll, openJourney, closeJourney }
}
