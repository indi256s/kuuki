'use client'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { foldSearchText } from '@kuuki/shared'
import { formatCount, type Locale } from '../../lib/format'
import { Sheet } from './sheet'
import { useAsyncSearch } from './use-async-search'
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
  const all = choices.filter(
    (choice) =>
      !needle ||
      `${choice.code} ${choice.label} ${choice.detail ?? ''} ${choice.search ?? ''}`
        .toLocaleLowerCase()
        .includes(needle),
  )
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
      <p role="status">{formatCount(locale, count, counts)}</p>
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
      {open && !mobile && <div className="flight-search-popover">{list}</div>}
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

export type AsyncOption = { key: string; label: string; detail?: string }

const asyncCopy = {
  en: {
    searching: 'Searching…',
    keepTyping: (min: number) => `Type at least ${min} letters.`,
    none: (query: string) => `No match for “${query}”.`,
    failed: 'Search failed.',
    retry: 'Retry',
    found: (count: number) => `${count} found`,
    close: 'Close search',
  },
  ru: {
    searching: 'Ищем…',
    keepTyping: (min: number) => `Введите хотя бы ${min} буквы.`,
    none: (query: string) => `Ничего не найдено по запросу «${query}».`,
    failed: 'Поиск не удался.',
    retry: 'Повторить',
    found: (count: number) => `Найдено: ${count}`,
    close: 'Закрыть поиск',
  },
}

/**
 * A combobox whose options come from a search request. The typed text is only a query: a place is chosen by
 * Enter on a highlighted option or a click, never by leaving the field, so the only match is not taken for
 * the answer. Loading, no result and failure are separate states; a failure keeps the typed text and the
 * previous choice, and a response for an older query is dropped (see useAsyncSearch).
 */
export function AsyncCombobox<T>({
  label,
  locale,
  selected,
  onSelect,
  search,
  toOption,
  minChars = 2,
  error,
  hint,
  disabled,
  inputRef,
  shortQueryText,
  footer,
  prefill,
}: {
  label: string
  locale: Locale
  /** The committed choice, shown when no query is being typed. */
  selected: { label: string; detail?: string } | null
  onSelect: (item: T) => void
  search: (query: string, signal: AbortSignal) => Promise<T[]>
  toOption: (item: T) => AsyncOption
  minChars?: number
  error?: string
  hint?: string
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
  /** Replaces the "no match" line for a query that is too short for the whole catalog to answer. */
  shortQueryText?: (query: string) => string | null
  /** Rendered under the options, e.g. "Add a place manually". `close` dismisses the list. */
  footer?: (close: () => void, query: string) => ReactNode
  /** A new `nonce` puts `text` in the field as an unresolved query, opens the list and focuses the field. */
  prefill?: { text: string; nonce: number }
}) {
  const copy = asyncCopy[locale]
  const id = useId()
  const mobile = useMobile() === true
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState<{ text: string; base: string } | null>(null)
  const [active, setActive] = useState(0)
  const originRef = useRef<HTMLInputElement>(null)
  const restoringFocus = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  // The typed text is an unresolved query. It outlives closing the list, but not a choice made elsewhere
  // (swap, reset, OCR hand-off): when the committed label moves on, the stale text goes.
  if (typed !== null && typed.base !== (selected?.label ?? '')) setTyped(null)
  const text = typed?.text ?? null
  const setText = (next: string | null) =>
    setTyped(next === null ? null : { text: next, base: selected?.label ?? '' })
  const [prefilled, setPrefilled] = useState(prefill?.nonce)
  if (prefill && prefill.nonce !== prefilled) {
    setPrefilled(prefill.nonce)
    setTyped({ text: prefill.text, base: selected?.label ?? '' })
    setActive(0)
    setOpen(true)
  }
  useEffect(() => {
    if (prefill) originRef.current?.focus()
    // Only a new nonce is a request; re-rendering with the same one must not steal focus again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.nonce])
  const query = text ?? ''
  const { state, retry } = useAsyncSearch(query, search, { minChars })
  const results = state.status === 'ready' ? state.results : []
  const options = results.map(toOption)
  const current = Math.min(active, Math.max(0, options.length - 1))
  // Closing keeps the typed text as an unresolved query; only a choice replaces it.
  const close = () => setOpen(false)
  const choose = (item: T) => {
    onSelect(item)
    setTyped(null)
    setOpen(false)
  }
  const status =
    state.status === 'idle'
      ? query.trim() === ''
        ? ''
        : copy.keepTyping(minChars)
      : state.status === 'loading'
        ? copy.searching
        : state.status === 'error'
          ? copy.failed
          : options.length > 0
            ? copy.found(options.length)
            : (shortQueryText?.(query.trim()) ?? copy.none(query.trim()))
  const keydown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setActive(
        Math.max(0, Math.min(options.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))),
      )
    }
    if (event.key === 'Enter' && open) {
      // Enter inside an open search never submits the surrounding form; it picks the highlighted option only.
      event.preventDefault()
      if (results[current]) choose(results[current])
    }
  }
  const input = (inSheet: boolean) => (
    <input
      id={inSheet ? `${id}-search` : id}
      ref={
        inSheet
          ? searchRef
          : (node) => {
              originRef.current = node
              if (typeof inputRef === 'function') inputRef(node)
              else if (inputRef) inputRef.current = node
            }
      }
      role="combobox"
      aria-label={inSheet ? label : undefined}
      aria-expanded={open}
      aria-controls={open && options.length > 0 ? `${id}-list` : undefined}
      aria-activedescendant={open && options[current] ? `${id}-option-${current}` : undefined}
      aria-autocomplete="list"
      aria-busy={open && state.status === 'loading'}
      aria-invalid={!!error}
      aria-describedby={
        [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') ||
        undefined
      }
      autoComplete="off"
      disabled={disabled}
      value={text ?? (inSheet ? '' : (selected?.label ?? ''))}
      onChange={(event) => {
        setText(event.target.value)
        setActive(0)
        setOpen(true)
      }}
      onClick={() => {
        if (!disabled && !open) setOpen(true)
      }}
      onFocus={(event) => {
        if (!disabled && !restoringFocus.current) {
          setOpen(true)
          if (!inSheet) event.target.select()
        }
      }}
      onKeyDown={keydown}
    />
  )
  const list = (
    <>
      <p role="status">{status}</p>
      {state.status === 'error' && (
        <button
          type="button"
          className="flight-combobox-action"
          onMouseDown={(event) => event.preventDefault()}
          onClick={retry}
        >
          {copy.retry}
        </button>
      )}
      {options.length > 0 && (
        <ul id={`${id}-list`} role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <li
              key={option.key}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={current === index}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(results[index])}
            >
              <span className="flight-choice-text">
                <span className="flight-choice-label">{highlight(option.label, query.trim())}</span>
                {option.detail && <small>{option.detail}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {footer?.(close, query.trim())}
    </>
  )
  return (
    <div
      className="flight-combobox"
      onBlur={(event) => {
        // Leaving the field closes the list and keeps the typed query as is. It never picks a result.
        if (!mobile && !event.currentTarget.contains(event.relatedTarget)) close()
      }}
    >
      <label htmlFor={id}>{label}</label>
      {input(false)}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {!open && selected?.detail && <small>{selected.detail}</small>}
      {error && (
        <p role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
      {open && !mobile && <div className="flight-search-popover">{list}</div>}
      {mobile && (
        <Sheet
          initialDetent={1}
          open={open}
          onOpenChange={(next) => (next ? setOpen(true) : close())}
          title={label}
          initialFocusRef={searchRef}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            restoringFocus.current = true
            originRef.current?.focus()
            restoringFocus.current = false
          }}
          closeLabel={copy.close}
          className="flight-search-sheet flight-full-sheet"
        >
          <div className="flight-search-input">{input(true)}</div>
          {list}
        </Sheet>
      )}
    </div>
  )
}
