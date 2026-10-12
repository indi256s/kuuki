'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  WheelEvent,
  RefObject,
} from 'react'
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  usePresence,
  useReducedMotion,
  useTransform,
} from 'motion/react'
import { X } from '@keyline-icons/react'
// Adapted from Arc Bottom sheet (MIT, see ARC-LICENSE.txt).
import styles from './bottom-sheet.module.css'
import './ui.css'

/**
 * A sheet that rises from the bottom edge and rests at one or more heights (detents).
 * Use it for secondary tasks where a peek is useful before committing to the full view: trip details, share options, filters.
 * Use a dialog when the decision must interrupt, and a drawer for side panels on wide layouts.
 */
export interface BottomSheetProps {
  /** The control that opens the sheet, usually a button. Focus returns to it when the sheet closes. */
  trigger?: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  title: ReactNode
  /** A control that belongs beside the title (a menu, say), outside the heading so it stays out of the heading's accessible name. */
  titleAction?: ReactNode
  description?: ReactNode
  /** Resting heights as fractions of the viewport height. The sheet opens at `initialDetent` and never grows past the largest. */
  detents?: number[]
  /** Index into the sorted detents the sheet opens at. Defaults to the smallest. */
  initialDetent?: number
  onDetentChange?: (index: number) => void
  closeLabel?: string
  className?: string
  children?: ReactNode
  footer?: ReactNode
  initialFocusRef?: RefObject<HTMLElement | null>
  onCloseAutoFocus?: (event: Event) => void
}

type Stop = number | 'closed'
type Drag = {
  startY: number
  origin: number
  from: number
  moved: boolean
  samples: { t: number; y: number }[]
}

/** Extra surface below the viewport, so an upward stretch never shows a gap under the sheet. */
const EXTENSION = 160
/** Enough travel below the edge to hide the floating shadow as well as the sheet. */
const CLOSED_GAP = 40
/** How far a release coasts, in seconds of its velocity, before the nearest detent is chosen. */
const PROJECTION = 0.2
/** A release faster than this (px/s) always moves at least one detent in its direction. */
const FLICK = 320
/** The limit an upward stretch approaches past the tallest detent. */
const STRETCH = 120
/** How much of the full dim remains at the smallest detent. */
const LOW_DIM = 0.78

const settle = { type: 'spring' as const, visualDuration: 0.3, bounce: 0.12 }
const fade = { duration: 0.15, ease: 'linear' as const }

/** iOS-style resistance past the bounds: follows the finger at first, then approaches `limit` asymptotically. */
export function rubberBand(overshoot: number, limit = 80): number {
  return (1 - 1 / ((overshoot * 0.55) / limit + 1)) * limit
}
/** Inverse of `rubberBand(stretch, STRETCH)`. */
const unrubber = (stretch: number) =>
  ((1 / (1 - Math.min(stretch, STRETCH - 1) / STRETCH) - 1) * STRETCH) / 0.55
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function velocityOf(samples: Drag['samples'], now: number) {
  const recent = samples.filter((sample) => now - sample.t <= 80)
  const first = recent[0],
    last = recent[recent.length - 1]
  // A pause before letting go drops the momentum, so a slow, deliberate release settles where it is.
  if (!first || !last || last === first || now - last.t > 60) return 0
  return (last.y - first.y) / ((last.t - first.t) / 1000)
}

export function BottomSheet({
  trigger,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: BottomSheetProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  const open = openProp ?? uncontrolled
  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolled(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange],
  )
  const dismiss = useCallback(() => setOpen(false), [setOpen])
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      {/* The sheet stays mounted while it leaves, so a close can be caught and reversed mid-flight. */}
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal key="sheet" forceMount>
            <Sheet {...props} trigger={trigger} onDismiss={dismiss} />
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}

function Sheet({
  title,
  titleAction,
  description,
  detents = [0.45, 0.92],
  initialDetent = 0,
  onDetentChange,
  closeLabel = 'Close',
  className,
  children,
  footer,
  initialFocusRef,
  onCloseAutoFocus,
  trigger,
  onDismiss,
}: Omit<BottomSheetProps, 'open' | 'defaultOpen' | 'onOpenChange'> & { onDismiss: () => void }) {
  const [isPresent, safeToRemove] = usePresence()
  const reduced = useReducedMotion() ?? false
  const detentKey = detents.join(',')
  const stops = useMemo(() => {
    const valid = Array.from(
      new Set(
        detentKey
          .split(',')
          .map(Number)
          .filter((stop) => Number.isFinite(stop) && stop > 0 && stop <= 1),
      ),
    ).sort((a, b) => a - b)
    return valid.length ? valid : [0.45, 0.92]
  }, [detentKey])
  const top = stops.length - 1
  const [detent, setDetent] = useState(() =>
    clamp(Number.isFinite(initialDetent) ? Math.round(initialDetent) : 0, 0, top),
  )
  const [announcement, setAnnouncement] = useState('')
  const [ru] = useState(
    () => typeof document !== 'undefined' && document.documentElement.lang.startsWith('ru'),
  )
  const [opener] = useState(() =>
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )
  const sheetRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  /** Offset of the sheet below its tallest detent, in px. Starts far below the fold so the first frame never flashes. */
  const y = useMotionValue(4000)
  const height = useMotionValue(0)
  const presence = useMotionValue(1)
  const footerRef = useRef<HTMLDivElement>(null)
  const footerTransform = useTransform(
    [y, height],
    ([value = 0, full = 0]: number[]) =>
      `translateY(${-clamp(value, 0, full * (1 - stops[0]! / stops[top]!))}px)`,
  )
  useEffect(() => {
    const viewport = window.visualViewport
    const update = () => {
      const node = sheetRef.current
      if (!node || (viewport && viewport.scale !== 1)) return
      const available = viewport?.height ?? window.innerHeight
      const inset = Math.max(0, window.innerHeight - available - (viewport?.offsetTop ?? 0))
      node.style.setProperty('--sheet-viewport', `${available}px`)
      node.style.setProperty('--sheet-kb', `${inset}px`)
      node.dataset.keyboard = String(inset > 80)
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  const detentRef = useRef(detent)
  const aim = useRef<Stop>(detent)
  const drag = useRef<Drag | null>(null)
  const bodyGesture = useRef<{ x: number; y: number; mode: 'pending' | 'sheet' | 'native' } | null>(
    null,
  )
  const arrive = useRef<(() => void) | undefined>(undefined)
  const suppressClick = useRef(false)
  const mounted = useRef(false)
  const removePointerListeners = useRef<(() => void) | undefined>(undefined)
  useEffect(() => () => removePointerListeners.current?.(), [])
  /** When the sheet last started entering or leaving, so a press that began while it was leaving never dismisses it once it is reopened. */
  const presenceChange = useRef({ present: isPresent, at: 0 })
  useLayoutEffect(() => {
    presenceChange.current = { present: isPresent, at: performance.now() }
  }, [isPresent])

  const offset = useCallback(
    (stop: Stop) => {
      const full = height.get()
      return stop === 'closed'
        ? full + CLOSED_GAP
        : full * (1 - stops[clamp(stop, 0, top)]! / stops[top]!)
    },
    [height, stops, top],
  )

  // The backdrop is a function of where the sheet is, so it darkens and clears with a drag instead of on a timer.
  const backdrop = useTransform(
    [y, height, presence],
    ([offsetY = 0, full = 0, shown = 0]: number[]) => {
      if (!full) return 0
      const low = full * (1 - stops[0]! / stops[top]!),
        closed = full + CLOSED_GAP
      const dim =
        offsetY <= low
          ? 1 - (1 - LOW_DIM) * (low ? offsetY / low : 0)
          : LOW_DIM * (1 - (offsetY - low) / (closed - low))
      return clamp(dim, 0, 1) * shown
    },
  )

  // Every move retargets the one motion value from wherever it is. A new target drops the previous arrival callback.
  const go = useCallback(
    (stop: Stop, velocity?: number, onArrive?: () => void) => {
      aim.current = stop
      arrive.current = onArrive
      const target = offset(stop)
      const done = () => {
        const callback = arrive.current
        arrive.current = undefined
        callback?.()
      }
      if (reduced) {
        y.jump(target)
        done()
        return
      }
      animate(y, target, {
        ...settle,
        ...(velocity === undefined ? {} : { velocity }),
        onComplete: done,
      })
    },
    [offset, reduced, y],
  )

  const rest = useCallback(
    (stop: number, velocity?: number) => {
      if (stop !== detentRef.current) {
        detentRef.current = stop
        setDetent(stop)
        onDetentChange?.(stop)
        setAnnouncement(
          ru
            ? stop === top
              ? 'Панель развёрнута'
              : stop === 0
                ? 'Панель свёрнута'
                : `Высота панели: ${Math.round(stops[stop]! * 100)}%`
            : stop === top
              ? 'Sheet expanded'
              : stop === 0
                ? 'Sheet collapsed'
                : `Sheet at ${Math.round(stops[stop]! * 100)} percent height`,
        )
      }
      // Collapsing takes the content back to its start, so the peek always shows the top of it.
      const body = bodyRef.current
      if (stop !== top && body && body.scrollTop > 0)
        body.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
      go(stop, velocity)
    },
    [go, onDetentChange, reduced, stops, top, ru],
  )

  // Enter, leave, and a reopen caught mid-exit all retarget the same motion value from wherever it is.
  useLayoutEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    if (!mounted.current) {
      mounted.current = true
      height.set(sheet.offsetHeight - EXTENSION)
      y.jump(offset('closed'))
      if (reduced) {
        y.jump(offset(detentRef.current))
        presence.jump(0)
      }
    }
    if (isPresent) {
      if (reduced) {
        y.jump(offset(detentRef.current))
        animate(presence, 1, fade)
        return
      }
      presence.jump(1)
      go(detentRef.current)
      return
    }
    drag.current = null
    bodyGesture.current = null
    sheet.removeAttribute('data-dragging')
    removePointerListeners.current?.()
    if (reduced) {
      animate(presence, 0, { ...fade, onComplete: safeToRemove })
      return
    }
    // A flick has already started the exit with its own velocity; only the unmount waits for it.
    if (aim.current === 'closed' && y.isAnimating()) arrive.current = safeToRemove
    else go('closed', undefined, safeToRemove)
  }, [go, height, isPresent, offset, presence, reduced, safeToRemove, y])

  // A viewport change (rotation, the mobile toolbar) moves every detent. Keep the sheet on its detent, retargeting any flight.
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const next = sheet.offsetHeight - EXTENSION
      if (next === height.get()) return
      height.set(next)
      const stop = aim.current
      if (drag.current || stop === 'closed') return
      if (y.isAnimating()) go(stop)
      else y.jump(offset(stop))
    })
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [go, height, offset, y])

  const beginDrag = useCallback(
    (clientY: number, time: number) => {
      // Catch the sheet where it is, even mid-flight; an overstretched sheet converts back to finger distance so nothing jumps.
      y.stop()
      const current = y.get()
      drag.current = {
        startY: clientY,
        origin: current < 0 ? -unrubber(-current) : current,
        from: detentRef.current,
        moved: false,
        samples: [{ t: time, y: clientY }],
      }
    },
    [y],
  )

  const moveDrag = useCallback(
    (clientY: number, time: number) => {
      const state = drag.current
      if (!state) return
      const delta = clientY - state.startY
      if (!state.moved) {
        if (Math.abs(delta) < 3) return
        state.moved = true
        sheetRef.current?.setAttribute('data-dragging', '')
      }
      const raw = state.origin + delta
      // Down follows the finger 1:1 so it can dismiss; up past the tallest detent resists like a rubber band.
      y.set(raw < 0 ? -rubberBand(-raw, STRETCH) : raw)
      state.samples.push({ t: time, y: clientY })
      if (state.samples.length > 12) state.samples.shift()
    },
    [y],
  )

  const endDrag = useCallback(
    (time: number) => {
      const state = drag.current
      drag.current = null
      sheetRef.current?.removeAttribute('data-dragging')
      if (!state) return
      if (!state.moved) {
        const stop = aim.current
        if (stop !== 'closed') go(stop)
        return
      }
      suppressClick.current = true
      const current = y.get()
      // A stretched sheet springs back without the finger's speed, so it never launches past the stretch.
      const velocity = current < 0 ? 0 : velocityOf(state.samples, time)
      const projected = current + velocity * PROJECTION
      const candidates: Stop[] = [...stops.map((_, index) => index), 'closed']
      let target = candidates.reduce((best, stop) =>
        Math.abs(offset(stop) - projected) < Math.abs(offset(best) - projected) ? stop : best,
      )
      // A quick flick always travels at least one detent, and a flick down from the smallest one closes the sheet.
      if (Math.abs(velocity) > FLICK && target === state.from)
        target =
          velocity < 0
            ? Math.min(state.from + 1, top)
            : state.from === 0
              ? 'closed'
              : state.from - 1
      // The exit starts in this frame with the finger's velocity; closing the dialog only waits for it to land.
      if (target === 'closed') {
        if (!reduced) go('closed', velocity)
        onDismiss()
        return
      }
      rest(target, velocity)
    },
    [go, offset, onDismiss, reduced, rest, stops, top, y],
  )

  // Touch drags on the content move the sheet until it is fully open; once open, the content scrolls and a pull down from its top moves the sheet again.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const gesture = bodyGesture
    const cancel = () => {
      drag.current = null
      sheetRef.current?.removeAttribute('data-dragging')
      if (isPresent) go(detentRef.current)
      gesture.current = null
    }
    const start = (event: TouchEvent) => {
      if (!isPresent || event.touches.length !== 1) {
        cancel()
        return
      }
      const touch = event.touches[0]
      gesture.current =
        event.touches.length === 1 && touch
          ? { x: touch.clientX, y: touch.clientY, mode: 'pending' }
          : null
    }
    const move = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!gesture.current || !touch || event.touches.length !== 1) return
      const dx = touch.clientX - gesture.current.x,
        dy = touch.clientY - gesture.current.y
      if (gesture.current.mode === 'pending') {
        if (Math.hypot(dx, dy) < 4) return
        const expanded = detentRef.current >= top
        if (expanded) {
          const target = event.target instanceof Element ? event.target : body
          let scroller = target
          while (
            scroller !== body &&
            !(
              scroller.scrollHeight > scroller.clientHeight + 1 &&
              /auto|scroll/.test(getComputedStyle(scroller).overflowY)
            )
          )
            scroller = scroller.parentElement ?? body
          const scrollable = scroller.scrollHeight > scroller.clientHeight + 1
          gesture.current.mode =
            Math.abs(dy) >= Math.abs(dx) && (!scrollable || (scroller.scrollTop <= 0 && dy > 0))
              ? 'sheet'
              : 'native'
        } else {
          gesture.current.mode = Math.abs(dy) >= Math.abs(dx) ? 'sheet' : 'native'
        }
        if (gesture.current.mode === 'sheet') beginDrag(touch.clientY, event.timeStamp)
      }
      if (gesture.current.mode !== 'sheet') return
      if (event.cancelable) event.preventDefault()
      moveDrag(touch.clientY, event.timeStamp)
    }
    const end = (event: TouchEvent) => {
      if (event.type === 'touchcancel') cancel()
      else if (gesture.current?.mode === 'sheet') endDrag(event.timeStamp)
      gesture.current = null
    }
    body.addEventListener('touchstart', start, { passive: true })
    body.addEventListener('touchmove', move, { passive: false })
    body.addEventListener('touchend', end)
    body.addEventListener('touchcancel', end)
    return () => {
      body.removeEventListener('touchstart', start)
      body.removeEventListener('touchmove', move)
      body.removeEventListener('touchend', end)
      body.removeEventListener('touchcancel', end)
    }
  }, [beginDrag, endDrag, go, moveDrag, top, isPresent])

  function headerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null
    if (!isPresent || event.button !== 0 || !event.isPrimary) return
    if (
      target?.closest("button, a, input, select, textarea, [role='button']") &&
      !target.closest('[data-grabber]')
    )
      return
    suppressClick.current = false
    removePointerListeners.current?.()
    beginDrag(event.clientY, event.timeStamp)
    // Moves arrive once per frame, so a fast flick can leave the header before its first move lands.
    // Until the header captures the pointer, the window follows it; once captured, the header's own handlers take over.
    const header = event.currentTarget,
      id = event.pointerId
    const outside = (next: PointerEvent) =>
      next.pointerId === id && !(next.target instanceof Node && header.contains(next.target))
    const move = (next: PointerEvent) => {
      if (!outside(next) || !drag.current) return
      moveDrag(next.clientY, next.timeStamp)
      if (drag.current?.moved && !header.hasPointerCapture(id)) {
        try {
          header.setPointerCapture(id)
        } catch {
          /* The pointer is already gone. */
        }
      }
    }
    const up = (next: PointerEvent) => {
      if (next.pointerId !== id) return
      removePointerListeners.current?.()
      if (next.type === 'pointercancel') {
        drag.current = null
        sheetRef.current?.removeAttribute('data-dragging')
        if (isPresent) go(detentRef.current)
      } else if (outside(next)) endDrag(next.timeStamp)
    }
    removePointerListeners.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  // Capture only once the pointer has really moved, so a plain click still lands on the grabber button.
  function headerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || !drag.current) return
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      endDrag(event.timeStamp)
      return
    }
    moveDrag(event.clientY, event.timeStamp)
    if (drag.current.moved && !event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.setPointerCapture(event.pointerId)
  }
  function headerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) return
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (event.type === 'pointercancel') {
      drag.current = null
      sheetRef.current?.removeAttribute('data-dragging')
      if (isPresent) go(detentRef.current)
    } else endDrag(event.timeStamp)
  }

  function grabberClick(event: { detail: number }) {
    if (event.detail === 0) suppressClick.current = false
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    rest(detentRef.current >= top ? 0 : top)
  }
  function grabberKey(event: KeyboardEvent<HTMLButtonElement>) {
    const current = Math.min(detentRef.current, top)
    const next =
      event.key === 'ArrowUp'
        ? Math.min(current + 1, top)
        : event.key === 'ArrowDown'
          ? Math.max(current - 1, 0)
          : event.key === 'Home'
            ? top
            : event.key === 'End'
              ? 0
              : null
    if (next === null) return
    event.preventDefault()
    rest(next)
  }

  // Scrolling or tabbing into content that is still below the fold opens the sheet the rest of the way.
  function bodyWheel(event: WheelEvent<HTMLDivElement>) {
    if (detentRef.current !== top && event.deltaY > 4 && !drag.current) rest(top)
  }
  function bodyFocus(event: FocusEvent<HTMLDivElement>) {
    if (detentRef.current >= top || !(event.target instanceof Element)) return
    const focused = event.target.getBoundingClientRect()
    const visible = bodyRef.current?.getBoundingClientRect()
    const viewport = window.visualViewport
    const bottom =
      footerRef.current?.getBoundingClientRect().top ??
      (viewport?.height ?? window.innerHeight) + (viewport?.offsetTop ?? 0)
    if (visible && (focused.bottom > Math.min(visible.bottom, bottom) || focused.top < visible.top))
      rest(top)
  }

  // With focus on the sheet or its content, reading keys open the sheet first and then scroll the content.
  function sheetKey(event: KeyboardEvent<HTMLDivElement>) {
    const body = bodyRef.current
    if (!body || (event.target !== event.currentTarget && event.target !== body)) return
    const down =
      event.key === 'ArrowDown' ||
      event.key === 'PageDown' ||
      (event.key === ' ' && !event.shiftKey)
    const up =
      event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)
    if (!down && !up) return
    event.preventDefault()
    if (down && detentRef.current !== top) {
      rest(top)
      return
    }
    const step = event.key.startsWith('Arrow') ? 48 : body.clientHeight * 0.85
    body.scrollBy({ top: down ? step : -step, behavior: reduced ? 'auto' : 'smooth' })
  }

  const expanded = detent >= top
  const style = {
    y,
    opacity: presence,
    '--sheet-max': stops[top],
    '--sheet-peek': stops[top]! - stops[detent]!,
    '--sheet-extension': `${EXTENSION}px`,
  } as unknown as CSSProperties

  return (
    <>
      <DialogPrimitive.Overlay asChild forceMount>
        <motion.div className={`ui-overlay ${styles.overlay}`} style={{ opacity: backdrop }} />
      </DialogPrimitive.Overlay>
      <DialogPrimitive.Content
        asChild
        forceMount
        {...(description ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          ;(initialFocusRef?.current ?? sheetRef.current)?.focus({ preventScroll: true })
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          if (!event.defaultPrevented && !trigger && opener?.isConnected) {
            event.preventDefault()
            opener.focus()
          }
        }}
        // Radix waits for the click before treating a press as outside. A press on the trigger while the sheet leaves reopens it first, so that press must not close it again.
        onPointerDownOutside={(event) => {
          const { present, at } = presenceChange.current
          if (!present || event.detail.originalEvent.timeStamp < at) event.preventDefault()
        }}
      >
        <motion.div
          ref={sheetRef}
          className={[styles.sheet, 'ui-sheet ui-bottom-sheet', className]
            .filter(Boolean)
            .join(' ')}
          style={style}
          data-side="bottom"
          data-expanded={expanded ? '' : undefined}
          onKeyDown={sheetKey}
        >
          <div
            className={styles.header}
            onPointerDown={headerDown}
            onPointerMove={headerMove}
            onPointerUp={headerUp}
            onPointerCancel={headerUp}
          >
            <button
              type="button"
              className={styles.grabber}
              data-testid="sheet-handle"
              data-grabber=""
              aria-label={
                ru
                  ? expanded
                    ? 'Свернуть панель'
                    : 'Развернуть панель'
                  : expanded
                    ? 'Collapse sheet'
                    : 'Expand sheet'
              }
              aria-expanded={expanded}
              onClick={grabberClick}
              onKeyDown={grabberKey}
            >
              <span className={styles.grabberBar} aria-hidden="true" />
            </button>
            <div className="ui-panel-header">
              <div className={styles.headText}>
                <DialogPrimitive.Title className="ui-panel-title">{title}</DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="ui-panel-description">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              {titleAction}
              <DialogPrimitive.Close className="ui-icon-button" aria-label={closeLabel}>
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
          </div>
          <div
            ref={bodyRef}
            className={`ui-panel-body ${styles.body}`}
            onWheel={bodyWheel}
            onFocus={bodyFocus}
          >
            {children}
          </div>
          {footer ? (
            <motion.div
              ref={footerRef}
              className={`ui-panel-footer ${styles.footer}`}
              style={{ transform: footerTransform }}
            >
              {footer}
            </motion.div>
          ) : null}
          <span className={styles.srOnly} role="status" aria-live="polite">
            {announcement}
          </span>
        </motion.div>
      </DialogPrimitive.Content>
    </>
  )
}
