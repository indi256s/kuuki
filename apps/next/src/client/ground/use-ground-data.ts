'use client'
// Reads for the ground-travel page: the list (one fetch per active/cancelled view; the transport filter is applied
// locally, so switching it never refetches) and one journey for the detail sheet. Answers that arrive after a
// session change, a newer request or an unmount are dropped.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import { todayIso, type GroundJourneyDto, type GroundJourneyList } from '@kuuki/shared/groundTravel'
import { trackPrivateOperation } from '../activity'
import { listJourneys, readJourney, rememberList, rememberedLists } from './api'

type Key = 'active' | 'cancelled'
type Lists = Partial<Record<Key, GroundJourneyList>>

export type GroundList = {
  /** The list for the requested view, or null before the first answer for it. */
  list: GroundJourneyList | null
  /** No list yet and no failure: show the skeleton. */
  loading: boolean
  /** A cached list is showing while a newer read is in flight. */
  refreshing: boolean
  /** The last read for this view failed. With `list` set, the rows are an older answer (refresh failed). */
  failed: boolean
  /** The cut-off the groups were computed with; null until the browser's zone is read. */
  today: string | null
  reload: () => void
}

/** Starts a tracked read; returns a canceller. The answer is delivered only while the request is current. */
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
  // A return visit starts from the tab's last answers (refreshing), not the skeleton. A full load has none, so hydration matches.
  const [remembered] = useState(() => rememberedLists(ownerId))
  const [today, setToday] = useState<string | null>(remembered?.today ?? null)
  const [version, setVersion] = useState(0)
  const [lists, setLists] = useState<Lists>(remembered?.lists ?? {})
  // The request token (zone date + reload count) each view last got an answer for; a token behind the current one means a read is in flight.
  const [answered, setAnswered] = useState<Partial<Record<Key, string>>>({})
  const [failedKeys, setFailedKeys] = useState<ReadonlySet<Key>>(() => new Set())
  const reload = useCallback(() => setVersion((value) => value + 1), [])

  // todayISO in the browser's zone. A new day recomputes the groups (never the statuses) when the page regains focus.
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
  /** The owner-masked 404: missing, deleted and foreign ids look the same. */
  | { status: 'missing'; journey: null }
  /** The read failed; `journey` is the list's copy when there is one. */
  | { status: 'error'; journey: GroundJourneyDto | null }

/** The journey behind `?journey=<id>`, read by owner and id whatever the list filter shows. */
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
  /** Puts a server-confirmed journey in place at once (an action's answer), before any refetch. */
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
