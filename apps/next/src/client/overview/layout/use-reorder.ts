'use client'

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { dropIndex } from './reorder'

type Options = { ids: SectionId[]; onCommit: (id: SectionId, index: number) => boolean | void; announce: (id: SectionId, index: number, count: number) => void }
type Indicator = { top: number; left: number; width: number }
type Gesture = { id: SectionId; pointerId: number; handle: HTMLElement; x: number; y: number; pointerX: number; pointerY: number; coarse: boolean; active: boolean; index: number }
export function useReorder(options: Options) {
  const latest = useRef(options)
  const nodes = useRef(new Map<SectionId, HTMLElement>())
  const gesture = useRef<Gesture | null>(null)
  const suppressClick = useRef<SectionId | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const raf = useRef<number | undefined>(undefined)
  const detach = useRef<(() => void) | undefined>(undefined)
  const [activeId, setActiveId] = useState<SectionId | null>(null)
  const [indicator, setIndicator] = useState<Indicator | null>(null)
  useEffect(() => { latest.current = options })
  const signature = options.ids.join(',')

  function stop(render = true) {
    const current = gesture.current
    gesture.current = null
    clearTimeout(timer.current); timer.current = undefined
    if (raf.current !== undefined) cancelAnimationFrame(raf.current)
    raf.current = undefined
    detach.current?.(); detach.current = undefined
    if (current?.handle.hasPointerCapture?.(current.pointerId)) current.handle.releasePointerCapture(current.pointerId)
    if (render) { setActiveId(null); setIndicator(null) }
  }
  useEffect(() => {
    const reset = () => stop()
    window.addEventListener('kuuki:identity-reset', reset)
    return () => { stop(false); window.removeEventListener('kuuki:identity-reset', reset) }
  }, [])
  useEffect(() => () => stop(false), [signature])
  const [previousIds, setPreviousIds] = useState(signature)
  if (previousIds !== signature) { setPreviousIds(signature); setActiveId(null); setIndicator(null) }

  function measure() {
    const current = gesture.current
    if (!current?.active) return
    const measured = latest.current.ids.flatMap(id => {
      const node = nodes.current.get(id)
      if (!node) return []
      const { top, bottom, left, right } = node.getBoundingClientRect()
      return [{ id, top, bottom, left, right }]
    })
    const rects = measured.filter(rect => rect.id !== current.id)
    current.index = dropIndex(current.pointerY, rects, current.pointerX, {
      left: Math.min(...measured.map(rect => rect.left)), right: Math.max(...measured.map(rect => rect.right)),
    })
    const target = rects[current.index] ?? rects.at(-1)
    if (!target) { setIndicator(null); return }
    const { left, right } = target
    const top = current.index < rects.length ? target.top : target.bottom, width = right - left
    setIndicator(old => old?.top === top && old.left === left && old.width === width ? old : { top, left, width })
  }
  function frame() {
    const current = gesture.current
    if (!current?.active) return
    const step = current.pointerY < 64 ? -12 : current.pointerY > window.innerHeight - 64 ? 12 : 0
    if (step) window.scrollBy({ top: step, behavior: 'instant' })
    measure()
    raf.current = requestAnimationFrame(frame)
  }
  function activate() {
    const current = gesture.current
    if (!current || current.active) return
    current.active = true
    suppressClick.current = current.id
    current.handle.setPointerCapture?.(current.pointerId)
    setActiveId(current.id)
    measure()
    raf.current = requestAnimationFrame(frame)
  }
  function start(id: SectionId, event: ReactPointerEvent<HTMLElement>) {
    if (gesture.current || event.button !== 0 || event.isPrimary === false || !latest.current.ids.includes(id)) return
    const control = (event.target as Element).closest('button, a, input, select, textarea, [role="button"], [role="menu"], [data-reorder-control]')
    if (control && control !== event.currentTarget) return
    const coarse = event.pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches
    suppressClick.current = null
    gesture.current = { id, pointerId: event.pointerId, handle: event.currentTarget, x: event.clientX, y: event.clientY,
      pointerX: event.clientX, pointerY: event.clientY, coarse, active: false, index: latest.current.ids.indexOf(id) }
    const move = (e: PointerEvent) => {
      const current = gesture.current
      if (!current || e.pointerId !== current.pointerId) return
      current.pointerY = e.clientY
      current.pointerX = e.clientX
      const distance = Math.hypot(e.clientX - current.x, e.clientY - current.y)
      if (!current.active) {
        if (current.coarse && distance >= 8) { stop(); return }
        if (!current.coarse && distance >= 4) activate()
      }
      if (current.active) { e.preventDefault(); measure() }
    }
    const end = (e: PointerEvent) => {
      const current = gesture.current
      if (!current || e.pointerId !== current.pointerId) return
      if (current.active && e.type === 'pointerup') { current.pointerX = e.clientX; current.pointerY = e.clientY; measure() }
      const commit = current.active && e.type === 'pointerup' && latest.current.ids.indexOf(id) !== current.index
      stop()
      if (commit && latest.current.onCommit(id, current.index) !== false) latest.current.announce(id, current.index, latest.current.ids.length)
    }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); stop() } }
    const scroll = () => measure()
    const lost = () => stop()
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('keydown', escape)
    window.addEventListener('scroll', scroll, true)
    event.currentTarget.addEventListener('lostpointercapture', lost)
    const handle = event.currentTarget
    detach.current = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end); window.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', scroll, true); handle.removeEventListener('lostpointercapture', lost)
    }
    if (coarse) timer.current = setTimeout(activate, 400)
  }
  return {
    indicator,
    bindings: (id: SectionId) => ({
      ref: (node: HTMLElement | null) => { if (node) nodes.current.set(id, node); else nodes.current.delete(id) },
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => start(id, event),
      onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
        if (suppressClick.current === id && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = null }
      },
      active: activeId === id,
    }),
  }
}
