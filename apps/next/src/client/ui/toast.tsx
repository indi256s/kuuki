'use client'

import { CircleAlert, Info, X } from '@keyline-icons/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import './ui.css'

export type ToastKind = 'info' | 'success' | 'error'
export type ToastInput = {
  /** State the outcome («Ссылка скопирована»), not the action. */
  message: string
  /** Detail under the outcome, one line each (the saved route and date, then the totals state). */
  description?: string
  kind?: ToastKind
  /** ms; default 5000 (8000 for errors). 0 keeps it until dismissed. */
  duration?: number
  actionLabel?: string
  onAction?: () => void
}
type Item = ToastInput & { id: number; kind: ToastKind; leaving: boolean }
type ToastApi = {
  show: (toast: ToastInput) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)
/** The provider's notice slot; `undefined` when no provider is mounted. */
const SlotContext = createContext<HTMLElement | null | undefined>(undefined)
const EXIT_MS = 200

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}

/**
 * Places a notice its caller owns (its own live region, controls and lifetime) in the toast region, so it sits with the
 * shell's toasts instead of inside the page. Without a provider it renders in place.
 */
export function ToastSlot({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext)
  if (slot === undefined) return children
  return slot ? createPortal(children, slot) : null
}

type KindLabels = Record<ToastKind, string>
const DEFAULT_KIND_LABELS: KindLabels = {
  info: 'Notice',
  success: 'Success',
  error: 'Error',
}
/** Arc toast: a swipe past this distance (px) or speed (px/ms) throws the toast off in that direction. */
const SWIPE = { distance: 80, velocity: 0.48 }

/** Arc's success check, drawn in once the toast has risen. */
function DrawnCheck() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        className="ui-toast-check"
        d="M4 12.5l5 5L20 6.5"
        pathLength={1}
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const ICONS = {
  info: <Info size={18} strokeWidth={2} aria-hidden="true" />,
  success: <DrawnCheck />,
  error: <CircleAlert size={18} strokeWidth={2} aria-hidden="true" />,
} as const

export function ToastProvider({
  children,
  dismissLabel = 'Dismiss',
  kindLabels = DEFAULT_KIND_LABELS,
}: {
  children: ReactNode
  dismissLabel?: string
  kindLabels?: KindLabels
}) {
  const [items, setItems] = useState<Item[]>([])
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const nextId = useRef(1)
  const exits = useRef(new Set<number>())
  useEffect(() => {
    const pending = exits.current
    return () => {
      pending.forEach((id) => window.clearTimeout(id))
      pending.clear()
    }
  }, [])

  const remove = useCallback(
    (id: number) => setItems((list) => list.filter((item) => item.id !== id)),
    [],
  )
  const dismiss = useCallback(
    (id: number) => {
      setItems((list) => list.map((item) => (item.id === id ? { ...item, leaving: true } : item)))
      const timeout = window.setTimeout(() => {
        exits.current.delete(timeout)
        remove(id)
      }, EXIT_MS)
      exits.current.add(timeout)
    },
    [remove],
  )
  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current++
    setItems((list) => [...list, { ...toast, id, kind: toast.kind ?? 'info', leaving: false }])
    return id
  }, [])
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss])

  const polite = items.filter((item) => item.kind !== 'error')
  const assertive = items.filter((item) => item.kind === 'error')
  return (
    <ToastContext.Provider value={api}>
      <SlotContext.Provider value={slot}>
        {children}
        <div className="ui-toast-region">
          {/* Both live regions stay mounted so screen readers register them before the first message. */}
          <div className="ui-toast-live" role="status" aria-live="polite">
            {polite.map((item) => (
              <ToastView
                key={item.id}
                item={item}
                dismissLabel={dismissLabel}
                kindLabels={kindLabels}
                onDismiss={dismiss}
              />
            ))}
          </div>
          <div className="ui-toast-live" role="alert" aria-live="assertive">
            {assertive.map((item) => (
              <ToastView
                key={item.id}
                item={item}
                dismissLabel={dismissLabel}
                kindLabels={kindLabels}
                onDismiss={dismiss}
              />
            ))}
          </div>
          <div className="ui-toast-slot" ref={setSlot} />
        </div>
      </SlotContext.Provider>
    </ToastContext.Provider>
  )
}

function ToastView({
  item,
  dismissLabel,
  kindLabels,
  onDismiss,
}: {
  item: Item
  dismissLabel: string
  kindLabels: KindLabels
  onDismiss: (id: number) => void
}) {
  const total = item.duration ?? (item.kind === 'error' ? 8000 : 5000)
  const remaining = useRef(total)
  const startedAt = useRef(0)
  const timer = useRef<number | null>(null)
  const holds = useRef({ pointer: false, focus: false, hidden: false })
  const drag = useRef<{ id: number; x: number; t: number; dx: number; v: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [thrown, setThrown] = useState(false)

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
      remaining.current -= Date.now() - startedAt.current
    }
  }, [])
  const start = useCallback(() => {
    if (total === 0 || timer.current !== null || item.leaving) return
    startedAt.current = Date.now()
    timer.current = window.setTimeout(
      () => {
        timer.current = null
        onDismiss(item.id)
      },
      Math.max(0, remaining.current),
    )
  }, [total, item.id, item.leaving, onDismiss])
  const sync = useCallback(() => {
    const h = holds.current
    if (h.pointer || h.focus || h.hidden) stop()
    else start()
  }, [start, stop])

  useEffect(() => {
    holds.current.hidden = document.hidden
    const visibility = () => {
      holds.current.hidden = document.hidden
      sync()
    }
    document.addEventListener('visibilitychange', visibility)
    sync()
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      stop()
    }
  }, [sync, stop])

  return (
    <div
      className="ui-toast"
      data-kind={item.kind}
      data-state={item.leaving ? 'closed' : 'open'}
      data-dragging={dragging || undefined}
      data-thrown={thrown || undefined}
      style={offset ? { translate: `${offset}px 0` } : undefined}
      onPointerDown={(event) => {
        if (item.leaving || (event.target as Element).closest('button')) return
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
        if (event.pointerType === 'mouse' && event.button !== 0) return
        drag.current = { id: event.pointerId, x: event.clientX, t: event.timeStamp, dx: 0, v: 0 }
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setDragging(true)
      }}
      onPointerMove={(event) => {
        const d = drag.current
        if (!d || d.id !== event.pointerId) return
        const dx = event.clientX - d.x
        const dt = event.timeStamp - d.t
        if (dt > 0) d.v = (dx - d.dx) / dt
        d.dx = dx
        d.t = event.timeStamp
        setOffset(dx)
      }}
      onPointerUp={(event) => {
        const d = drag.current
        if (!d || d.id !== event.pointerId) return
        drag.current = null
        setDragging(false)
        if (Math.abs(d.dx) < SWIPE.distance && Math.abs(d.v) < SWIPE.velocity) {
          setOffset(0) // springs home through the CSS transition
          return
        }
        const direction = Math.sign(d.dx || d.v)
        setThrown(true)
        setOffset(direction * (event.currentTarget.offsetWidth + 48))
        onDismiss(item.id)
      }}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
        setOffset(0)
      }}
      onPointerEnter={() => {
        holds.current.pointer = true
        sync()
      }}
      onPointerLeave={() => {
        holds.current.pointer = false
        sync()
      }}
      onFocus={() => {
        holds.current.focus = true
        sync()
      }}
      onBlur={() => {
        holds.current.focus = false
        sync()
      }}
    >
      <span className="ui-toast-icon" data-kind={item.kind}>
        {ICONS[item.kind]}
        <span className="sr-only">{kindLabels[item.kind]}: </span>
      </span>
      {(() => {
        const action = item.actionLabel ? (
          <button
            type="button"
            className="ui-button ui-toast-action"
            data-variant="ghost"
            data-dense="true"
            onClick={() => {
              item.onAction?.()
              onDismiss(item.id)
            }}
          >
            <span>{item.actionLabel}</span>
          </button>
        ) : null
        return item.description ? (
          <div className="ui-toast-copy">
            <p className="ui-toast-message">{item.message}</p>
            {item.description.split('\n').map((line) => (
              <p className="ui-toast-description" key={line}>
                {line}
              </p>
            ))}
            {action}
          </div>
        ) : (
          <>
            <p className="ui-toast-message">{item.message}</p>
            {action}
          </>
        )
      })()}
      <button
        type="button"
        className="ui-icon-button"
        style={{ margin: 0 }}
        aria-label={dismissLabel}
        onClick={() => onDismiss(item.id)}
      >
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
