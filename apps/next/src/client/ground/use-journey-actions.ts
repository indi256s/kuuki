'use client'
// The detail sheet's action state machine. One command at a time; every new attempt gets a fresh operation key, but a
// command whose answer was lost keeps its key until the owner resolves it (Check result / Try the same change again /
// dismiss). 409 never retries by itself: the latest version is loaded and the owner chooses again.
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

export type ActionState = {
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

export const idleActions: ActionState = {
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
  const [state, setState] = useState<ActionState>(idleActions)
  const working = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const deps = useRef({ onSaved, onDeleted, onStale })
  useEffect(() => {
    deps.current = { onSaved, onDeleted, onStale }
  })
  useEffect(() => {
    const abort = () => controller.current?.abort()
    window.addEventListener('kuuki:identity-reset', abort)
    return () => {
      window.removeEventListener('kuuki:identity-reset', abort)
      abort()
    }
  }, [])

  const settle = useCallback((pending: PendingCommand, outcome: Outcome) => {
    switch (outcome.kind) {
      case 'saved': {
        const { result } = outcome
        setState({
          ...idleActions,
          saved: { action: pending.action, pending: result.derivedState === 'pending' },
        })
        if (result.outcome === 'deleted' || result.current === null) deps.current.onDeleted()
        else deps.current.onSaved(result.current)
        return
      }
      case 'conflict':
        setState({ ...idleActions, issue: { kind: 'conflict' } })
        deps.current.onStale()
        return
      case 'gone':
        setState({ ...idleActions, issue: { kind: 'gone' } })
        deps.current.onStale()
        return
      case 'unknown':
        setState({ ...idleActions, unknown: pending })
        return
      case 'rejected':
        setState({ ...idleActions, issue: { kind: 'rejected', message: outcome.message } })
        return
    }
  }, [])

  const send = useCallback(
    async (pending: PendingCommand): Promise<Outcome> => {
      working.current = true
      const generation = getAuthGeneration()
      const next = new AbortController()
      controller.current = next
      setState({ ...idleActions, busy: pending.action })
      try {
        const outcome = await runCommand(pending, next.signal)
        if (next.signal.aborted || generation !== getAuthGeneration()) {
          // The session ended while the answer was in flight: whether it landed is unknown, and nothing here applies.
          setState({ ...idleActions, unknown: pending })
          return { kind: 'unknown' }
        }
        settle(pending, outcome)
        return outcome
      } finally {
        working.current = false
      }
    },
    [settle],
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
    setState((old) => ({ ...old, checking: true, notRecorded: false }))
    const next = new AbortController()
    controller.current = next
    try {
      const resolution = await resolveCommand(pending, next.signal)
      if (next.signal.aborted) return
      if (resolution.kind === 'failed') {
        setState((old) => ({ ...old, checking: false }))
        return
      }
      if (resolution.kind === 'not-recorded') {
        setState({ ...idleActions, notRecorded: true, unknown: pending })
        return
      }
      const { status } = resolution
      setState({
        ...idleActions,
        saved: { action: pending.action, pending: status.derivedState === 'pending' },
      })
      if (status.status === 'deleted' || status.current === null) deps.current.onDeleted()
      else deps.current.onSaved(status.current)
    } finally {
      working.current = false
    }
  }, [state.unknown])

  /** Drops an unresolved command (and its key); the owner starts over from what the sheet shows. */
  const dismiss = useCallback(() => {
    setState(idleActions)
    deps.current.onStale()
  }, [])

  const clearNotice = useCallback(
    () => setState((old) => ({ ...old, saved: null, issue: null })),
    [],
  )
  return { state, run, retry, check, dismiss, clearNotice }
}
