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
import { formatCount, type CountForms, type Locale } from '../../lib/format'
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

const significant = /\binternational\b|международн/i

type PreparedChoice = {
  code: string
  squashed: string
  names: string[]
  words: string[]
  significant: boolean
}
const preparedByChoices = new WeakMap<Choice[], PreparedChoice[]>()
function preparedChoices(choices: Choice[]): PreparedChoice[] {
  let prepared = preparedByChoices.get(choices)
  if (!prepared) {
    prepared = choices.map((choice) => ({
      code: choice.code.toLocaleLowerCase(),
      squashed: foldSearchText(
        `${choice.code} ${choice.label} ${choice.detail ?? ''} ${choice.search ?? ''}`,
      ).replace(/[^\p{L}\p{N}]/gu, ''),
      names: [choice.detail ?? '', choice.label].map(foldSearchText),
      words: foldSearchText(`${choice.label} ${choice.detail ?? ''} ${choice.search ?? ''}`).split(
        /[^\p{L}\p{N}]+/u,
      ),
      significant: significant.test(choice.label),
    }))
    preparedByChoices.set(choices, prepared)
  }
  return prepared
}

export function searchChoices(choices: Choice[], query: string, recents: string[] = []) {
  const needle = query.trim().toLocaleLowerCase()
  const folded = foldSearchText(needle)
  const words = folded
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
  const prepared = preparedChoices(choices)
  const matched = needle
    ? choices.flatMap((choice, index) =>
        words.length > 0 && words.every((word) => prepared[index].squashed.includes(word))
          ? [{ choice, entry: prepared[index] }]
          : [],
      )
    : choices.map((choice, index) => ({ choice, entry: prepared[index] }))
  const all = matched.map(({ choice }) => choice)
  const tier = ({ entry }: (typeof matched)[number]) => {
    if (entry.code === needle) return 0
    if (entry.names.some((name) => name.startsWith(folded))) return 1
    return entry.words.some((word) => word.startsWith(words[0] ?? '')) ? 2 : 3
  }
  const recent = (choice: Choice) => {
    const index = recents.indexOf(choice.code)
    return index < 0 ? recents.length : index
  }
  const ordered = needle
    ? matched
        .map((item) => ({
          choice: item.choice,
          rank: [tier(item), recent(item.choice), item.entry.significant ? 0 : 1],
        }))
        .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2])
        .map(({ choice }) => choice)
    : [
        ...all
          .filter((choice) => recents.includes(choice.code))
          .sort((a, b) => recents.indexOf(a.code) - recents.indexOf(b.code)),
        ...all.filter((choice) => !recents.includes(choice.code)),
      ]
  return { needle, all, matches: ordered.slice(0, 50) }
}

export function useListClaimsEscape(open: boolean, close: () => void) {
  const latest = useRef(close)
  useEffect(() => {
    latest.current = close
  })
  useEffect(() => {
    if (!open) return
    const claim = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (!event.isComposing && event.keyCode !== 229) latest.current()
    }
    window.addEventListener('keydown', claim, true)
    return () => window.removeEventListener('keydown', claim, true)
  }, [open])
}

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
  useListClaimsEscape(open && !mobile, () => {
    setOpen(false)
    revert()
  })
  const settle = () => {
    if (query === null) return
    const text = foldSearchText(query.trim())
    if (!text) {
      onChange('')
      setEditing(null)
      return
    }
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

export type AsyncOption = { key: string; label: string; detail?: string }

const letters: CountForms = {
  en: { one: 'Type at least {count} letter.', other: 'Type at least {count} letters.' },
  ru: {
    one: 'Введите хотя бы {count} букву.',
    few: 'Введите хотя бы {count} буквы.',
    many: 'Введите хотя бы {count} букв.',
    other: 'Введите хотя бы {count} буквы.',
  },
}

const asyncCopy = {
  en: {
    searching: 'Searching…',
    keepTyping: (min: number) => formatCount('en', min, letters),
    none: (query: string) => `No match for “${query}”.`,
    failed: 'Search failed.',
    retry: 'Retry',
    found: (count: number) => `${count} found`,
    close: 'Close search',
  },
  ru: {
    searching: 'Ищем…',
    keepTyping: (min: number) => formatCount('ru', min, letters),
    none: (query: string) => `Ничего не найдено по запросу «${query}».`,
    failed: 'Поиск не удался.',
    retry: 'Повторить',
    found: (count: number) => `Найдено: ${count}`,
    close: 'Закрыть поиск',
  },
}

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
  refocus,
}: {
  label: string
  locale: Locale
  selected: { label: string; detail?: string } | null
  onSelect: (item: T) => void
  search: (query: string, signal: AbortSignal) => Promise<T[]>
  toOption: (item: T) => AsyncOption
  minChars?: number
  error?: string
  hint?: string
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
  shortQueryText?: (query: string) => string | null
  footer?: (close: () => void, query: string) => ReactNode
  prefill?: { text: string; nonce: number }
  refocus?: number
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.nonce])
  useEffect(() => {
    if (!refocus) return
    restoringFocus.current = true
    originRef.current?.focus()
    restoringFocus.current = false
  }, [refocus])
  const query = text ?? ''
  const { state, retry } = useAsyncSearch(query, search, { minChars })
  const loading = state.status === 'loading'
  const results = state.status === 'ready' ? state.results : []
  const options = (loading ? state.previous : results).map(toOption)
  const current = loading ? -1 : Math.min(active, Math.max(0, options.length - 1))
  const close = () => setOpen(false)
  useListClaimsEscape(open && !mobile, close)
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
      : loading
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
      if (loading) return
      setActive(
        Math.max(0, Math.min(options.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))),
      )
    }
    if (event.key === 'Enter' && open) {
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
      aria-busy={open && loading}
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
          if (!selected || query !== '') setOpen(true)
          if (!inSheet) event.target.select()
        }
      }}
      onKeyDown={keydown}
    />
  )
  const footerOpen = query.trim().length >= minChars || state.status === 'error'
  const list = (
    <>
      <p
        role="status"
        className={
          options.length > 0 && state.status !== 'error' && !loading
            ? 'flight-async-result-count'
            : undefined
        }
      >
        {status}
      </p>
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
              aria-disabled={loading || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (!loading) choose(results[index])
              }}
            >
              <span className="flight-choice-text">
                <span className="flight-choice-label">{highlight(option.label, query.trim())}</span>
                {option.detail && <small>{option.detail}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {footerOpen && footer?.(close, query.trim())}
    </>
  )
  const hasList = status !== '' || options.length > 0 || (footerOpen && !!footer)
  return (
    <div
      className="flight-combobox"
      onBlur={(event) => {
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
      {open && !mobile && hasList && <div className="flight-search-popover">{list}</div>}
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
