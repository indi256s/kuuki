'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { GripVertical } from '@keyline-icons/react'
import type { Locale } from '../../../lib/format'
import { announceShellNotice } from '../../shell-notices'
import { Button } from '../../ui/button'
import { Menu, MenuItem } from '../../ui/menu'
import { Disclosure } from '../../ui/disclosure'

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

export function RowFields({
  locale,
  summary,
  detail,
  complete,
  hasError,
  fresh,
  disabled,
  children,
}: {
  locale: Locale
  summary: string
  detail?: string
  complete: boolean
  hasError: boolean
  fresh: boolean
  disabled?: boolean
  children: ReactNode
}) {
  const [opened, setOpened] = useState(!complete || fresh)
  const id = useId()
  if ((hasError || !complete) && !opened) setOpened(true)
  const visible = opened || hasError || !complete
  return (
    <div className="gt-row-fields">
      {complete && !hasError && (
        <div className="gt-row-summary">
          <div>
            <p className="gt-row-primary">{summary}</p>
            {detail && <p className="gt-muted">{detail}</p>}
          </div>
          <Button
            variant="ghost"
            disabled={disabled}
            aria-expanded={visible}
            aria-controls={id}
            onClick={() => setOpened(!opened)}
          >
            {visible
              ? locale === 'ru'
                ? 'Готово'
                : 'Done'
              : locale === 'ru'
                ? 'Изменить'
                : 'Edit'}
          </Button>
        </div>
      )}
      <div id={id} hidden={!visible} inert={!visible}>
        {children}
      </div>
    </div>
  )
}

export function RowDetails({
  locale,
  hasError,
  children,
}: {
  locale: Locale
  hasError: boolean
  children: ReactNode
}) {
  const [opened, setOpened] = useState(false)
  if (hasError && !opened) setOpened(true)
  return (
    <Disclosure
      layout="row"
      summary={locale === 'ru' ? 'Подробности' : 'Details'}
      open={opened || hasError}
      onOpenChange={setOpened}
    >
      {children}
    </Disclosure>
  )
}

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
  title: (item: T, index: number) => string
  name: (item: T, index: number) => string
  onMove: (from: number, to: number) => void
  onRemove: (id: string) => void
  onRestore: (items: T[]) => void
  removeDisabledReason?: string
  disabled?: boolean
  children: (item: T, index: number) => ReactNode
  label: string
}) {
  const ru = locale === 'ru'
  const list = useRef<HTMLOListElement>(null)
  const pendingFocus = useRef<{ id: string } | { next: string | null } | null>(null)
  const [status, setStatus] = useState('')
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null)
  const dragRef = useRef<{ id: string; from: number; over: number } | null>(null)
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
    if ('id' in target) {
      root.querySelector<HTMLElement>(`[data-row-id="${target.id}"] [data-row-menu]`)?.focus()
    } else if (target.next) {
      root.querySelector<HTMLElement>(`[data-row-id="${target.next}"] [data-row-menu]`)?.focus()
    }
  })

  const move = (index: number, dir: Dir) => {
    const to = dir === 'up' ? index - 1 : index + 1
    if (to < 0 || to >= items.length) return
    const item = items[index]
    pendingFocus.current = { id: item.id }
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
      pendingFocus.current = { id: item.id }
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
              <legend className="sr-only">{title(item, index)}</legend>
              <div className="gt-row-header">
                <span className="gt-row-label" aria-hidden="true">
                  {title(item, index)}
                </span>
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
                  <Menu
                    align="end"
                    trigger={
                      <Button
                        variant="ghost"
                        className="gt-icon-button"
                        data-row-menu
                        disabled={disabled}
                        aria-label={
                          ru ? `${name(item, index)}: действия` : `Actions for ${name(item, index)}`
                        }
                      >
                        <span aria-hidden="true">⋯</span>
                      </Button>
                    }
                  >
                    <MenuItem disabled={index === 0 || disabled} onSelect={() => move(index, 'up')}>
                      {ru ? 'Выше' : 'Move up'}
                    </MenuItem>
                    <MenuItem
                      disabled={index === items.length - 1 || disabled}
                      onSelect={() => move(index, 'down')}
                    >
                      {ru ? 'Ниже' : 'Move down'}
                    </MenuItem>
                    <MenuItem
                      danger
                      disabled={disabled || !!removeDisabledReason}
                      aria-describedby={removeDisabledReason ? `reason-${item.id}` : undefined}
                      onSelect={() => remove(index)}
                    >
                      {ru ? 'Удалить' : 'Remove'}
                    </MenuItem>
                    {removeDisabledReason && (
                      <p id={`reason-${item.id}`} className="gt-muted">
                        {removeDisabledReason}
                      </p>
                    )}
                  </Menu>
                </div>
              </div>
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
