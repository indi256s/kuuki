'use client'

import { useEffect, useRef, type RefObject } from 'react'

export type JournalKeyOptions = {
  /** False on touch/phones and while a modal dialog other than the sheet is open. */
  enabled: boolean
  searchRef: RefObject<HTMLInputElement | null>
  /** The ledger table, to find `[data-flight-row]` buttons in DOM order. */
  ledgerRef: RefObject<HTMLElement | null>
  sheetOpen: boolean
  onCloseSheet: () => void
  onToggleSelect: (id: number) => void
  /** Esc when the sheet is closed and the search has text but focus is elsewhere. */
  onClearSearch: () => void
  hasSearch: boolean
  onShowShortcuts: () => void
  /** Called with the row's flight id after j/k or an arrow moves focus to it (the docked sheet follows it). */
  onMove?: (id: number) => void
}

// Inputs that take no typed text; shortcuts keep working while one has focus.
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'image', 'file', 'range', 'color'])
const ROW = '[data-flight-row]'

function isEditable(target: Element): boolean {
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type)
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null
}

/** Other widgets own the arrow keys and typing inside these, so j/k stay out of them. */
const isOverlay = (target: Element) => target.closest('[role="dialog"], [role="menu"], [role="listbox"]') !== null

function moveRowFocus(ledger: HTMLElement | null, target: Element, direction: 1 | -1, onMove?: (id: number) => void): boolean {
  if (!ledger) return false
  const rows = Array.from(ledger.querySelectorAll<HTMLElement>(ROW))
  if (rows.length === 0) return false
  const current = rows.findIndex(row => row === target || (row.closest('tr, [role="row"]') ?? row).contains(target))
  const next = current === -1 ? (direction === 1 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, current + direction))
  const row = rows[next]
  row.focus()
  row.scrollIntoView({ block: 'nearest' })
  const id = Number(row.dataset.flightRow)
  if (onMove && Number.isFinite(id)) onMove(id)
  return true
}

/**
 * Journal keyboard layer: one `keydown` listener on `document` while `enabled`.
 * `/` search, j/k or arrows move row focus, `x` selects, `e` edits the focused sheet field, Esc closes the sheet or clears the search,
 * `?` lists them. Enter is native (the row button opens the sheet). Nothing here is destructive.
 */
export function useJournalKeys(options: JournalKeyOptions): void {
  const latest = useRef(options)
  useEffect(() => { latest.current = options })
  const { enabled } = options

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.shiftKey && event.key !== '?') return
      const target = event.target instanceof Element ? event.target : document.body
      const o = latest.current
      const editable = isEditable(target)
      // Other modal widgets own all their keys; the flight sheet keeps its edit/close shortcuts.
      if (isOverlay(target) && !target.closest('.journal-detail-sheet')) return

      if (event.key === 'Escape') {
        // Editable fields keep their own Escape. The search field passes an empty-field Escape through so the sheet can still close.
        if (editable && target !== o.searchRef.current) return
        if (o.sheetOpen) { event.preventDefault(); o.onCloseSheet() } else if (o.hasSearch) { event.preventDefault(); o.onClearSearch() }
        return
      }
      if (editable) return

      switch (event.key) {
        case '/': {
          const search = o.searchRef.current
          if (!search) return
          event.preventDefault()
          search.focus()
          search.select()
          return
        }
        case 'j': case 'k':
          if (isOverlay(target)) return
          if (moveRowFocus(o.ledgerRef.current, target, event.key === 'j' ? 1 : -1, o.onMove)) event.preventDefault()
          return
        case 'ArrowDown': case 'ArrowUp': {
          const inLedger = o.ledgerRef.current?.contains(target) ?? false
          if (!inLedger && target !== document.body && target !== document.documentElement) return
          if (moveRowFocus(o.ledgerRef.current, target, event.key === 'ArrowDown' ? 1 : -1, o.onMove)) event.preventDefault()
          return
        }
        case 'x': {
          const row = target.closest<HTMLElement>(ROW)
          const id = Number(row?.dataset.flightRow)
          if (row && Number.isFinite(id)) { event.preventDefault(); o.onToggleSelect(id) }
          return
        }
        case 'e': {
          const trigger = target.closest('.jd-row[data-field]')?.querySelector<HTMLElement>('.jd-trigger')
          if (trigger) { event.preventDefault(); trigger.click() }
          return
        }
        case '?':
          event.preventDefault()
          o.onShowShortcuts()
          return
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
