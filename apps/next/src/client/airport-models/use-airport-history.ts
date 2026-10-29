'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import type { AirportHistory } from '@kuuki/shared/airportHistory'
import { trackPrivateOperation } from '../activity'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'

type HistoryState = {
  key: string
  data: AirportHistory | null
  loading: boolean
  error: boolean
  updating: boolean
}

/** One owner/scope generation owns every page; stale cursors restart instead of mixing snapshots. */
export function useAirportHistory(
  ownerId: string,
  iata: string,
  scope: string | null,
  open: boolean,
  invalid: boolean,
) {
  const key = JSON.stringify([ownerId, iata, scope, invalid])
  const [state, setState] = useState<HistoryState>({
    key,
    data: null,
    loading: false,
    error: false,
    updating: false,
  })
  const active = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  const stopped = useRef(false)
  const dirty = useRef(false)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  const current =
    state.key === key ? state : { key, data: null, loading: false, error: false, updating: false }
  const load = useCallback(
    async function request(cursor: string | null = null): Promise<void> {
      if (invalid || stopped.current) return
      if (!cursor) dirty.current = true
      active.current?.abort()
      const controller = new AbortController()
      active.current = controller
      const release = trackPrivateOperation(controller)
      const generation = getAuthGeneration(),
        id = ++requestId.current
      const valid = () =>
        !controller.signal.aborted &&
        !stopped.current &&
        generation === getAuthGeneration() &&
        id === requestId.current
      setState((previous) => ({
        key,
        data: previous.key === key ? previous.data : null,
        loading: true,
        error: false,
        updating: !cursor && previous.key === key && previous.data !== null,
      }))
      try {
        const data = await api.get<AirportHistory>(
          `/api/me/airports/${iata}/history`,
          { owner: ownerId, scope, cursor },
          { signal: controller.signal, cache: 'no-store' },
        )
        if (!valid()) return
        if (data.ownerId !== ownerId) throw new Error('Airport history owner mismatch')
        const prior = stateRef.current.key === key ? stateRef.current.data : null
        if (
          cursor &&
          prior &&
          data.status === 'ready' &&
          (prior.revision !== data.revision ||
            prior.publishedRevision !== data.publishedRevision ||
            prior.scopeFingerprint !== data.scopeFingerprint)
        ) {
          void request()
          return
        }
        dirty.current = data.status !== 'ready'
        setState((previous) => {
          const before = previous.key === key ? previous.data : null
          if (data.status === 'scope-updating')
            return { key, data: before, loading: false, error: false, updating: true }
          return {
            key,
            data:
              cursor && before
                ? {
                    ...data,
                    items: [
                      ...before.items,
                      ...data.items.filter(
                        (item) => !before.items.some((existing) => existing.id === item.id),
                      ),
                    ],
                  }
                : data,
            loading: false,
            error: false,
            updating: false,
          }
        })
      } catch (error) {
        if (!valid()) return
        if (error instanceof ApiError && error.code === 'STALE_CURSOR' && cursor) {
          release()
          void request()
          return
        }
        setState((previous) => ({
          key,
          data: previous.key === key ? previous.data : null,
          loading: false,
          error: true,
          updating: false,
        }))
      } finally {
        release()
        if (!stopped.current && generation === getAuthGeneration() && id === requestId.current)
          setState((previous) =>
            previous.key === key && previous.loading ? { ...previous, loading: false } : previous,
          )
      }
    },
    [ownerId, iata, scope, invalid, key],
  )
  useEffect(() => {
    const clear = () => {
      stopped.current = true
      active.current?.abort()
      setState({ key, data: null, loading: false, error: false, updating: false })
    }
    const refresh = () => {
      dirty.current = true
      if (open && document.visibilityState !== 'hidden') void load()
    }
    if (
      open &&
      !invalid &&
      (dirty.current || stateRef.current.key !== key || !stateRef.current.data)
    )
      void load()
    window.addEventListener('kuuki:identity-reset', clear)
    window.addEventListener(LIFECYCLE_CHANGED_EVENT, refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active.current?.abort()
      window.removeEventListener('kuuki:identity-reset', clear)
      window.removeEventListener(LIFECYCLE_CHANGED_EVENT, refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [open, invalid, load, key])
  return {
    ...current,
    refresh: () => load(),
    more: () =>
      load(stateRef.current.key === key ? (stateRef.current.data?.nextCursor ?? null) : null),
  }
}
