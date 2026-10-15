'use client'

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { normalizePassportQuery, withQuery, type PassportState } from '../../lib/url-state'
import { isCatalogCountry } from './model'

export type PassportPatch = Partial<
  Record<'view' | 'sort' | 'q' | 'region' | 'src' | 'country' | 'as', string | null>
>

/**
 * The Passport's URL state for `path` (`/passport` or `/fly/<handle>`). `navigate` rewrites the query through native
 * history, which Next keeps in sync with `useSearchParams` without refetching: `replace` for filters, search, sort and
 * the country sheet, `push` for mode changes (Cards/Map) so Back restores the other view with its filters.
 */
export function usePassportQuery(path: string) {
  const search = useSearchParams()
  const state: PassportState = useMemo(
    () => normalizePassportQuery(search, isCatalogCountry).state,
    [search],
  )
  const navigate = useCallback(
    (patch: PassportPatch, mode: 'push' | 'replace' = 'replace') => {
      const params = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      const href = withQuery(path, normalizePassportQuery(params, isCatalogCountry).query)
      if (mode === 'push') window.history.pushState(null, '', href)
      // Passing Next's own history state would mark the call as router-internal and skip the useSearchParams sync.
      else window.history.replaceState(null, '', href)
    },
    [path],
  )
  return { state, navigate }
}
