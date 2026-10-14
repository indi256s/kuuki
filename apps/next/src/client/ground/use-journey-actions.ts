'use client'
// The detail sheet's action state machine. One command at a time; every new attempt gets a fresh operation key, but a
// command whose answer was lost keeps its key until the owner resolves it (Check result / Try the same change again /
// dismiss). 409 never retries by itself: the latest version is loaded and the owner chooses again.
// State is kept per journey id, so one journey's notice or unresolved command never shows on (or blocks) another; an
// unresolved command stays on its own journey until it is resolved or dismissed.
import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthGeneration } from '@kuuki/client/apiClient'
import type { GroundJourneyDto } from '@kuuki/shared/groundTravel'
import {
  resolveCommand,
  runCommand,
  startCommand,
  type Outcome,
  type PendingCommand,
  type SheetAction,
} from './journey-actions'

type ActionState = {
  /** The action in flight; the sheet is not dismissible and the buttons wait. */
  busy: SheetAction | null
  /** A command whose answer was lost, kept with its key. */
  unknown: PendingCommand | null
  checking: boolean
  /** `not-recorded`: the receipt lookup found nothing, so the change did not happen. */
  notRecorded: boolean
  issue: null | { kind: 'conflict' } | { kind: 'gone' } | { kind: 'rejected'; message: string }
  /** The last action that saved; `pending` means the totals are still being published. */
  saved: null | { action: SheetAction; pending: boolean }
}

const idleActions: ActionState = {
  busy: null,
  unknown: null,
  checking: false,
  notRecorded: false,
  issue: null,
  saved: null,
}

type Deps = {
  journey: GroundJourneyDto | null
  /** A journey the server confirmed after an action (cancel, restore, reopen). */
  onSaved: (journey: GroundJourneyDto) => void
  onDeleted: () => void
  /** Conflict or gone: load what the server has now. */
  onStale: () => void
}

export function useJourneyActions({ journey, onSaved, onDeleted, onStale }: Deps) {
  const [states, setStates] = useState<Readonly<Record<string, ActionState>>>({})
  const id = journey?.id ?? null
  const state = (id && states[id]) || idleActions
  const working = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const deps = useRef({ onSaved, onDeleted, onStale })
  useEffect(() => {
    deps.current = { onSaved, onDeleted, onStale }
  })
  // Opening another journey ends what is in flight for the previous one (it becomes unknown there, not lost).
  useEffect(() => () => controller.current?.abort(), [id])
  useEffect(() => {
    const abort = () => controller.current?.abort()
    window.addEventListener('kuuki:identity-reset', abort)
    return () => {
      window.removeEventListener('kuuki:identity-reset', abort)
      abort()
    }
  }, [])

  const put = useCallback(
    (at: string, next: ActionState | ((old: ActionState) => ActionState)) =>
      setStates((old) => {
        const before = old[at] ?? idleActions
        return { ...old, [at]: typeof next === 'function' ? next(before) : next }
      }),
    [],
  )

  const settle = useCallback(
    (pending: PendingCommand, outcome: Outcome) => {
      const at = pending.journeyId
      switch (outcome.kind) {
        case 'saved': {
          const { result } = outcome
          put(at, {
            ...idleActions,
            saved: { action: pending.action, pending: result.derivedState === 'pending' },
          })
          if (result.outcome === 'deleted' || result.current === null) deps.current.onDeleted()
          else deps.current.onSaved(result.current)
          return
        }
        case 'conflict':
          put(at, { ...idleActions, issue: { kind: 'conflict' } })
          deps.current.onStale()
          return
        case 'gone':
          put(at, { ...idleActions, issue: { kind: 'gone' } })
          deps.current.onStale()
          return
        case 'unknown':
          put(at, { ...idleActions, unknown: pending })
          return
        case 'rejected':
          put(at, { ...idleActions, issue: { kind: 'rejected', message: outcome.message } })
          return
      }
    },
    [put],
  )

  const send = useCallback(
    async (pending: PendingCommand): Promise<Outcome> => {
      working.current = true
      const generation = getAuthGeneration()
      const next = new AbortController()
      controller.current = next
      put(pending.journeyId, { ...idleActions, busy: pending.action })
      try {
        const outcome = await runCommand(pending, next.signal)
        if (next.signal.aborted || generation !== getAuthGeneration()) {
          // The session ended while the answer was in flight: whether it landed is unknown, and nothing here applies.
          put(pending.journeyId, { ...idleActions, unknown: pending })
          return { kind: 'unknown' }
        }
        settle(pending, outcome)
        return outcome
      } finally {
        working.current = false
      }
    },
    [put, settle],
  )

  /** A new action with a new key. Ignored while another is in flight or an unresolved command exists. */
  const run = useCallback(
    (action: SheetAction): Promise<Outcome> | null => {
      if (!journey || working.current || state.unknown) return null
      return send(startCommand(action, journey))
    },
    [journey, send, state.unknown],
  )

  /** The same command, the same key: the server replays it if it already landed. */
  const retry = useCallback(() => {
    if (!state.unknown || working.current) return
    void send(state.unknown)
  }, [send, state.unknown])

  const check = useCallback(async () => {
    const pending = state.unknown
    if (!pending || working.current) return
    working.current = true
    put(pending.journeyId, (old) => ({ ...old, checking: true, notRecorded: false }))
    const next = new AbortController()
    controller.current = next
    try {
      const resolution = await resolveCommand(pending, next.signal)
      if (next.signal.aborted) {
        put(pending.journeyId, (old) => ({ ...old, checking: false }))
        return
      }
      if (resolution.kind === 'failed') {
        put(pending.journeyId, (old) => ({ ...old, checking: false }))
        return
      }
      if (resolution.kind === 'not-recorded') {
        put(pending.journeyId, { ...idleActions, notRecorded: true, unknown: pending })
        return
      }
      const { status } = resolution
      put(pending.journeyId, {
        ...idleActions,
        saved: { action: pending.action, pending: status.derivedState === 'pending' },
      })
      if (status.status === 'deleted' || status.current === null) deps.current.onDeleted()
      else deps.current.onSaved(status.current)
    } finally {
      working.current = false
    }
  }, [put, state.unknown])

  /** Drops an unresolved command (and its key); the owner starts over from what the sheet shows. */
  const dismiss = useCallback(() => {
    if (id) put(id, idleActions)
    deps.current.onStale()
  }, [id, put])

  const clearNotice = useCallback(() => {
    if (id) put(id, (old) => ({ ...old, saved: null, issue: null }))
  }, [id, put])
  return { state, run, retry, check, dismiss, clearNotice }
}
