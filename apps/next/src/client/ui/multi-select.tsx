'use client'

import { Check, ChevronDown } from 'lucide-react'
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
} from 'react'
import { foldSearchText } from '@kuuki/shared'
import { formatCount, formatNumber, type Locale } from '../../lib/format'
import { summarizeValues } from './chip-group'
import { PopoverContent, PopoverRoot, PopoverTrigger } from './popover'
import { Sheet } from './sheet'
import { useMobile } from './use-mobile'
import './flight-controls.css'
import './multi-select.css'

// Adapted from Arc "multi-select" (uiarc.dev, MIT, see ARC-LICENSE.txt): the multiselectable listbox of checkable options and its keyboard model.
// Dropped: the inline chip trigger, the clear button, the `motion` package. Added: search (foldSearchText), counts and detail lines, and the
// Popover (desktop) / full-height Sheet (up to 700px) surfaces that combobox.tsx uses. Space toggles in the list, so the search input keeps spaces.

export type MultiSelectOption = {
  value: string
  label: string
  /** Second line under the label. */
  detail?: string
  /** Shown at the end of the row, for example how many flights match. */
  count?: number
  /** Set the label in the mono face (codes, flight numbers). */
  mono?: boolean
}

export type MultiSelectProps = {
  /** Names the listbox, the popover and the sheet title, for example "Airline". */
  label: string
  options: MultiSelectOption[]
  value: string[]
  onValueChange: (value: string[]) => void
  locale: Locale
  /** The element that opens the picker (a button; it is rendered as-is). Defaults to a button showing the label and up to two selected values. */
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
}

const copy = {
  en: { search: 'Search', none: 'No matches', close: 'Close' },
  ru: { search: 'Поиск', none: 'Ничего не найдено', close: 'Закрыть' },
}
const found = {
  en: { one: '{count} found', other: '{count} found' },
  ru: {
    one: 'Найден {count} вариант',
    few: 'Найдено {count} варианта',
    many: 'Найдено {count} вариантов',
    other: 'Найдено {count} варианта',
  },
}

function Panel({
  label,
  options,
  value,
  onValueChange,
  locale,
  searchRef,
}: Pick<MultiSelectProps, 'label' | 'options' | 'value' | 'onValueChange' | 'locale'> & {
  searchRef: RefObject<HTMLInputElement | null>
}) {
  const id = useId()
  const t = copy[locale]
  const listRef = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const needle = foldSearchText(query.trim())
  const results = needle
    ? options.filter((option) =>
        foldSearchText(`${option.label} ${option.detail ?? ''} ${option.value}`).includes(needle),
      )
    : options
  const current = Math.min(active, results.length - 1)
  const selected = new Set(value)
  const toggle = (option: MultiSelectOption) =>
    onValueChange(
      selected.has(option.value)
        ? value.filter((item) => item !== option.value)
        : [...value, option.value],
    )
  const move = (index: number) => setActive(Math.max(0, Math.min(results.length - 1, index)))
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!results.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(current + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (current === 0) searchRef.current?.focus()
      else move(current - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      move(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      move(results.length - 1)
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      const option = results[current]
      if (option) toggle(option)
    }
  }
  return (
    <>
      <div className="ui-multi-search">
        <input
          ref={searchRef}
          className="ui-field-input"
          type="search"
          aria-label={t.search}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && results.length) {
              event.preventDefault()
              setActive(0)
              listRef.current?.focus()
            }
          }}
        />
      </div>
      <p role="status" className="ui-multi-status">
        {results.length ? formatCount(locale, results.length, found) : t.none}
      </p>
      <ul
        ref={listRef}
        className="ui-multi-list"
        role="listbox"
        aria-label={label}
        aria-multiselectable="true"
        tabIndex={0}
        aria-activedescendant={results[current] ? `${id}-option-${current}` : undefined}
        onKeyDown={onListKeyDown}
      >
        {results.map((option, index) => (
          <li
            key={option.value}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={selected.has(option.value)}
            className="ui-multi-option"
            data-active={index === current}
            ref={
              index === current ? (node) => node?.scrollIntoView?.({ block: 'nearest' }) : undefined
            }
            onClick={() => {
              setActive(index)
              toggle(option)
            }}
          >
            <span className="ui-multi-check" aria-hidden="true">
              {selected.has(option.value) ? <Check size={14} strokeWidth={2.5} /> : null}
            </span>
            <span className="ui-multi-text">
              <span className="ui-multi-label" data-mono={option.mono || undefined}>
                {option.label}
              </span>
              {option.detail ? <small>{option.detail}</small> : null}
            </span>
            {option.count != null ? (
              <span className="ui-multi-count">{formatNumber(locale, option.count)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}

export function MultiSelect({
  label,
  options,
  value,
  onValueChange,
  locale,
  trigger,
  open: openProp,
  onOpenChange,
  disabled,
}: MultiSelectProps) {
  const mobile = useMobile() === true
  const searchRef = useRef<HTMLInputElement>(null)
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next)
    onOpenChange?.(next)
  }
  const { shown, more } = summarizeValues(
    value.map((item) => options.find((option) => option.value === item)?.label ?? item),
  )
  const opener = trigger ?? (
    <button type="button" className="ui-multi-trigger" disabled={disabled}>
      <span className="ui-multi-trigger-label">
        {label}
        {shown.length ? (
          <span>
            {': '}
            {shown.join(', ')}
            {more ? ` +${more}` : ''}
          </span>
        ) : null}
      </span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  )
  const panel = (
    <Panel
      label={label}
      options={options}
      value={value}
      onValueChange={onValueChange}
      locale={locale}
      searchRef={searchRef}
    />
  )
  if (mobile)
    return (
      <Sheet
        initialDetent={1}
        open={open}
        onOpenChange={setOpen}
        title={label}
        trigger={opener}
        initialFocusRef={searchRef}
        closeLabel={copy[locale].close}
        className="ui-multi-sheet flight-full-sheet"
      >
        {panel}
      </Sheet>
    )
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{opener}</PopoverTrigger>
      <PopoverContent
        aria-label={label}
        className="ui-multi-popover"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchRef.current?.focus()
        }}
      >
        {panel}
      </PopoverContent>
    </PopoverRoot>
  )
}
