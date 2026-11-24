'use client'
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
  busy: SheetAction | null
  unknown: PendingCommand | null
  checking: boolean
  notRecorded: boolean
  issue: null | { kind: 'conflict' } | { kind: 'gone' } | { kind: 'rejected'; message: string }
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
  onSaved: (journey: GroundJourneyDto) => void
  onDeleted: () => void
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

  const run = useCallback(
    (action: SheetAction): Promise<Outcome> | null => {
      if (!journey || working.current || state.unknown) return null
      return send(startCommand(action, journey))
    },
    [journey, send, state.unknown],
  )

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

  const dismiss = useCallback(() => {
    if (id) put(id, idleActions)
    deps.current.onStale()
  }, [id, put])

  const clearNotice = useCallback(() => {
    if (id) put(id, (old) => ({ ...old, saved: null, issue: null }))
  }, [id, put])
  return { state, run, retry, check, dismiss, clearNotice }
}
