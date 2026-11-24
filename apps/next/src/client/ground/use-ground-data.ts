'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import { todayIso, type GroundJourneyDto, type GroundJourneyList } from '@kuuki/shared/groundTravel'
import { trackPrivateOperation } from '../activity'
import { listJourneys, readJourney, rememberList, rememberedLists } from './api'

type Key = 'active' | 'cancelled'
type Lists = Partial<Record<Key, GroundJourneyList>>

export type GroundList = {
  list: GroundJourneyList | null
  loading: boolean
  refreshing: boolean
  failed: boolean
  today: string | null
  reload: () => void
}

function useRead() {
  return useCallback(
    <T>(
      read: (signal: AbortSignal) => Promise<T>,
      done: (value: T) => void,
      failed: (error: unknown) => void,
    ) => {
      const controller = new AbortController()
      const release = trackPrivateOperation(controller)
      const generation = getAuthGeneration()
      const current = () => !controller.signal.aborted && generation === getAuthGeneration()
      void read(controller.signal)
        .then((value) => current() && done(value))
        .catch((error: unknown) => current() && failed(error))
        .finally(release)
      return () => {
        controller.abort()
        release()
      }
    },
    [],
  )
}

export function useGroundList(ownerId: string, cancelled: boolean): GroundList {
  const key: Key = cancelled ? 'cancelled' : 'active'
  const read = useRead()
  const [remembered] = useState(() => rememberedLists(ownerId))
  const [today, setToday] = useState<string | null>(remembered?.today ?? null)
  const [version, setVersion] = useState(0)
  const [lists, setLists] = useState<Lists>(remembered?.lists ?? {})
  const [answered, setAnswered] = useState<Partial<Record<Key, string>>>({})
  const [failedKeys, setFailedKeys] = useState<ReadonlySet<Key>>(() => new Set())
  const reload = useCallback(() => setVersion((value) => value + 1), [])

  useEffect(() => {
    const update = () =>
      setToday((old) => {
        const next = todayIso()
        return old === next ? old : next
      })
    update()
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  useEffect(() => {
    if (today === null) return
    const token = `${today}|${version}`
    return read(
      (signal) => listJourneys({ cancelled, today }, { signal }),
      (value) => {
        rememberList(ownerId, today, key, value)
        setLists((old) => ({ ...old, [key]: value }))
        setFailedKeys((old) => without(old, key))
        setAnswered((old) => ({ ...old, [key]: token }))
      },
      () => {
        setFailedKeys((old) => new Set(old).add(key))
        setAnswered((old) => ({ ...old, [key]: token }))
      },
    )
  }, [read, ownerId, cancelled, key, today, version])

  const list = lists[key] ?? null
  const failed = failedKeys.has(key)
  const refreshing = list !== null && today !== null && answered[key] !== `${today}|${version}`
  return { list, loading: list === null && !failed, refreshing, failed, today, reload }
}

function without(set: ReadonlySet<Key>, key: Key): ReadonlySet<Key> {
  if (!set.has(key)) return set
  const next = new Set(set)
  next.delete(key)
  return next
}

export type JourneyRead =
  | { status: 'loading'; journey: null }
  | { status: 'ready'; journey: GroundJourneyDto }
  | { status: 'missing'; journey: null }
  | { status: 'error'; journey: GroundJourneyDto | null }

export function useJourneyRead(id: string | null, seed: GroundJourneyDto | null) {
  const read = useRead()
  const cancelRead = useRef<(() => void) | null>(null)
  const [state, setState] = useState<{ id: string | null; value: JourneyRead }>({
    id: null,
    value: { status: 'loading', journey: null },
  })
  const [version, setVersion] = useState(0)
  const seedRef = useRef(seed)
  useEffect(() => {
    seedRef.current = seed
  })
  const reload = useCallback(() => setVersion((value) => value + 1), [])
  useEffect(() => {
    if (id === null) return
    const cancel = read(
      (signal) => readJourney(id, { signal }),
      (journey) => setState({ id, value: { status: 'ready', journey } }),
      (error) =>
        setState({
          id,
          value:
            error instanceof ApiError && error.status === 404
              ? { status: 'missing', journey: null }
              : { status: 'error', journey: seedRef.current },
        }),
    )
    cancelRead.current = cancel
    return cancel
  }, [read, id, version])
  const apply = useCallback((journey: GroundJourneyDto) => {
    cancelRead.current?.()
    setState({ id: journey.id, value: { status: 'ready', journey } })
  }, [])
  const value = useMemo<JourneyRead>(
    () =>
      state.id === id
        ? state.value
        : seed
          ? { status: 'ready', journey: seed }
          : { status: 'loading', journey: null },
    [state, id, seed],
  )
  return { read: value, reload, apply }
}
