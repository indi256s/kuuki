'use client'

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './ui.css'

export type ToastKind = 'info' | 'success' | 'error'
export type ToastInput = {
  /** State the outcome («Ссылка скопирована»), not the action. */
  message: string
  kind?: ToastKind
  /** ms; default 5000 (8000 for errors). 0 keeps it until dismissed. */
  duration?: number
  actionLabel?: string
  onAction?: () => void
}
type Item = ToastInput & { id: number; kind: ToastKind; leaving: boolean }
type ToastApi = { show: (toast: ToastInput) => number; dismiss: (id: number) => void }

const ToastContext = createContext<ToastApi | null>(null)
const EXIT_MS = 200

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}

type KindLabels = Record<ToastKind, string>
const DEFAULT_KIND_LABELS: KindLabels = { info: 'Notice', success: 'Success', error: 'Error' }
const ICONS = { info: Info, success: CircleCheck, error: CircleAlert } as const

export function ToastProvider({ children, dismissLabel = 'Dismiss', kindLabels = DEFAULT_KIND_LABELS }: { children: ReactNode; dismissLabel?: string; kindLabels?: KindLabels }) {
  const [items, setItems] = useState<Item[]>([])
  const nextId = useRef(1)
  const exits = useRef(new Set<number>())
  useEffect(() => { const pending = exits.current; return () => { pending.forEach(id => window.clearTimeout(id)); pending.clear() } }, [])

  const remove = useCallback((id: number) => setItems(list => list.filter(item => item.id !== id)), [])
  const dismiss = useCallback((id: number) => {
    setItems(list => list.map(item => item.id === id ? { ...item, leaving: true } : item))
    const timeout = window.setTimeout(() => { exits.current.delete(timeout); remove(id) }, EXIT_MS)
    exits.current.add(timeout)
  }, [remove])
  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current++
    setItems(list => [...list, { ...toast, id, kind: toast.kind ?? 'info', leaving: false }])
    return id
  }, [])
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss])

  const polite = items.filter(item => item.kind !== 'error')
  const assertive = items.filter(item => item.kind === 'error')
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toast-region">
        {/* Both live regions stay mounted so screen readers register them before the first message. */}
        <div className="ui-toast-live" role="status" aria-live="polite">{polite.map(item => <ToastView key={item.id} item={item} dismissLabel={dismissLabel} kindLabels={kindLabels} onDismiss={dismiss} />)}</div>
        <div className="ui-toast-live" role="alert" aria-live="assertive">{assertive.map(item => <ToastView key={item.id} item={item} dismissLabel={dismissLabel} kindLabels={kindLabels} onDismiss={dismiss} />)}</div>
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ item, dismissLabel, kindLabels, onDismiss }: { item: Item; dismissLabel: string; kindLabels: KindLabels; onDismiss: (id: number) => void }) {
  const total = item.duration ?? (item.kind === 'error' ? 8000 : 5000)
  const remaining = useRef(total)
  const startedAt = useRef(0)
  const timer = useRef<number | null>(null)
  const holds = useRef({ pointer: false, focus: false, hidden: false })

  const stop = useCallback(() => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; remaining.current -= Date.now() - startedAt.current }
  }, [])
  const start = useCallback(() => {
    if (total === 0 || timer.current !== null || item.leaving) return
    startedAt.current = Date.now()
    timer.current = window.setTimeout(() => { timer.current = null; onDismiss(item.id) }, Math.max(0, remaining.current))
  }, [total, item.id, item.leaving, onDismiss])
  const sync = useCallback(() => { const h = holds.current; if (h.pointer || h.focus || h.hidden) stop(); else start() }, [start, stop])

  useEffect(() => {
    holds.current.hidden = document.hidden
    const visibility = () => { holds.current.hidden = document.hidden; sync() }
    document.addEventListener('visibilitychange', visibility)
    sync()
    return () => { document.removeEventListener('visibilitychange', visibility); stop() }
  }, [sync, stop])

  return (
    <div
      className="ui-toast"
      data-kind={item.kind}
      data-state={item.leaving ? 'closed' : 'open'}
      onPointerEnter={() => { holds.current.pointer = true; sync() }}
      onPointerLeave={() => { holds.current.pointer = false; sync() }}
      onFocus={() => { holds.current.focus = true; sync() }}
      onBlur={() => { holds.current.focus = false; sync() }}
    >
      <span className="ui-toast-icon" data-kind={item.kind}>{(() => { const Icon = ICONS[item.kind]; return <Icon size={18} strokeWidth={2} aria-hidden="true" /> })()}<span className="sr-only">{kindLabels[item.kind]}: </span></span>
      <p className="ui-toast-message">{item.message}</p>
      {item.actionLabel ? <button type="button" className="ui-button ui-toast-action" data-variant="ghost" data-dense="true" onClick={() => { item.onAction?.(); onDismiss(item.id) }}><span>{item.actionLabel}</span></button> : null}
      <button type="button" className="ui-icon-button" style={{ margin: 0 }} aria-label={dismissLabel} onClick={() => onDismiss(item.id)}><X size={18} strokeWidth={2} aria-hidden="true" /></button>
    </div>
  )
}
