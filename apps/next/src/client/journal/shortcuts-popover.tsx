'use client'

import * as RadixPopover from '@radix-ui/react-popover'
import { forwardRef, Fragment, type ReactNode, type RefObject } from 'react'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Kbd } from '../ui/kbd'
import { PopoverContent, PopoverRoot } from '../ui/popover'
import './shortcuts-popover.css'

// The keyboard map from the Journal spec, mirrored by use-journal-keys.ts.

const copy = {
  en: {
    title: 'Keyboard shortcuts', or: 'or',
    search: 'Search', move: 'Move between flights', open: 'Open the flight', close: 'Close the sheet or clear the search',
    select: 'Select', edit: 'Edit the focused field', show: 'Show shortcuts',
  },
  ru: {
    title: 'Сочетания клавиш', or: 'или',
    search: 'Поиск', move: 'Перейти к перелёту', open: 'Открыть перелёт', close: 'Закрыть карточку или очистить поиск',
    select: 'Выбрать', edit: 'Изменить поле', show: 'Показать сочетания',
  },
} as const

type Copy = (typeof copy)[Locale]

function rows(t: Copy): Array<{ id: string; keys: ReactNode; label: string }> {
  return [
    { id: 'search', keys: <Kbd>/</Kbd>, label: t.search },
    { id: 'move', keys: <><Kbd>↑</Kbd> <Kbd>↓</Kbd> {t.or} <Kbd>j</Kbd> <Kbd>k</Kbd></>, label: t.move },
    { id: 'open', keys: <Kbd>Enter</Kbd>, label: t.open },
    { id: 'close', keys: <Kbd>Esc</Kbd>, label: t.close },
    { id: 'select', keys: <Kbd>x</Kbd>, label: t.select },
    { id: 'edit', keys: <Kbd>e</Kbd>, label: t.edit },
    { id: 'show', keys: <Kbd>?</Kbd>, label: t.show },
  ]
}

/** Where the popover points when the page passes no anchor, or the anchor is not mounted: bottom centre of the viewport. */
const viewportBottom = () => new DOMRect(window.innerWidth / 2, window.innerHeight - 16, 0, 0)

export type ShortcutsPopoverProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  /** The element the popover points at, usually the `ShortcutsButton`. Without one it sits at the bottom of the viewport. */
  anchor?: RefObject<HTMLElement | null>
}

export function ShortcutsPopover({ open, onOpenChange, locale, anchor }: ShortcutsPopoverProps) {
  const t = copy[locale]
  return <PopoverRoot open={open} onOpenChange={onOpenChange}>
    <RadixPopover.Anchor virtualRef={{ current: { getBoundingClientRect: () => anchor?.current?.getBoundingClientRect() ?? viewportBottom() } }} />
    <PopoverContent className="journal-shortcuts" aria-label={t.title} align="end" side="top">
      <h2 className="journal-shortcuts-title">{t.title}</h2>
      <dl className="journal-shortcuts-list">
        {rows(t).map(row => <Fragment key={row.id}><dt>{row.keys}</dt><dd>{row.label}</dd></Fragment>)}
      </dl>
    </PopoverContent>
  </PopoverRoot>
}

export type ShortcutsButtonProps = { locale: Locale; onClick: () => void }

/** Page footer/toolbar trigger. Hidden on coarse pointers, where there is no keyboard to list. */
export const ShortcutsButton = forwardRef<HTMLButtonElement, ShortcutsButtonProps>(function ShortcutsButton({ locale, onClick }, ref) {
  return <Button ref={ref} variant="ghost" dense className="journal-shortcuts-button" aria-label={copy[locale].title} aria-keyshortcuts="?" aria-haspopup="dialog" onClick={onClick}>
    <Kbd aria-hidden="true">?</Kbd>
  </Button>
})
