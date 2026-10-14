'use client'
import { useId, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { foldSearchText } from '@kuuki/shared'
import { formatCount, type Locale } from '../../lib/format'
import { Sheet } from './sheet'
import { useMobile } from './use-mobile'
import './flight-controls.css'

export type Choice = {
  code: string
  label: string
  detail?: string
  search?: string
  fallback?: boolean
}
const counts = {
  en: { one: '{count} found', other: '{count} found' },
  ru: {
    one: 'Найден {count} вариант',
    few: 'Найдено {count} варианта',
    many: 'Найдено {count} вариантов',
    other: 'Найдено {count} варианта',
  },
}
function highlight(text: string, query: string) {
  const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1
  return index < 0 ? (
    text
  ) : (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  )
}

/** Filters by code, name and aliases; an exact code ranks first, and an empty query lists recents first. */
export function searchChoices(choices: Choice[], query: string, recents: string[] = []) {
  const needle = query.trim().toLocaleLowerCase()
  const words = foldSearchText(needle)
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
  const all = choices.filter((choice) => {
    const text = foldSearchText(
      `${choice.code} ${choice.label} ${choice.detail ?? ''} ${choice.search ?? ''}`,
    ).replace(/[^\p{L}\p{N}]/gu, '')
    return !needle || (words.length > 0 && words.every((word) => text.includes(word)))
  })
  const ordered = needle
    ? [...all].sort(
        (a, b) =>
          Number(b.code.toLocaleLowerCase() === needle) -
          Number(a.code.toLocaleLowerCase() === needle),
      )
    : [
        ...all
          .filter((choice) => recents.includes(choice.code))
          .sort((a, b) => recents.indexOf(a.code) - recents.indexOf(b.code)),
        ...all.filter((choice) => !recents.includes(choice.code)),
      ]
  return { needle, all, matches: ordered.slice(0, 50) }
}

/** The shared result list: a count status and a listbox. A place (city in `detail`) leads with the city; the code sits at the end in muted mono. */
export function ChoiceOptions({
  id,
  label,
  locale,
  count,
  matches,
  needle,
  active,
  onChoose,
}: {
  id: string
  label: string
  locale: Locale
  count: number
  matches: Choice[]
  needle: string
  active: number
  onChoose: (choice: Choice) => void
}) {
  return (
    <>
      <p role="status">
        {count === 0
          ? locale === 'ru'
            ? 'Ничего не найдено'
            : 'No matches'
          : formatCount(locale, count, counts)}
      </p>
      <ul id={`${id}-list`} role="listbox" aria-label={label}>
        {matches.map((choice, index) => (
          <li
            ref={
              index === active ? (node) => node?.scrollIntoView?.({ block: 'nearest' }) : undefined
            }
            key={choice.code}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={active === index}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChoose(choice)}
          >
            <span className="flight-choice-text">
              <span className="flight-choice-label">
                {highlight(choice.detail ?? choice.label, needle)}
              </span>{' '}
              {choice.detail && <small>{highlight(choice.label, needle)}</small>}
              {choice.fallback && locale === 'ru' && <small>Название на английском</small>}
            </span>{' '}
            <span className="flight-choice-code">{highlight(choice.code, needle)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

export function Combobox({
  label,
  value,
  onChange,
  onBlur,
  inputRef,
  choices,
  locale,
  error,
  hint,
  disabled,
  recents = [],
  onSelect,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  inputRef?: Ref<HTMLInputElement>
  choices: Choice[]
  locale: Locale
  error?: string
  hint?: string
  disabled?: boolean
  recents?: string[]
  onSelect?: (code: string) => void
}) {
  const id = useId()
  const mobile = useMobile() === true
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<{
    text: string
    value: string
    committed: string
  } | null>(null)
  const [active, setActive] = useState(0)
  const originRef = useRef<HTMLInputElement>(null)
  const restoringFocus = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  // A value changed from outside (swap, reset) while text was being typed: show the new value, not the stale text.
  if (editing !== null && value !== editing.value) setEditing(null)
  const query = editing?.text ?? null
  const selected = choices.find((choice) => choice.code === value)
  const { needle, all, matches } = searchChoices(choices, query ?? '', recents)
  const choose = (choice: Choice) => {
    onChange(choice.code)
    onSelect?.(choice.code)
    setEditing(null)
    setOpen(false)
  }
  const revert = () => {
    onChange(editing?.committed ?? value)
    setEditing(null)
  }
  // Leaving the field without a choice: take the exact code or the single match, otherwise go back to the last chosen code.
  const settle = () => {
    if (query === null) return
    const text = foldSearchText(query.trim())
    if (!text) {
      onChange('')
      setEditing(null)
      return
    } // clearing the field is deliberate
    const exact = choices.find((choice) => choice.code.toLocaleLowerCase() === text)
    const found = exact ?? (all.length === 1 ? all[0] : undefined)
    if (found) {
      onChange(found.code)
      onSelect?.(found.code)
      setEditing(null)
    } else revert()
  }
  const keydown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.nativeEvent.isComposing ||
      event.nativeEvent.keyCode === 229 ||
      event.ctrlKey ||
      event.metaKey
    )
      return
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      revert()
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setActive(0)
        return
      }
      setActive((index) =>
        Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
      )
    }
    if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault()
      choose(matches[active])
    }
  }
  const input = (search: boolean) => (
    <input
      id={search ? `${id}-search` : id}
      ref={
        search
          ? searchRef
          : (node) => {
              originRef.current = node
              if (typeof inputRef === 'function') inputRef(node)
              else if (inputRef) inputRef.current = node
            }
      }
      role="combobox"
      aria-label={search ? label : undefined}
      aria-expanded={open}
      aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined}
      aria-autocomplete="list"
      aria-invalid={!!error}
      aria-describedby={
        [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') ||
        undefined
      }
      autoComplete="off"
      disabled={disabled}
      value={query ?? (search ? '' : value)}
      onChange={(event) => {
        const text = event.target.value
        const typedValue = text.toUpperCase()
        setEditing({ text, value: typedValue, committed: editing?.committed ?? value })
        onChange(typedValue)
        setActive(0)
        setOpen(true)
      }}
      onClick={() => {
        if (!disabled && !open) {
          setOpen(true)
          setActive(0)
          setEditing(null)
        }
      }}
      onFocus={() => {
        if (!disabled && !restoringFocus.current) {
          setOpen(true)
          setActive(0)
          if (!search) setEditing(null)
        }
      }}
      onBlur={onBlur}
      onKeyDown={keydown}
    />
  )
  const list = (
    <ChoiceOptions
      id={id}
      label={label}
      locale={locale}
      count={all.length}
      matches={matches}
      needle={needle}
      active={active}
      onChoose={choose}
    />
  )
  return (
    <div
      className="flight-combobox"
      onBlur={(event) => {
        if (!mobile && !event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
          settle()
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      {input(false)}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {!open && selected && (
        <small>
          {selected.label}
          {selected.fallback &&
            locale === 'ru' &&
            (locale === 'ru' ? ' · название на английском' : ' · English reference name')}
        </small>
      )}
      {error && (
        <p role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
      {open && !mobile && (
        <div className={matches.length ? 'flight-search-popover' : 'flight-search-empty'}>
          {list}
        </div>
      )}
      {mobile && (
        <Sheet
          initialDetent={1}
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) {
              if (query !== null && !query.trim()) settle()
              else revert()
            }
          }}
          title={label}
          initialFocusRef={searchRef}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            restoringFocus.current = true
            originRef.current?.focus()
            restoringFocus.current = false
          }}
          closeLabel={locale === 'ru' ? 'Закрыть поиск' : 'Close search'}
          className="flight-search-sheet flight-full-sheet"
        >
          <div className="flight-search-input">{input(true)}</div>
          {list}
        </Sheet>
      )}
    </div>
  )
}
