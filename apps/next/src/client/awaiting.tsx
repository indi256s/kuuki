'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from './activity'
import { LIFECYCLE_CHANGED_EVENT } from './lifecycle-sync'
import type { readAwaitingQueue } from '../../../../functions/api/_services/queue'

export type AwaitingQueue = Awaited<ReturnType<typeof readAwaitingQueue>>
type QueueRead = { data: AwaitingQueue | null; error: boolean; reload: () => void }
const Context = createContext<QueueRead>({ data: null, error: false, reload: () => {} })

export function AwaitingProvider({ ownerId, children }: { ownerId: string; children: ReactNode }) {
  const [data, setData] = useState<AwaitingQueue | null>(null)
  const [error, setError] = useState(false)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    void api
      .get<AwaitingQueue>('/api/me/awaiting', undefined, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted && generation === getAuthGeneration()) {
          setData(value)
          setError(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && generation === getAuthGeneration()) setError(true)
      })
      .finally(release)
    return () => {
      controller.abort()
      release()
    }
  }, [ownerId, version])
  useEffect(() => {
    window.addEventListener(LIFECYCLE_CHANGED_EVENT, reload)
    window.addEventListener('focus', reload)
    return () => {
      window.removeEventListener(LIFECYCLE_CHANGED_EVENT, reload)
      window.removeEventListener('focus', reload)
    }
  }, [reload])
  return <Context.Provider value={{ data, error, reload }}>{children}</Context.Provider>
}
export const useAwaiting = () => useContext(Context)

export function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
