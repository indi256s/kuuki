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
type Thumb = Box & { base: number }
const sameThumb = (a: Thumb | null, b: Thumb) =>
  !!a && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.base === b.base

export type SegmentedControlProps<T extends string> = {
  value: T | null
  onChange: (value: T) => void
  options: readonly SegmentOption<T>[]
  label: string
  dense?: boolean
  toolbar?: boolean
  equal?: boolean
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  dense,
  toolbar,
  equal = false,
}: SegmentedControlProps<T>) {
  const root = useRef<HTMLDivElement>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const boxes = useRef<(Box | null)[]>([])
  const current = useRef(0)
  const [thumb, setThumb] = useState<Thumb | null>(null)
  const [ready, setReady] = useState(false)
  const [keyboard, setKeyboard] = useState(false)
  const found = options.findIndex((option) => option.value === value)
  const selected = Math.max(0, found)

  const place = () => {
    if (current.current < 0) {
      setThumb(null)
      return
    }
    const box = boxes.current[current.current]
    if (!box) return
    const next = { ...box, base: boxes.current[0]?.w ?? box.w }
    setThumb((prev) => (sameThumb(prev, next) ? prev : next))
  }

  useLayoutEffect(() => {
    if (equal) return
    current.current = found
    place()
  }, [found, equal])

  useLayoutEffect(() => {
    const node = root.current
    if (!node || equal) return
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
      place()
    }
    if (typeof ResizeObserver === 'undefined') {
      measure()
      return
    }
    const observer = new ResizeObserver(() => flushSync(measure))
    observer.observe(node)
    return () => observer.disconnect()
  }, [options.length, equal])

  useLayoutEffect(() => {
    if (equal) return
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [equal])

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
    setKeyboard(true)
    select(keys[event.key])
  }

  return (
    <div
      ref={root}
      className="ui-segmented"
      role="radiogroup"
      aria-label={label}
      data-ready={ready || equal ? 'true' : undefined}
      data-dense={dense ? 'true' : undefined}
      data-toolbar={toolbar && !dense ? 'true' : undefined}
      data-equal={equal ? 'true' : undefined}
      style={{ '--n': options.length, ...(equal ? { '--i': found } : {}) } as CSSProperties}
      data-instant={keyboard ? '' : undefined}
      onPointerDown={() => setKeyboard(false)}
      onKeyDown={onKeyDown}
    >
      {equal && found >= 0 ? (
        <span className="ui-segmented-thumb" aria-hidden="true" />
      ) : !equal && thumb ? (
        <span
          className="ui-segmented-thumb"
          aria-hidden="true"
          style={{
            width: dense ? thumb.base : thumb.w,
            height: thumb.h,
            transform: `translate(${thumb.x}px, ${thumb.y}px)${dense ? ` scaleX(${thumb.base ? thumb.w / thumb.base : 1})` : ''}`,
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
          onClick={(event) => {
            setKeyboard(event.detail === 0)
            select(index)
          }}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}
