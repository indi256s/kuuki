'use client'

import clsx from 'clsx'
import { useState, type CSSProperties } from 'react'
import './slot-text.css'

export type SlotTextProps = {
  value: string | number
  format?: (value: number) => string
  align?: 'start' | 'end'
  className?: string
  style?: CSSProperties
}

type Column = {
  key: string
  char: string
  prev: string | null
  n: number
  dir: 'up' | 'down'
}
type State = { text: string; value: string | number; columns: Column[] }

const split = (text: string, fromEnd: boolean) => {
  const chars = Array.from(text)
  return chars.map((char, index) => ({
    key: fromEnd ? `e${chars.length - 1 - index}` : `s${index}`,
    char,
  }))
}
const visible = (char: string) => (char === ' ' ? ' ' : char)

function advance(state: State, value: string | number, text: string, fromEnd: boolean): State {
  const dir =
    typeof value === 'number' && typeof state.value === 'number' && value < state.value
      ? 'down'
      : 'up'
  const before = new Map(state.columns.map((column) => [column.key, column]))
  const columns = split(text, fromEnd).map(({ key, char }): Column => {
    const old = before.get(key)
    if (!old) return { key, char, prev: null, n: 1, dir }
    if (old.char === char) return old
    return { key, char, prev: old.char, n: old.n + 1, dir }
  })
  return { text, value, columns }
}

export function SlotText({ value, format, align, className, style }: SlotTextProps) {
  const text = typeof value === 'number' ? (format ? format(value) : String(value)) : value
  const fromEnd = (align ?? (typeof value === 'number' ? 'end' : 'start')) === 'end'
  const [state, setState] = useState<State>(() => ({
    text,
    value,
    columns: split(text, fromEnd).map((column) => ({ ...column, prev: null, n: 0, dir: 'up' })),
  }))
  let current = state
  if (state.text !== text) {
    current = advance(state, value, text, fromEnd)
    setState(current)
  }
  const settle = (key: string, n: number) =>
    setState((latest) => ({
      ...latest,
      columns: latest.columns.map((column) =>
        column.key === key && column.n === n ? { ...column, prev: null } : column,
      ),
    }))

  return (
    <span className={clsx('ui-slot-text', className)} style={style}>
      <span className="ui-slot-text-value">{text}</span>
      <span aria-hidden="true">
        {current.columns.map((column) => (
          <span key={column.key} className="ui-slot-char">
            <span
              key={column.n}
              className="ui-slot-in"
              data-roll={column.n ? column.dir : undefined}
            >
              {visible(column.char)}
            </span>
            {column.prev !== null && (
              <span
                key={`out-${column.n}`}
                className="ui-slot-out"
                data-roll={column.dir}
                onAnimationEnd={() => settle(column.key, column.n)}
              >
                {visible(column.prev)}
              </span>
            )}
          </span>
        ))}
      </span>
    </span>
  )
}
