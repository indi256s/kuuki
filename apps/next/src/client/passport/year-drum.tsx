'use client'
// The year drum: the rubber date band of a date stamper. "No year" first, then the current year down to 1930. It is the
// open state only; the atlas stamp's band and the round-up rows own the closed one and the commit (spec: stamp-date).
//
// The position is a float in rows. Pointer moves write it straight to the list's transform (never through React), a
// release projects the finger's rest and settles on the nearest row with a critically damped spring handed the
// release velocity, and a grab during that spring continues from where the drum is.

import { animate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import type { Locale } from '../../lib/format'
import { criticalSpring } from '../ui/critical-spring'
import './year-drum.css'

export type YearValue = number | null

export const ROW_PX = 32
export const OLDEST_YEAR = 1930
const WINDOW_ROWS = 3
/** Apple's scroll deceleration: a release coasts `v · 0.998 / (1 − 0.998)` ms-seconds ahead. */
const DECELERATION = 0.998
const RELEASE_WINDOW_MS = 100
const TAP_SLOP_PX = 4
const WHEEL_STEP_PX = 40
const PAGE_ROWS = 10

/** `null` ("no year"), then the current year down to 1930. */
export function yearValues(current = new Date().getFullYear()): YearValue[] {
  return [null, ...Array.from({ length: current - OLDEST_YEAR + 1 }, (_, i) => current - i)]
}

/** Resistance past an end: the overshoot `offset` approaches `dimension` asymptotically. Signed like the offset. */
export function rubberband(offset: number, dimension: number): number {
  return (offset * dimension * 0.55) / (dimension + 0.55 * Math.abs(offset))
}

/** Where a drag at `raw` rows shows: free inside the list, rubber-banded past either end. */
export function dragPosition(raw: number, last: number, dimension = WINDOW_ROWS): number {
  if (raw < 0) return rubberband(raw, dimension)
  if (raw > last) return last + rubberband(raw - last, dimension)
  return raw
}

/** Where a release at `position` (rows) moving `velocity` (rows per second) would come to rest. */
export function project(position: number, velocity: number): number {
  return position + ((velocity / 1000) * DECELERATION) / (1 - DECELERATION)
}

/** The row nearest a position, clamped to the list. */
export function snapIndex(position: number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.round(position)))
}

/** Rows per second over the samples kept from the last 100 ms; 0 without two of them. */
export function velocityOf(samples: { t: number; position: number }[]): number {
  if (samples.length < 2) return 0
  const first = samples[0],
    last = samples[samples.length - 1]
  const seconds = (last.t - first.t) / 1000
  return seconds > 0 ? (last.position - first.position) / seconds : 0
}

/** The samples a release measures its speed from: those of the last 100 ms before it, then the release itself. */
export function releaseSamples(
  samples: { t: number; position: number }[],
  t: number,
  position: number,
): { t: number; position: number }[] {
  return [...samples.filter((sample) => t - sample.t <= RELEASE_WINDOW_MS), { t, position }]
}

/** The row a key moves to, or null for a key the drum ignores. ↑ moves up the list (a later year), ↓ down it. */
export function keyIndex(key: string, index: number, last: number): number | null {
  const clamp = (value: number) => Math.min(last, Math.max(0, value))
  switch (key) {
    case 'ArrowUp':
      return clamp(index - 1)
    case 'ArrowDown':
      return clamp(index + 1)
    case 'PageUp':
      return clamp(index - PAGE_ROWS)
    case 'PageDown':
      return clamp(index + PAGE_ROWS)
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return null
  }
}

const NAME: Record<Locale, string> = { en: 'Year of visit', ru: 'Год визита' }
const NO_YEAR: Record<Locale, string> = { en: 'no year', ru: 'без года' }
export const yearLabel = (year: YearValue, locale: Locale) =>
  year === null ? NO_YEAR[locale] : String(year)

export type YearDrumResult = {
  year: YearValue
  /** The year differs from the one the drum opened on. */
  changed: boolean
  /** Closed from the keyboard or by tapping the drum itself: focus returns to the control that opened it. */
  refocus: boolean
}

type Drag = {
  id: number
  startY: number
  startPosition: number
  grabbed: boolean
  moved: boolean
  samples: { t: number; position: number }[]
}

/** The index a stored year opens on: its row, or the nearest end when it lies outside 1930 to now. */
function openIndex(values: YearValue[], year: YearValue): number {
  if (year === null) return 0
  const found = values.indexOf(year)
  if (found >= 0) return found
  return year > (values[1] ?? year) ? 1 : values.length - 1
}

export function YearDrum({
  value,
  locale,
  onClose,
  instant = false,
  trigger,
}: {
  /** The year the drum opens on. */
  value: YearValue
  locale: Locale
  /** Called once, when the drum closes: Enter, a tap outside or on the middle row, or Escape (which restores). */
  onClose: (result: YearDrumResult) => void
  /** Opened from the keyboard: no entrance. */
  instant?: boolean
  /** The control that opened the drum: pressing it again closes the drum, and its click never reopens it. */
  trigger?: () => HTMLElement | null
}) {
  const reduced = useReducedMotion() ?? false
  const values = useMemo(() => yearValues(), [])
  const last = values.length - 1
  const [start] = useState(() => openIndex(values, value))
  const [index, setIndex] = useState(start)
  const rootRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const position = useRef(start)
  const touched = useRef(false)
  const closed = useRef(false)
  const spring = useRef<AnimationPlaybackControls | null>(null)
  const drag = useRef<Drag | null>(null)
  const onCloseRef = useRef(onClose)
  const triggerRef = useRef(trigger)
  useEffect(() => {
    onCloseRef.current = onClose
    triggerRef.current = trigger
  })

  const show = useCallback(
    (next: number) => {
      position.current = next
      if (listRef.current) listRef.current.style.transform = `translateY(${(1 - next) * ROW_PX}px)`
      setIndex(snapIndex(next, last + 1))
    },
    [last],
  )
  useEffect(() => {
    windowRef.current?.focus({ preventScroll: true })
    return () => spring.current?.stop()
  }, [])

  const finish = useCallback(
    (refocus: boolean, restore = false) => {
      if (closed.current) return
      closed.current = true
      spring.current?.stop()
      const year =
        restore || !touched.current ? value : values[snapIndex(position.current, last + 1)]
      onCloseRef.current({ year, changed: year !== value, refocus })
    },
    [last, value, values],
  )

  /** Moves to a row: a critically damped spring handed `velocity`, or straight there (keyboard, reduced motion). */
  const settle = useCallback(
    (target: number, velocity = 0, animated = true) => {
      touched.current = true
      spring.current?.stop()
      spring.current = null
      const from = position.current
      if (!animated || reduced || from === target) {
        show(target)
        return
      }
      // A physical spring: a time-defined one would drop the release velocity (critical-spring.ts).
      const controls = animate(from, target, {
        ...criticalSpring(Math.min(0.5, 0.25 + Math.abs(target - from) * 0.02), velocity),
        onUpdate: show,
        onComplete: () => {
          show(target)
          // Settled: the next press is a tap, not a grab of a moving drum.
          if (spring.current === controls) spring.current = null
        },
      })
      spring.current = controls
    },
    [reduced, show],
  )

  // Outside the drum: a pointer press commits, as does Tab leaving it. A press on the trigger closes too, and the click
  // it is about to fire is swallowed at the trigger, so the opener's own handler never sees it and reopens the drum.
  useEffect(() => {
    const outside = (event: globalThis.PointerEvent) => {
      if (!(event.target instanceof Node) || rootRef.current?.contains(event.target)) return
      const opener = triggerRef.current?.()
      if (opener?.contains(event.target)) {
        const swallow = (click: MouseEvent) => {
          click.preventDefault()
          click.stopPropagation()
        }
        opener.addEventListener('click', swallow, { capture: true, once: true })
        // A press that never becomes a click (dragged away) must not eat a later one.
        window.setTimeout(
          () => opener.removeEventListener('click', swallow, { capture: true }),
          600,
        )
        finish(true)
        return
      }
      finish(false)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [finish])

  // The wheel steps one row per notch (a trackpad's stream is coalesced to a step per WHEEL_STEP_PX), and a touch on
  // the drum is never an enclosing sheet's drag. Both need non-passive native listeners.
  useEffect(() => {
    const node = windowRef.current
    if (!node) return
    let sum = 0,
      idle = 0
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      sum += event.deltaMode === 1 ? event.deltaY * ROW_PX : event.deltaY
      window.clearTimeout(idle)
      idle = window.setTimeout(() => (sum = 0), 150)
      if (Math.abs(sum) < WHEEL_STEP_PX) return
      const step = Math.sign(sum)
      sum = 0
      settle(snapIndex(Math.round(position.current) + step, last + 1))
    }
    const keep = (event: TouchEvent) => event.stopPropagation()
    node.addEventListener('wheel', wheel, { passive: false })
    node.addEventListener('touchstart', keep, { passive: true })
    return () => {
      window.clearTimeout(idle)
      node.removeEventListener('wheel', wheel)
      node.removeEventListener('touchstart', keep)
    }
  }, [settle, last])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    // The sheet around the drum never sees this press.
    event.stopPropagation()
    if (event.button !== 0 || drag.current) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const grabbed = !!spring.current
    // A grab during the spring takes the drum from where it is on screen.
    spring.current?.stop()
    spring.current = null
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      startPosition: position.current,
      grabbed,
      moved: false,
      samples: [{ t: event.timeStamp, position: position.current }],
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    const delta = event.clientY - current.startY
    if (!current.moved && Math.abs(delta) <= TAP_SLOP_PX) return
    current.moved = true
    touched.current = true
    // 1:1 with where the finger took hold: the list moves with it, past an end it resists.
    const next = dragPosition(current.startPosition - delta / ROW_PX, last)
    current.samples = [
      ...current.samples.filter((sample) => event.timeStamp - sample.t <= RELEASE_WINDOW_MS),
      { t: event.timeStamp, position: next },
    ]
    show(next)
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    drag.current = null
    if (!current.moved) {
      if (current.grabbed) return settle(snapIndex(position.current, last + 1))
      // A tap: a faded row steps to itself, the selected one closes the drum.
      const row = Math.floor(
        (event.clientY - event.currentTarget.getBoundingClientRect().top) / ROW_PX,
      )
      if (row === 1) return finish(true)
      return settle(snapIndex(Math.round(position.current) + (row === 0 ? -1 : 1), last + 1))
    }
    // The release itself is the last sample, and only the last 100 ms count: a drag held still before letting go has
    // no speed left, whatever it had earlier.
    const velocity = velocityOf(releaseSamples(current.samples, event.timeStamp, position.current))
    settle(snapIndex(project(position.current, velocity), last + 1), velocity)
  }

  function onPointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    settle(snapIndex(position.current, last + 1))
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      finish(true)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finish(true, true)
      return
    }
    const target = keyIndex(event.key, snapIndex(position.current, last + 1), last)
    if (target === null) return
    event.preventDefault()
    settle(target, 0, false)
  }

  const year = values[index]
  return (
    <div
      className="year-drum"
      ref={rootRef}
      data-instant={instant || undefined}
      data-reduced={reduced || undefined}
      onBlur={(event) => {
        // Focus left for another control (Tab); a window blur has no destination and keeps the drum.
        if (event.relatedTarget instanceof Node && !rootRef.current?.contains(event.relatedTarget))
          finish(false)
      }}
    >
      <div
        className="year-drum-window"
        ref={windowRef}
        role="spinbutton"
        tabIndex={0}
        aria-label={NAME[locale]}
        aria-valuemin={OLDEST_YEAR}
        aria-valuemax={values[1] ?? undefined}
        aria-valuenow={year ?? undefined}
        aria-valuetext={yearLabel(year, locale)}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          className="year-drum-list"
          ref={listRef}
          aria-hidden="true"
          style={{ transform: `translateY(${(1 - start) * ROW_PX}px)` }}
        >
          {values.map((item, row) => (
            <span
              key={item ?? 'none'}
              className="year-drum-row"
              data-selected={row === index || undefined}
            >
              {item ?? '—'}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
