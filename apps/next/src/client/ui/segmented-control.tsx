'use client'

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import './ui.css'

export type SegmentOption<T extends string> = { value: T; label: ReactNode; icon?: ReactNode }

type Box = { x: number; y: number; w: number; h: number }
const sameBox = (a: Box | null, b: Box) =>
  !!a && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

export type SegmentedControlProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentOption<T>[]
  /** Accessible name of the group. */
  label: string
}

// Radio-group semantics: one tab stop (the selected option), arrows move and select, Home/End jump.
// Options share equal cells (auto-fit grid) so the thumb has one size and only translates; at 320px the
// grid wraps into rows instead of clipping. The thumb transition is a plain CSS transition, so re-selecting mid-slide retargets it.
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: SegmentedControlProps<T>) {
  const root = useRef<HTMLDivElement>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  // Every option's box, read whenever the control changes size. With equal cells the boxes depend only on that size
  // and the option count, so a new selection reuses them instead of forcing a layout while its commit is applied.
  const boxes = useRef<(Box | null)[]>([])
  const current = useRef(0)
  const [thumb, setThumb] = useState<Box | null>(null)
  const [ready, setReady] = useState(false)
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )

  useLayoutEffect(() => {
    current.current = selected
    const box = boxes.current[selected]
    if (box) setThumb((prev) => (sameBox(prev, box) ? prev : box))
  }, [selected])

  useLayoutEffect(() => {
    const node = root.current
    if (!node) return
    const measure = () => {
      boxes.current = refs.current.slice(0, options.length).map((option) =>
        option
          ? {
              x: option.offsetLeft,
              y: option.offsetTop,
              w: option.offsetWidth,
              h: option.offsetHeight,
            }
          : null,
      )
      const box = boxes.current[current.current]
      if (box) setThumb((prev) => (sameBox(prev, box) ? prev : box))
    }
    if (typeof ResizeObserver === 'undefined') {
      measure()
      return
    }
    // The first report arrives after layout and before paint: the thumb lands in the opening frame, and reading the
    // boxes there costs nothing because layout is already clean.
    const observer = new ResizeObserver(() => flushSync(measure))
    observer.observe(node)
    return () => observer.disconnect()
  }, [options.length])

  // Enable the slide only after the first measurement so mounting never animates.
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const select = (index: number) => {
    const next = (index + options.length) % options.length
    refs.current[next]?.focus()
    if (options[next].value !== value) onChange(options[next].value)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowRight: selected + 1,
      ArrowDown: selected + 1,
      ArrowLeft: selected - 1,
      ArrowUp: selected - 1,
      Home: 0,
      End: options.length - 1,
    }
    if (!(event.key in keys)) return
    event.preventDefault()
    select(keys[event.key])
  }

  return (
    <div
      ref={root}
      className="ui-segmented"
      role="radiogroup"
      aria-label={label}
      data-ready={ready ? 'true' : undefined}
      style={{ '--n': options.length } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {thumb ? (
        <span
          className="ui-segmented-thumb"
          aria-hidden="true"
          style={{
            width: thumb.w,
            height: thumb.h,
            transform: `translate(${thumb.x}px, ${thumb.y}px)`,
          }}
        />
      ) : null}
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={index === selected ? 0 : -1}
          className="ui-segment"
          onClick={() => select(index)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}
