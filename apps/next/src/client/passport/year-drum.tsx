'use client'

import { animate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import type { Locale } from '../../lib/format'
import { criticalSpring } from '../ui/critical-spring'
import { recentSamples, rubberBand, velocityOf, type Sample } from '../ui/sheet-physics'
import './year-drum.css'

export type YearValue = number | null

export const OLDEST_YEAR = 1930
export type DrumSize = 'compact' | 'wheel'
const SIZES: Record<DrumSize, { rows: number; row: number }> = {
  compact: { rows: 3, row: 32 },
  wheel: { rows: 5, row: 36 },
}
const STRETCH_ROWS = 3
const DECELERATION = 0.998
const TAP_SLOP_PX = 4
const WHEEL_STEP_PX = 40
const PAGE_ROWS = 10

export function yearValues(current = new Date().getFullYear()): YearValue[] {
  return [null, ...Array.from({ length: current - OLDEST_YEAR + 1 }, (_, i) => current - i)]
}

export function dragPosition(raw: number, last: number): number {
  if (raw < 0) return -rubberBand(-raw, STRETCH_ROWS)
  if (raw > last) return last + rubberBand(raw - last, STRETCH_ROWS)
  return raw
}

export function project(position: number, velocity: number): number {
  return position + ((velocity / 1000) * DECELERATION) / (1 - DECELERATION)
}

export function snapIndex(position: number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.round(position)))
}

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

export const YEAR_NAME: Record<Locale, string> = { en: 'Year of visit', ru: 'Год визита' }
const NO_YEAR: Record<Locale, string> = { en: 'no year', ru: 'без года' }
export const yearLabel = (year: YearValue, locale: Locale) =>
  year === null ? NO_YEAR[locale] : String(year)

export type YearDrumResult = {
  year: YearValue
  changed: boolean
  refocus: boolean
}

type Drag = {
  id: number
  startY: number
  startPosition: number
  grabbed: boolean
  moved: boolean
  samples: Sample[]
}

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
  size = 'compact',
}: {
  value: YearValue
  locale: Locale
  onClose: (result: YearDrumResult) => void
  instant?: boolean
  trigger?: () => HTMLElement | null
  size?: DrumSize
}) {
  const { rows, row: rowPx } = SIZES[size]
  const center = (rows - 1) / 2
  const reduced = useReducedMotion() ?? false
  const values = useMemo(() => yearValues(), [])
  const last = values.length - 1
  const snap = useCallback((at: number) => snapIndex(at, values.length), [values])
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
      if (listRef.current)
        listRef.current.style.transform = `translateY(${(center - next) * rowPx}px)`
      setIndex(snap(next))
    },
    [snap, center, rowPx],
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
      const year = restore || !touched.current ? value : values[snap(position.current)]
      onCloseRef.current({ year, changed: year !== value, refocus })
    },
    [snap, value, values],
  )

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
      const controls = animate(from, target, {
        ...criticalSpring(Math.min(0.5, 0.25 + Math.abs(target - from) * 0.02), velocity),
        onUpdate: show,
        onComplete: () => {
          show(target)
          if (spring.current === controls) spring.current = null
        },
      })
      spring.current = controls
    },
    [reduced, show],
  )

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

  useEffect(() => {
    const node = windowRef.current
    if (!node) return
    let sum = 0,
      idle = 0
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      sum += event.deltaMode === 1 ? event.deltaY * rowPx : event.deltaY
      window.clearTimeout(idle)
      idle = window.setTimeout(() => (sum = 0), 150)
      if (Math.abs(sum) < WHEEL_STEP_PX) return
      const step = Math.sign(sum)
      sum = 0
      settle(snap(Math.round(position.current) + step))
    }
    const keep = (event: TouchEvent) => event.stopPropagation()
    node.addEventListener('wheel', wheel, { passive: false })
    node.addEventListener('touchstart', keep, { passive: true })
    return () => {
      window.clearTimeout(idle)
      node.removeEventListener('wheel', wheel)
      node.removeEventListener('touchstart', keep)
    }
  }, [settle, snap, rowPx])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation()
    if (event.button !== 0 || drag.current) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const grabbed = !!spring.current
    spring.current?.stop()
    spring.current = null
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      startPosition: position.current,
      grabbed,
      moved: false,
      samples: [{ t: event.timeStamp, value: position.current }],
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    const delta = event.clientY - current.startY
    if (!current.moved && Math.abs(delta) <= TAP_SLOP_PX) return
    current.moved = true
    touched.current = true
    const next = dragPosition(current.startPosition - delta / rowPx, last)
    current.samples = recentSamples(current.samples, event.timeStamp, next)
    show(next)
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    drag.current = null
    if (!current.moved) {
      if (current.grabbed) return settle(snap(position.current))
      const row = Math.floor(
        (event.clientY - event.currentTarget.getBoundingClientRect().top) / rowPx,
      )
      if (row === center) return finish(true)
      return settle(snap(Math.round(position.current) + row - center))
    }
    const velocity = velocityOf(recentSamples(current.samples, event.timeStamp, position.current))
    settle(snap(project(position.current, velocity)), velocity)
  }

  function onPointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    settle(snap(position.current))
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finish(true, event.key === 'Escape')
      return
    }
    const target = keyIndex(event.key, snap(position.current), last)
    if (target === null) return
    event.preventDefault()
    settle(target, 0, false)
  }

  const year = values[index]
  return (
    <div
      className="year-drum"
      ref={rootRef}
      data-size={size}
      style={{ '--row': `${rowPx}px`, '--rows': rows } as CSSProperties}
      data-instant={instant || undefined}
      data-reduced={reduced || undefined}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !rootRef.current?.contains(event.relatedTarget))
          finish(false)
      }}
    >
      <div
        className="year-drum-window"
        ref={windowRef}
        role="spinbutton"
        tabIndex={0}
        aria-label={YEAR_NAME[locale]}
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
          style={{ transform: `translateY(${(center - start) * rowPx}px)` }}
        >
          {values.map((item, row) => (
            <span
              key={item ?? 'none'}
              className="year-drum-row"
              data-selected={row === index || undefined}
              data-none={item === null || undefined}
            >
              {yearLabel(item, locale)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
