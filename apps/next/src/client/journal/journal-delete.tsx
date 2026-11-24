'use client'
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
import { readDeleteReceipts, writeDeleteReceipts, type DeleteReceipt } from './delete-receipts'
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
  label?: string
  onUndo?: () => void
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
type Notice = {
  key: number
  ids: number[]
  seconds: number
  label: string | null
  sending: boolean
}

const Context = createContext<JournalDelete | null>(null)

const focusLost = () => document.activeElement === null || document.activeElement === document.body

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
  ownerId: string
  locale: Locale
  hide: (ids: number[]) => void
  unhide: (ids: number[]) => void
  refresh: (options?: { throwOnError?: boolean }) => Promise<unknown>
  children: ReactNode
}

export function JournalDeleteProvider({
  ownerId,
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
  const receipts = useRef(new Map<number, DeleteReceipt>())
  const documentLeaving = useRef(false)
  const storageAvailable = useRef(true)
  const persist = useCallback(() => {
    storageAvailable.current = writeDeleteReceipts(ownerId, [...receipts.current.values()])
  }, [ownerId])
  const settle = useCallback(
    (key: number) => {
      receipts.current.delete(key)
      persist()
    },
    [persist],
  )
  const latest = useRef({ locale, hide, unhide, refresh, toast })
  useEffect(() => {
    latest.current = { locale, hide, unhide, refresh, toast }
  })
  const identityReset = useRef(false)
  const mounted = useRef(true)

  const reconcileOperation = useCallback(
    async (op: Operation) => {
      const { controller, ids } = op
      const toasts = latest.current.toast
      const reconcile = async () => {
        if (!mounted.current || controller.signal.aborted || identityReset.current) return
        try {
          await latest.current.refresh({ throwOnError: true })
          if (!mounted.current || controller.signal.aborted || identityReset.current) return
          settle(op.key)
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
    [settle],
  )

  const scheduleRef = useRef<JournalDelete['scheduleDelete']>(() => {})
  const send = useCallback(
    (op: Operation) => {
      if (pendingOp.current === op) pendingOp.current = null
      const { controller, ids } = op
      receipts.current.set(op.key, { key: op.key, ids, remaining: null })
      persist()
      inFlight.current.add(controller)
      setNotice((current) => (current?.key === op.key ? { ...current, sending: true } : current))
      const release = trackPrivateOperation(controller)
      const request =
        ids.length === 1
          ? api.delete<DerivedAck>(`/api/flights/${ids[0]}`, undefined, {
              signal: controller.signal,
            })
          : api.post<DerivedAck>('/api/flights/bulk-delete', { ids }, { signal: controller.signal })
      void request
        .then(
          () => {
            if (controller.signal.aborted || identityReset.current) return
            settle(op.key)
            setNotice((current) => (current?.key === op.key ? null : current))
            void latest.current.refresh()
            window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))
          },
          async (cause) => {
            if (controller.signal.aborted || identityReset.current) return
            setNotice((current) => (current?.key === op.key ? null : current))
            const { unhide: show, toast: toasts } = latest.current
            const rejected =
              cause instanceof ApiError &&
              cause.status >= 400 &&
              cause.status < 500 &&
              cause.status !== 408 &&
              cause.status !== 404
            if (rejected) {
              settle(op.key)
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
            await reconcileOperation(op)
          },
        )
        .finally(() => {
          release()
          inFlight.current.delete(controller)
        })
    },
    [persist, settle, reconcileOperation],
  )

  const focusOnShow = useRef(true)
  const afterClear = useRef<(() => void) | null>(null)

  const scheduleDelete = useCallback(
    (ids: readonly number[], options: ScheduleDeleteOptions = {}) => {
      const previous = pendingOp.current
      const list = [...new Set(ids)].filter((id) => !previous?.ids.includes(id))
      if (!list.length) return
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
      receipts.current.set(op.key, { key: op.key, ids: list, remaining: op.remaining })
      persist()
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
    [send, persist],
  )
  useEffect(() => {
    scheduleRef.current = scheduleDelete
  }, [scheduleDelete])

  const undo = useCallback(() => {
    const op = pendingOp.current
    if (!op) return
    op.controller.abort()
    pendingOp.current = null
    settle(op.key)
    latest.current.unhide(op.ids)
    setNotice(null)
    if (op.options.onUndo) op.options.onUndo()
    else afterClear.current = () => focusRowOrHeading(op.ids)
  }, [settle])

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
    let disposed = false
    documentLeaving.current = false
    const reset = () => {
      identityReset.current = true
      pendingOp.current?.controller.abort()
      pendingOp.current = null
      setNotice(null)
      receipts.current.clear()
      persist()
    }
    const leaving = () => {
      documentLeaving.current = true
      const op = pendingOp.current
      if (op) {
        const remaining = Math.max(0, op.remaining - (document.hidden ? 0 : Date.now() - op.last))
        receipts.current.set(op.key, { key: op.key, ids: op.ids, remaining })
        persist()
      }
    }
    const returned = () => {
      documentLeaving.current = false
    }
    const warn = (event: BeforeUnloadEvent) => {
      if (identityReset.current || storageAvailable.current || !receipts.current.size) return
      event.preventDefault()
      event.returnValue = ''
    }
    let stored: DeleteReceipt[] = []
    try {
      stored = readDeleteReceipts(ownerId)
    } catch {
      storageAvailable.current = false
      stored = []
    }
    void Promise.resolve().then(() => {
      if (disposed || identityReset.current || pendingOp.current || receipts.current.size) return
      keys.current = Math.max(keys.current, ...stored.map((receipt) => receipt.key))
      for (const receipt of stored) {
        if (receipt.remaining !== null) {
          scheduleRef.current(receipt.ids, { focusUndo: false })
          const op = pendingOp.current as Operation | null
          if (op) op.remaining = receipt.remaining
        } else {
          receipts.current.set(receipt.key, receipt)
          latest.current.hide(receipt.ids)
          void reconcileOperation({
            ...receipt,
            remaining: 0,
            last: Date.now(),
            controller: new AbortController(),
            options: {},
          })
        }
      }
      persist()
    })
    window.addEventListener('pagehide', leaving)
    window.addEventListener('pageshow', returned)
    window.addEventListener('beforeunload', warn)
    window.addEventListener('kuuki:identity-reset', reset)
    const running = inFlight.current
    return () => {
      disposed = true
      mounted.current = false
      window.removeEventListener('pagehide', leaving)
      window.removeEventListener('pageshow', returned)
      window.removeEventListener('beforeunload', warn)
      window.removeEventListener('kuuki:identity-reset', reset)
      const dropped = pendingOp.current
      pendingOp.current = null
      dropped?.controller.abort()
      if (dropped && !documentLeaving.current) settle(dropped.key)
      running.forEach((controller) => controller.abort())
      if (dropped && !identityReset.current && !documentLeaving.current)
        latest.current.toast.show({
          message: { en: copy.en.cancelled, ru: copy.ru.cancelled },
        })
    }
  }, [persist, settle, reconcileOperation, ownerId])

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
