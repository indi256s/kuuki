'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, GripVertical, X } from '@keyline-icons/react'
import type { Locale } from '../../../lib/format'
import { announceShellNotice } from '../../shell-notices'
import { Button } from '../../ui/button'
import { Disclosure } from '../../ui/disclosure'

/** Index a dragged row would take when released at pointer height `y`: the first row whose middle is below it. */
export function dropIndexAt(
  rows: ReadonlyArray<{ top: number; bottom: number }>,
  y: number,
): number {
  for (let i = 0; i < rows.length; i += 1) if (y < (rows[i].top + rows[i].bottom) / 2) return i
  return Math.max(0, rows.length - 1)
}

export function moved<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length)
    return [...items]
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

type Dir = 'up' | 'down'

/** The list with `item` back at `index` (clamped); unchanged if a row with its id is already there. */
export function restored<T extends { id: string }>(
  items: readonly T[],
  item: T,
  index: number,
): T[] {
  if (items.some((entry) => entry.id === item.id)) return [...items]
  const next = [...items]
  next.splice(Math.min(Math.max(index, 0), next.length), 0, item)
  return next
}

/**
 * The fields of one row. A row with its required fields filled reads as a summary line and an Edit button; a row with
 * something missing, an error, or just added stays open. Once open it stays open, so typing never folds it away.
 */
export function RowFields({
  locale,
  summary,
  complete,
  hasError,
  fresh,
  children,
}: {
  locale: Locale
  summary: string
  complete: boolean
  hasError: boolean
  /** The row was added in this session; it starts open even when its place is already filled. */
  fresh: boolean
  children: ReactNode
}) {
  const [opened, setOpened] = useState(!complete || fresh)
  return (
    <div className="gt-row-fields">
      <Disclosure
        layout="row"
        open={opened || hasError || !complete}
        onOpenChange={setOpened}
        summary={locale === 'ru' ? 'Изменить' : 'Edit'}
        description={summary}
      >
        {children}
      </Disclosure>
    </div>
  )
}

/**
 * An ordered list whose rows can be moved with two buttons per row (the canonical way) or by dragging the grip
 * (pointer only, Escape cancels). Reordering and removing keep focus where the member is working and announce
 * the result; a removed row can be brought back from the notice for a few seconds. Rows stay in the page flow;
 * nothing here clips a popover.
 */
export function OrderedRows<T extends { id: string }>({
  items,
  ownerId,
  locale,
  title,
  name,
  onMove,
  onRemove,
  onRestore,
  removeDisabledReason,
  disabled,
  children,
  label,
}: {
  items: readonly T[]
  ownerId: string
  locale: Locale
  /** Visible legend of a row, e.g. "Leg 2: Tbilisi → Kars". */
  title: (item: T, index: number) => string
  /** Short spoken name of a row for the move and remove buttons. */
  name: (item: T, index: number) => string
  onMove: (from: number, to: number) => void
  onRemove: (id: string) => void
  /** Puts back what Undo restores: the whole list with the removed row at its old index. */
  onRestore: (items: T[]) => void
  /** Why Remove is unavailable (e.g. the minimum is reached); shown as the button's accessible description. */
  removeDisabledReason?: string
  disabled?: boolean
  children: (item: T, index: number) => ReactNode
  /** Accessible name of the list. */
  label: string
}) {
  const ru = locale === 'ru'
  const list = useRef<HTMLOListElement>(null)
  const pendingFocus = useRef<{ id: string; dir: Dir } | { next: string | null } | null>(null)
  const [status, setStatus] = useState('')
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null)
  const dragRef = useRef<{ id: string; from: number; over: number } | null>(null)
  // The notice outlives this render: Undo must read the list as it is then, not as it was when the row went.
  const latest = useRef({ items, onRestore, alive: true })
  useEffect(() => {
    latest.current = { items, onRestore, alive: true }
    return () => {
      latest.current.alive = false
    }
  })

  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    const root = list.current
    if (!root) return
    if ('dir' in target) {
      const row = root.querySelector<HTMLElement>(`[data-row-id="${target.id}"]`)
      const wanted = row?.querySelector<HTMLElement>(`[data-dir="${target.dir}"]`)
      const other = row?.querySelector<HTMLElement>(
        `[data-dir="${target.dir === 'up' ? 'down' : 'up'}"]`,
      )
      ;(wanted?.getAttribute('aria-disabled') === 'true' ? other : wanted)?.focus()
    } else if (target.next) {
      root.querySelector<HTMLElement>(`[data-row-id="${target.next}"] [data-legend]`)?.focus()
    }
  })

  const move = (index: number, dir: Dir) => {
    const to = dir === 'up' ? index - 1 : index + 1
    if (to < 0 || to >= items.length) return
    const item = items[index]
    pendingFocus.current = { id: item.id, dir }
    onMove(index, to)
    setStatus(
      ru
        ? `${name(item, index)}: позиция ${to + 1} из ${items.length}`
        : `${name(item, index)} moved to position ${to + 1} of ${items.length}`,
    )
  }

  const remove = (index: number) => {
    const item = items[index]
    const neighbour = items[index + 1] ?? items[index - 1] ?? null
    pendingFocus.current = { next: neighbour?.id ?? null }
    onRemove(item.id)
    announceShellNotice(ownerId, {
      message: ru ? `${name(item, index)}: удалено` : `${name(item, index)} removed`,
      duration: 6000,
      actionLabel: ru ? 'Отменить' : 'Undo',
      onAction: () => {
        const now = latest.current
        if (now.alive) now.onRestore(restored(now.items, item, index))
      },
    })
  }

  const endDrag = (commit: boolean) => {
    const current = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (commit && current && current.over !== current.from) {
      const item = items[current.from]
      pendingFocus.current = { id: item.id, dir: current.over < current.from ? 'up' : 'down' }
      onMove(current.from, current.over)
      setStatus(
        ru
          ? `${name(item, current.from)}: позиция ${current.over + 1} из ${items.length}`
          : `${name(item, current.from)} moved to position ${current.over + 1} of ${items.length}`,
      )
    }
  }
  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    // Escape cancels a drag in progress without leaving the page or closing a surface around the form.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      dragRef.current = null
      setDrag(null)
    }
    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
  }, [dragging])

  const startDrag = (event: React.PointerEvent<HTMLElement>, index: number) => {
    if (disabled || event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture?.(event.pointerId)
    dragRef.current = { id: items[index].id, from: index, over: index }
    setDrag({ id: items[index].id, over: index })
  }
  const dragMove = (event: React.PointerEvent<HTMLElement>) => {
    const current = dragRef.current
    const root = list.current
    if (!current || !root) return
    const rects = [...root.querySelectorAll<HTMLElement>(':scope > li')].map((row) =>
      row.getBoundingClientRect(),
    )
    const over = dropIndexAt(rects, event.clientY)
    if (over !== current.over) {
      current.over = over
      setDrag({ id: current.id, over })
    }
  }

  return (
    <>
      <ol className="gt-rows" aria-label={label} ref={list}>
        {items.map((item, index) => (
          <li
            key={item.id}
            className="gt-row"
            data-row-id={item.id}
            data-dragging={drag?.id === item.id ? '' : undefined}
            data-over={drag && drag.over === index && drag.id !== item.id ? '' : undefined}
          >
            <fieldset className="gt-row-fieldset">
              <legend tabIndex={-1} data-legend>
                {title(item, index)}
              </legend>
              <div className="gt-row-tools">
                <span
                  className="gt-grip"
                  aria-hidden="true"
                  onPointerDown={(event) => startDrag(event, index)}
                  onPointerMove={dragMove}
                  onPointerUp={() => endDrag(true)}
                  onPointerCancel={() => endDrag(false)}
                >
                  <GripVertical size={18} />
                </span>
                <Button
                  aria-label={ru ? `${name(item, index)}: выше` : `Move ${name(item, index)} up`}
                  disabled={index === 0 || disabled}
                  data-dir="up"
                  className="gt-icon-button"
                  icon={<ArrowUp size={18} />}
                  onClick={() => index > 0 && move(index, 'up')}
                >
                  <span className="sr-only">{ru ? 'Выше' : 'Up'}</span>
                </Button>
                <Button
                  aria-label={ru ? `${name(item, index)}: ниже` : `Move ${name(item, index)} down`}
                  disabled={index === items.length - 1 || disabled}
                  data-dir="down"
                  className="gt-icon-button"
                  icon={<ArrowDown size={18} />}
                  onClick={() => index < items.length - 1 && move(index, 'down')}
                >
                  <span className="sr-only">{ru ? 'Ниже' : 'Down'}</span>
                </Button>
                <Button
                  variant="ghost"
                  aria-label={ru ? `${name(item, index)}: удалить` : `Remove ${name(item, index)}`}
                  className="gt-icon-button"
                  icon={<X size={18} />}
                  disabled={disabled || !!removeDisabledReason}
                  aria-describedby={removeDisabledReason ? `reason-${item.id}` : undefined}
                  onClick={() => remove(index)}
                >
                  <span className="sr-only">{ru ? 'Удалить' : 'Remove'}</span>
                </Button>
              </div>
              {removeDisabledReason && (
                <p id={`reason-${item.id}`} className="gt-muted">
                  {removeDisabledReason}
                </p>
              )}
              {children(item, index)}
            </fieldset>
          </li>
        ))}
      </ol>
      <p className="gt-sr" role="status" aria-live="polite">
        {status}
      </p>
    </>
  )
}
