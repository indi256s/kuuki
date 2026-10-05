'use client'
import { useId, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { formatCount, type Locale } from '../../lib/format'
import { Sheet } from './sheet'
import { useMobile } from './use-mobile'
import './flight-controls.css'

export type Choice = { code: string; label: string; detail?: string; search?: string; fallback?: boolean }
const counts = { en: { one: '{count} found', other: '{count} found' }, ru: { one: 'Найден {count} вариант', few: 'Найдено {count} варианта', many: 'Найдено {count} вариантов', other: 'Найдено {count} варианта' } }
function highlight(text: string, query: string) {
  const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1
  return index < 0 ? text : <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>
}

export function Combobox({ label, value, onChange, onBlur, inputRef, choices, locale, error, disabled, recents = [], onSelect }: {
  label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; inputRef?: Ref<HTMLInputElement>
  choices: Choice[]; locale: Locale; error?: string; disabled?: boolean; recents?: string[]; onSelect?: (code: string) => void
}) {
  const id = useId()
  const mobile = useMobile()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const originRef = useRef<HTMLInputElement>(null)
  const restoringFocus = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const selected = choices.find(choice => choice.code === value)
  const needle = (query ?? '').trim().toLocaleLowerCase()
  const all = choices.filter(choice => !needle || `${choice.code} ${choice.label} ${choice.detail ?? ''} ${choice.search ?? ''}`.toLocaleLowerCase().includes(needle))
  const ordered = needle ? [...all].sort((a, b) => Number(b.code.toLocaleLowerCase() === needle) - Number(a.code.toLocaleLowerCase() === needle)) : [...all.filter(choice => recents.includes(choice.code)).sort((a, b) => recents.indexOf(a.code) - recents.indexOf(b.code)), ...all.filter(choice => !recents.includes(choice.code))]
  const matches = ordered.slice(0, 50)
  const choose = (choice: Choice) => { onChange(choice.code); onSelect?.(choice.code); setQuery(null); setOpen(false) }
  const keydown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey) return
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setQuery(null) }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true)
      setActive(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
    }
    if (event.key === 'Enter' && open && matches[active]) { event.preventDefault(); choose(matches[active]) }
  }
  const input = (search: boolean) => <input id={search ? `${id}-search` : id} ref={search ? searchRef : node => { originRef.current = node; if (typeof inputRef === 'function') inputRef(node); else if (inputRef) inputRef.current = node }} role="combobox" aria-label={search ? label : undefined} aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined} aria-autocomplete="list" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} autoComplete="off" disabled={disabled} value={search ? query ?? '' : value} onChange={event => { setQuery(event.target.value); onChange(event.target.value.toUpperCase()); setActive(0); setOpen(true) }} onClick={() => { if (!disabled && !open) { setOpen(true); setActive(0); setQuery(null) } }} onFocus={() => { if (!disabled && !restoringFocus.current) { setOpen(true); setActive(0); if (!search) setQuery(null) } }} onBlur={() => { onBlur?.(); if (!mobile) { setOpen(false); setQuery(null) } }} onKeyDown={keydown} />
  const list = <><p role="status">{formatCount(locale, all.length, counts)}</p><ul id={`${id}-list`} role="listbox" aria-label={label}>{matches.map((choice, index) => <li ref={index === active ? node => node?.scrollIntoView?.({ block: 'nearest' }) : undefined} key={choice.code} id={`${id}-option-${index}`} role="option" aria-selected={active === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(choice)}><span className="flight-choice-code">{highlight(choice.code, needle)}</span> {highlight(choice.label, needle)}{choice.detail && <small>{highlight(choice.detail, needle)}</small>}{choice.fallback && <small>{locale === 'ru' ? 'Название на английском' : 'English reference name'}</small>}</li>)}</ul></>
  return <div className="flight-combobox"><label htmlFor={id}>{label}</label>{input(false)}{!open && selected && <small>{selected.label}{selected.fallback && (locale === 'ru' ? ' · название на английском' : ' · English reference name')}</small>}{error && <p role="alert" id={`${id}-error`}>{error}</p>}
    {open && !mobile && <div className="flight-search-popover">{list}</div>}
    {mobile && <Sheet open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery(null) }} title={label} initialFocusRef={searchRef} onCloseAutoFocus={event => { event.preventDefault(); restoringFocus.current = true; originRef.current?.focus(); restoringFocus.current = false }} closeLabel={locale === 'ru' ? 'Закрыть поиск' : 'Close search'} className="flight-search-sheet flight-full-sheet"><div className="flight-search-input">{input(true)}</div>{list}</Sheet>}
  </div>
}
