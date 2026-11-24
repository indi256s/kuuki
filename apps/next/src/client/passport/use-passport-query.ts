'use client'

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { normalizePassportQuery, withQuery, type PassportState } from '../../lib/url-state'
import { isCatalogCountry } from './model'

export type PassportPatch = Partial<
  Record<'view' | 'sort' | 'q' | 'region' | 'src' | 'country' | 'as', string | null>
>

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
      else window.history.replaceState(null, '', href)
    },
    [path],
  )
  return { state, navigate }
}
