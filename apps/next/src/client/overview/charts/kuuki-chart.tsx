'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type SVGProps } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../ui/button'
import { DEFAULT_PALETTE, type ChartPalette } from './palettes'
import { TableView, type ChartTable } from './table-view'
import './chart-theme.css'

export type ChartPoint<T> = { key: string; datum: T; label: string }
export type TipAction = { label: string; run: () => void }
export type KuukiChartProps<T> = {
  points: readonly ChartPoint<T>[]
  height: number
  ariaLabel: string
  ariaDescription?: string
  palette?: ChartPalette
  inView: boolean
  onPick?: (point: ChartPoint<T>) => void
  tip?: (points: readonly ChartPoint<T>[]) => ReactNode
  actions?: (point: ChartPoint<T>) => readonly TipAction[]
  table: ChartTable
  viewBox?: string
  children: (mark: (point: ChartPoint<T>) => SVGProps<SVGGElement>) => ReactNode
}

type Selection = { key: string; pinned: boolean; left: number; top: number }

/** Shared interaction/table host for the locally adapted Arc SVG charts. Geometry stays with each chart. */
export function KuukiChart<T>({ points, height, ariaLabel, ariaDescription, palette = DEFAULT_PALETTE, inView, onPick, tip, actions, table, viewBox = `0 0 600 ${height}`, children }: KuukiChartProps<T>) {
  const id = useId(), host = useRef<SVGSVGElement>(null), portal = useRef<HTMLDivElement>(null)
  const marks = useRef(new Map<string, SVGGElement>())
  const pointer = useRef('mouse')
  const [active, setActive] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const point = selection && points.find(item => item.key === selection.key)
  const activeKey = points.some(item => item.key === active) ? active : points[0]?.key
  const selectedKey = selection?.key
  const portalOwner = host.current?.closest('[role="dialog"]') ?? (typeof document !== 'undefined' ? document.body : null)
  const nativePopover = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function'
  const ownerBox = typeof document !== 'undefined' && !nativePopover && portalOwner && portalOwner !== document.body ? portalOwner.getBoundingClientRect() : null
  const hasPoint = !!point
  const dismiss = useCallback(() => {
    if (portal.current?.contains(document.activeElement)) (selectedKey && marks.current.get(selectedKey) || host.current)?.focus()
    setSelection(null)
  }, [selectedKey])
  useEffect(() => { if (selection && !points.some(item => item.key === selection.key)) setSelection(null) }, [points, selection])
  useEffect(() => {
    if (!selection?.pinned) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !portal.current?.contains(event.target) && !host.current?.contains(event.target)) dismiss()
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss() } }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape, true) }
  }, [selection?.pinned, dismiss])
  useLayoutEffect(() => {
    const node = portal.current
    if (!node || !hasPoint || !nativePopover) return
    node.showPopover()
    return () => { if (node.matches(':popover-open')) node.hidePopover() }
  }, [hasPoint, portalOwner, nativePopover])
  useLayoutEffect(() => {
    if (selection?.pinned) portal.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [selection?.key, selection?.pinned])
  useLayoutEffect(() => {
    const node = portal.current
    if (!node || !selection) return
    const box = node.getBoundingClientRect()
    const left = Math.max(16, Math.min(selection.left, window.innerWidth - box.width - 16))
    const top = Math.max(16, Math.min(selection.top, window.innerHeight - box.height - 16))
    if (left !== selection.left || top !== selection.top) setSelection({ ...selection, left, top })
  }, [selection, point])
  const show = (key: string, element: SVGGElement, pinned: boolean) => {
    const box = element.getBoundingClientRect()
    setSelection({ key, pinned, left: Math.max(16, box.left), top: box.bottom + 8 })
  }
  const focus = (index: number) => {
    const target = points[Math.max(0, Math.min(points.length - 1, index))]
    if (target) { setActive(target.key); marks.current.get(target.key)?.focus() }
  }
  const mark = (item: ChartPoint<T>): SVGProps<SVGGElement> & { 'data-chart-key': string; 'data-kc-key': string; 'data-selected'?: string } => ({
    ref: node => { if (node) marks.current.set(item.key, node); else marks.current.delete(item.key) },
    role: 'button', tabIndex: -1, 'aria-label': item.label,
    'data-chart-key': item.key, 'data-kc-key': item.key,
    'data-selected': selection?.key === item.key ? 'true' : undefined,
    onFocus: event => { setActive(item.key); if (!selection?.pinned) show(item.key, event.currentTarget, false) },
    onPointerDown: event => { pointer.current = event.pointerType || 'mouse' },
    onPointerEnter: event => { if (event.pointerType !== 'touch' && !selection?.pinned) show(item.key, event.currentTarget, false) },
    onPointerLeave: () => { if (!selection?.pinned) dismiss() },
    onClick: event => {
      event.stopPropagation()
      if (pointer.current === 'touch') show(item.key, event.currentTarget, true)
      else { dismiss(); onPick?.(points.find(current => current.key === item.key) ?? item) }
    },
    onKeyDown: event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); pointer.current = 'keyboard'; dismiss(); onPick?.(points.find(current => current.key === item.key) ?? item) }
    },
  })
  return <div className="kc" style={palette} data-in-view={inView}>
    <svg ref={host} className="kc-svg" role="group" tabIndex={0} aria-label={ariaLabel} aria-describedby={ariaDescription ? `${id}-description` : undefined} viewBox={viewBox} style={{ height }} onKeyDown={event => {
      const index = Math.max(0, points.findIndex(item => item.key === activeKey))
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); pointer.current = 'keyboard'
        focus(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1))
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); pointer.current = 'keyboard'; dismiss()
        const target = points.find(item => item.key === activeKey)
        if (target) onPick?.(target)
      } else if (event.key === 'Escape') dismiss()
    }}>
      {ariaDescription ? <desc id={`${id}-description`}>{ariaDescription}</desc> : null}
      {children(mark)}
    </svg>
    {point && selection && portalOwner ? createPortal(<div ref={portal} popover={nativePopover ? 'manual' : undefined} className="kc-tooltip" style={{ ...palette, left: selection.left - (ownerBox?.left ?? 0), top: selection.top - (ownerBox?.top ?? 0) }} role={selection.pinned ? 'dialog' : 'tooltip'} aria-label={point.label}
      onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation() }}>
      {tip ? tip([point]) : <span>{point.label}</span>}
      {selection.pinned && <div className="kc-tip-actions">{actions?.(point).map(action => <Button key={action.label} onClick={() => { dismiss(); action.run() }}>{action.label}</Button>)}<Button onClick={dismiss}>{document.documentElement.lang === 'ru' ? 'Закрыть' : 'Close'}</Button></div>}
    </div>, portalOwner) : null}
    <TableView table={table} />
  </div>
}
