'use client'

import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './tooltip.css'

// Adapted from Arc "tooltip" (uiarc.dev, MIT, see ARC-LICENSE.txt): the `content` / `children` / `side` API, the hover delay and the skip window that opens an adjacent tooltip without waiting.
// Dropped: Radix Tooltip and `motion` (neither is installed; this is plain React and a portal), the text crossfade and size spring, the left and right sides, and the inverted dark bubble (level-2 surface here).
// Never the only carrier of essential information: touch has no hover, and a tap does not open it.

export type TooltipProps = {
  content: ReactNode
  /** One focusable element. It receives `aria-describedby` while the tooltip is open. */
  children: ReactElement<{ 'aria-describedby'?: string }>
  side?: 'top' | 'bottom'
}

const HOVER_DELAY = 250
/** A tooltip that opens within this long after another one closed skips the delay. */
const SKIP_WINDOW = 300
/** Matches `--dur-fast`; the bubble stays mounted this long so it can fade out. */
const EXIT_MS = 150
/** Time to cross the gap from the trigger onto the bubble before a pointer leave closes it (WCAG 1.4.13: hoverable). */
const LEAVE_GRACE = 120
const GAP = 8
const MARGIN = 8

let closedAt = 0

const finePointer = () => typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
/** Keyboard focus only: a tap on a button also focuses it, and that must not leave a tooltip open. */
const keyboardFocus = (element: Element) => { try { return element.matches(':focus-visible') } catch { return true } }

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  // Mounted while open and for the fade-out after it.
  const [present, setPresent] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const showTimer = useRef(0)
  const hideTimer = useRef(0)

  const show = (delay: number) => {
    window.clearTimeout(showTimer.current)
    const run = () => { setOpen(true); setPresent(true) }
    if (delay > 0) showTimer.current = window.setTimeout(run, delay)
    else run()
  }
  const hide = () => {
    window.clearTimeout(showTimer.current)
    window.clearTimeout(hideTimer.current)
    setOpen(wasOpen => { if (wasOpen) closedAt = Date.now(); return false })
  }

  useEffect(() => () => { window.clearTimeout(showTimer.current); window.clearTimeout(hideTimer.current) }, [])
  useEffect(() => {
    if (open) return
    const timer = window.setTimeout(() => setPresent(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [open])
  useEffect(() => {
    if (!open) return
    const close = () => { closedAt = Date.now(); setOpen(false) }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  // Placed before paint: above the trigger, flipped when there is no room, and kept inside the viewport.
  useLayoutEffect(() => {
    const trigger = anchor.current?.firstElementChild
    const node = bubble.current
    if (!present || !trigger || !node) return
    node.style.left = '0px'
    const from = trigger.getBoundingClientRect()
    const size = node.getBoundingClientRect()
    const width = document.documentElement.clientWidth
    const height = window.innerHeight
    let placed = side
    if (side === 'top' && from.top - size.height - GAP < MARGIN) placed = 'bottom'
    else if (side === 'bottom' && from.bottom + size.height + GAP > height - MARGIN) placed = 'top'
    const left = Math.max(MARGIN, Math.min(from.left + from.width / 2 - size.width / 2, width - size.width - MARGIN))
    node.style.left = `${left}px`
    node.style.top = `${placed === 'top' ? from.top - size.height - GAP : from.bottom + GAP}px`
  }, [present, content, side])

  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || !finePointer()) return
    window.clearTimeout(hideTimer.current)
    if (open) return
    show(Date.now() - closedAt < SKIP_WINDOW ? 0 : HOVER_DELAY)
  }
  const onPointerLeave = () => {
    window.clearTimeout(showTimer.current)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(hide, LEAVE_GRACE)
  }
  const onFocus = (event: FocusEvent) => { if (keyboardFocus(event.target as Element)) show(0) }
  const describedBy = [children.props['aria-describedby'], open ? id : undefined].filter(Boolean).join(' ') || undefined

  return <>
    {/* The wrapper only listens: it generates no box, so the trigger keeps its place in the surrounding layout. */}
    <span ref={anchor} className="ui-tooltip-anchor" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onFocus={onFocus} onBlur={hide}>
      {cloneElement(children, { 'aria-describedby': describedBy })}
      {/* The portal sits inside the wrapper in the React tree, so React counts the bubble as part of it for pointer enter
          and leave: the pointer can cross the gap (within LEAVE_GRACE) and rest on the bubble without closing it. */}
      {present && createPortal(<div ref={bubble} id={id} role="tooltip" className="ui-tooltip" data-state={open ? 'open' : 'closed'}>{content}</div>, document.body)}
    </span>
  </>
}
