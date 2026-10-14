'use client'
/**
 * The Journal's one deferred delete (spec D1, "Selection and bulk actions"). Bulk Delete, bulk Did not fly, review-mode
 * Did not fly and mobile swipe Delete all schedule through this owner, so there is one pending operation and one Undo notice.
 *
 * `<JournalDeleteProvider locale hide unhide refresh>` mounts once per Journal page, inside the member shell's `ToastProvider`
 * (the notice renders in its toast region through `ToastSlot`). `hide`/`unhide`/`refresh` are the Journal store's.
 *
 * `useJournalDelete()` returns:
 * - `scheduleDelete(ids, { label?, onUndo?, focusUndo? })`: hides the rows at once and starts a 6 s countdown (paused while the
 *   tab is hidden) with Undo in the toast region. `label` replaces the default "N flights are being deleted." text.
 *   Focus moves to Undo unless `focusUndo` is false (a caller inside a modal sheet renders its own Undo with `pending`/`undo`).
 *   When the countdown ends: one `DELETE /api/flights/:id`, or `POST /api/flights/bulk-delete` for several.
 * - `pending`: the scheduled operation (`ids`, `seconds` left, `label`), or null. Null once its request is sent.
 * - `undo()`: cancels the pending operation, brings its rows back and then calls its `onUndo` (which then owns focus and any
 *   navigation); without `onUndo`, focus goes to the first restored ledger row, else the page heading.
 *
 * A second `scheduleDelete` while one is pending commits the pending one at once (its request is sent, it can no longer be
 * undone) and then schedules the new one. Only the newest operation is ever undoable, so the one Undo is never ambiguous.
 * Ids already in the committed operation are left out of the new one.
 *
 * Committed: `refresh()` and `LIFECYCLE_CHANGED_EVENT` (badges, queue and the store's own refetch). Failed: the rows come back
 * on a definite rejection and an error toast offers Try again. An uncertain response reconciles the list before unhiding;
 * a failed reconciliation keeps the rows hidden and offers a read-only refresh. Unmounted while pending (leaving the Journal):
 * nothing is sent and a notice says so, except after a sign-out or owner switch. Requests in flight are aborted on unmount.
 */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api, ApiError } from '@kuuki/client/apiClient'
import type { DerivedAck } from '@kuuki/client/derivedState'
import { formatCount, type CountForms, type Locale } from '../../lib/format'
import { trackPrivateOperation } from '../activity'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { Button } from '../ui/button'
import { ToastSlot, useToast } from '../ui/toast'
import './journal-delete.css'

export const DELETE_UNDO_MS = 6000
const TICK_MS = 100

const being: CountForms = {
  en: { one: '{count} flight is being deleted.', other: '{count} flights are being deleted.' },
  ru: {
    one: '{count} перелёт будет удалён.',
    few: '{count} перелёта будут удалены.',
    many: '{count} перелётов будут удалены.',
    other: '{count} перелёта будут удалены.',
  },
}
const failed: CountForms = {
  en: {
    one: 'Could not delete {count} flight. Try again.',
    other: 'Could not delete {count} flights. Try again.',
  },
  ru: {
    one: 'Не удалось удалить {count} перелёт. Повторите позже.',
    few: 'Не удалось удалить {count} перелёта. Повторите позже.',
    many: 'Не удалось удалить {count} перелётов. Повторите позже.',
    other: 'Не удалось удалить {count} перелёта. Повторите позже.',
  },
}
const copy = {
  en: {
    undo: 'Undo',
    retry: 'Try again',
    refresh: 'Refresh list',
    unknown:
      'Could not check whether the flights were deleted. Check the list before trying again.',
    refreshFailed:
      'Could not check whether the flights were deleted. Refresh the list before trying again.',
    seconds: 's',
    cancelled: 'Delete cancelled because you left the Journal. Nothing was removed.',
  },
  ru: {
    undo: 'Отменить',
    retry: 'Повторить',
    refresh: 'Обновить список',
    unknown: 'Не удалось проверить, удалены ли перелёты. Проверьте список, прежде чем повторить.',
    refreshFailed:
      'Не удалось проверить, удалены ли перелёты. Обновите список, прежде чем повторить.',
    seconds: 'с',
    cancelled: 'Удаление отменено, потому что вы ушли из журнала. Ничего не удалено.',
  },
} as const

export type ScheduleDeleteOptions = {
  /** The notice text while the delete is pending. Default: "N flights are being deleted." */
  label?: string
  /** Runs after Undo brought the rows back; it then owns focus. Default: focus the first restored row, else the page heading. */
  onUndo?: () => void
  /** Move focus to the notice's Undo. Default true. */
  focusUndo?: boolean
}
export type PendingDelete = { ids: number[]; seconds: number; label: string | null }
export type JournalDelete = {
  scheduleDelete: (ids: readonly number[], options?: ScheduleDeleteOptions) => void
  pending: PendingDelete | null
  undo: () => void
}

type Operation = {
  key: number
  ids: number[]
  remaining: number
  last: number
  controller: AbortController
  options: ScheduleDeleteOptions
}
/** What the notice shows: the newest operation, while it counts down or while its request runs. */
type Notice = {
  key: number
  ids: number[]
  seconds: number
  label: string | null
  sending: boolean
}

const Context = createContext<JournalDelete | null>(null)

const focusLost = () => document.activeElement === null || document.activeElement === document.body

/** Focus the first of `ids` still in the ledger, else the page heading. */
export function focusRowOrHeading(ids: readonly number[]) {
  for (const id of ids) {
    const row = document.querySelector<HTMLElement>(`[data-flight-row="${id}"]`)
    if (row) {
      row.focus()
      return
    }
  }
  const heading = document.querySelector<HTMLElement>('main h1')
  if (!heading) return
  if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
  heading.focus()
}

export type JournalDeleteProviderProps = {
  locale: Locale
  hide: (ids: number[]) => void
  unhide: (ids: number[]) => void
  refresh: (options?: { throwOnError?: boolean }) => Promise<unknown>
  children: ReactNode
}

export function JournalDeleteProvider({
  locale,
  hide,
  unhide,
  refresh,
  children,
}: JournalDeleteProviderProps) {
  const toast = useToast()
  const [notice, setNotice] = useState<Notice | null>(null)
  const pendingOp = useRef<Operation | null>(null)
  const inFlight = useRef(new Set<AbortController>())
  const keys = useRef(0)
  const latest = useRef({ locale, hide, unhide, refresh, toast })
  useEffect(() => {
    latest.current = { locale, hide, unhide, refresh, toast }
  })
  // Sign-out and owner switches reset identity before the Journal unmounts; their dropped delete is not announced.
  const identityReset = useRef(false)
  const mounted = useRef(true)

  const scheduleRef = useRef<JournalDelete['scheduleDelete']>(() => {})
  const send = useCallback((op: Operation) => {
    if (pendingOp.current === op) pendingOp.current = null
    const { controller, ids } = op
    inFlight.current.add(controller)
    setNotice((current) => (current?.key === op.key ? { ...current, sending: true } : current))
    const release = trackPrivateOperation(controller)
    const request =
      ids.length === 1
        ? api.delete<DerivedAck>(`/api/flights/${ids[0]}`, undefined, { signal: controller.signal })
        : api.post<DerivedAck>('/api/flights/bulk-delete', { ids }, { signal: controller.signal })
    void request
      .then(
        () => {
          if (controller.signal.aborted || identityReset.current) return
          setNotice((current) => (current?.key === op.key ? null : current))
          void latest.current.refresh()
          window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))
        },
        async (cause) => {
          if (controller.signal.aborted || identityReset.current) return
          setNotice((current) => (current?.key === op.key ? null : current))
          const { unhide: show, toast: toasts } = latest.current
          // A transport failure, timeout, 5xx or missing flight cannot prove this DELETE did not commit.
          const rejected =
            cause instanceof ApiError &&
            cause.status >= 400 &&
            cause.status < 500 &&
            cause.status !== 408 &&
            cause.status !== 404
          if (rejected) {
            show(ids)
            toasts.show({
              kind: 'error',
              message: {
                en: formatCount('en', ids.length, failed),
                ru: formatCount('ru', ids.length, failed),
              },
              actionLabel: { en: copy.en.retry, ru: copy.ru.retry },
              onAction: () => scheduleRef.current(ids, op.options),
            })
            return
          }
          const reconcile = async () => {
            if (!mounted.current || controller.signal.aborted || identityReset.current) return
            try {
              await latest.current.refresh({ throwOnError: true })
              if (!mounted.current || controller.signal.aborted || identityReset.current) return
              latest.current.unhide(ids)
              window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))
              toasts.show({
                kind: 'error',
                message: { en: copy.en.unknown, ru: copy.ru.unknown },
              })
            } catch {
              if (!mounted.current || controller.signal.aborted || identityReset.current) return
              toasts.show({
                kind: 'error',
                message: { en: copy.en.refreshFailed, ru: copy.ru.refreshFailed },
                duration: 0,
                actionLabel: { en: copy.en.refresh, ru: copy.ru.refresh },
                onAction: () => {
                  void reconcile()
                },
              })
            }
          }
          await reconcile()
        },
      )
      .finally(() => {
        release()
        inFlight.current.delete(controller)
      })
  }, [])

  const focusOnShow = useRef(true)
  /** Runs once the notice has left after an Undo (the restored rows are rendered by then). */
  const afterClear = useRef<(() => void) | null>(null)

  const scheduleDelete = useCallback(
    (ids: readonly number[], options: ScheduleDeleteOptions = {}) => {
      const previous = pendingOp.current
      const list = [...new Set(ids)].filter((id) => !previous?.ids.includes(id))
      if (!list.length) return
      // One undoable operation at a time: the pending one is committed now, then the new one starts its own countdown.
      if (previous) send(previous)
      latest.current.hide(list)
      const op: Operation = {
        key: ++keys.current,
        ids: list,
        remaining: DELETE_UNDO_MS,
        last: Date.now(),
        controller: new AbortController(),
        options,
      }
      pendingOp.current = op
      afterClear.current = null
      focusOnShow.current = options.focusUndo !== false
      setNotice({
        key: op.key,
        ids: list,
        seconds: Math.ceil(DELETE_UNDO_MS / 1000),
        label: options.label ?? null,
        sending: false,
      })
    },
    [send],
  )
  useEffect(() => {
    scheduleRef.current = scheduleDelete
  }, [scheduleDelete])

  const undo = useCallback(() => {
    const op = pendingOp.current
    if (!op) return
    op.controller.abort()
    pendingOp.current = null
    latest.current.unhide(op.ids)
    setNotice(null)
    // Called in the same event as the unhide, so a caller that navigates (review mode) renders once, already restored.
    if (op.options.onUndo) op.options.onUndo()
    else afterClear.current = () => focusRowOrHeading(op.ids)
  }, [])

  // The countdown runs only while an operation is pending.
  const counting = notice !== null && !notice.sending
  useEffect(() => {
    if (!counting) return
    const tick = () => {
      const op = pendingOp.current
      if (!op) return
      const now = Date.now()
      if (!document.hidden) op.remaining -= now - op.last
      op.last = now
      if (op.remaining > 0) {
        const seconds = Math.ceil(op.remaining / 1000)
        setNotice((current) =>
          current && current.key === op.key && current.seconds !== seconds
            ? { ...current, seconds }
            : current,
        )
        return
      }
      send(op)
    }
    const visibility = () => {
      if (pendingOp.current) pendingOp.current.last = Date.now()
    }
    const timer = window.setInterval(tick, TICK_MS)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [counting, send])

  // Focus moves when the member acts, never on the network answer: to Undo when it appears, back to the restored row after
  // Undo, and to the heading when Undo leaves (the request started) with focus resting on it.
  const undoButton = useRef<HTMLButtonElement>(null)
  const shownKey = counting ? notice.key : null
  const previousKey = useRef<number | null>(null)
  useEffect(() => {
    const was = previousKey.current
    previousKey.current = shownKey
    if (shownKey !== null) {
      if (focusOnShow.current) undoButton.current?.focus()
      return
    }
    if (was === null) return
    const after = afterClear.current
    afterClear.current = null
    if (after) after()
    else if (focusLost()) focusRowOrHeading([])
  }, [shownKey])

  useEffect(() => {
    mounted.current = true
    const reset = () => {
      identityReset.current = true
    }
    window.addEventListener('kuuki:identity-reset', reset)
    const running = inFlight.current
    return () => {
      mounted.current = false
      window.removeEventListener('kuuki:identity-reset', reset)
      const dropped = pendingOp.current
      pendingOp.current = null
      dropped?.controller.abort()
      running.forEach((controller) => controller.abort())
      if (dropped && !identityReset.current)
        latest.current.toast.show({
          message: { en: copy.en.cancelled, ru: copy.ru.cancelled },
        })
    }
  }, [])

  // `notice` keeps its identity until a field changes, so `pending` does too.
  const pending = useMemo<PendingDelete | null>(
    () =>
      notice && !notice.sending
        ? { ids: notice.ids, seconds: notice.seconds, label: notice.label }
        : null,
    [notice],
  )
  const value = useMemo<JournalDelete>(
    () => ({ scheduleDelete, pending, undo }),
    [scheduleDelete, pending, undo],
  )
  return (
    <Context.Provider value={value}>
      {children}
      <ToastSlot>
        <DeleteNotice ref={undoButton} locale={locale} notice={notice} onUndo={undo} />
      </ToastSlot>
    </Context.Provider>
  )
}

export function useJournalDelete(): JournalDelete {
  const value = useContext(Context)
  if (!value) throw new Error('useJournalDelete needs a JournalDeleteProvider')
  return value
}

/** The pending-delete line and its Undo. A caller inside a modal sheet renders the same line there (focus cannot leave the sheet). */
export const DeleteUndoLine = forwardRef<
  HTMLButtonElement,
  { locale: Locale; pending: PendingDelete; onUndo: () => void; className?: string }
>(function DeleteUndoLine({ locale, pending, onUndo, className }, ref) {
  return (
    <div className={className ?? 'journal-delete-line'}>
      <p className="journal-delete-message">
        {pending.label ?? formatCount(locale, pending.ids.length, being)}
      </p>
      <span className="journal-delete-seconds mono" aria-hidden="true">
        {pending.seconds} {copy[locale].seconds}
      </span>
      <Button ref={ref} variant="primary" dense onClick={onUndo}>
        {copy[locale].undo}
      </Button>
    </div>
  )
})

/**
 * Always mounted, so its polite live region is registered before the first message. The text is announced once: the seconds
 * are decoration and the sentence does not change while the countdown runs. While the request runs the text stays without Undo.
 */
const DeleteNotice = forwardRef<
  HTMLButtonElement,
  { locale: Locale; notice: Notice | null; onUndo: () => void }
>(function DeleteNotice({ locale, notice, onUndo }, ref) {
  const t = copy[locale]
  return (
    <div className="journal-delete-notice" data-active={notice ? 'true' : undefined}>
      <p role="status" aria-live="polite" className="journal-delete-message">
        {notice ? (notice.label ?? formatCount(locale, notice.ids.length, being)) : ''}
      </p>
      {notice && !notice.sending && (
        <>
          <span className="journal-delete-seconds mono" aria-hidden="true">
            {notice.seconds} {t.seconds}
          </span>
          <Button ref={ref} variant="primary" dense onClick={onUndo}>
            {t.undo}
          </Button>
        </>
      )}
    </div>
  )
})
