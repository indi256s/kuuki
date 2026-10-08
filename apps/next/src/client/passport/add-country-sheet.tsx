'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/button'
import { Sheet } from '../ui/sheet'
import { Field } from '../ui/field'
import { formatCount, type Locale } from '../../lib/format'
import { searchCountries, suggestCountries, type PassportEntry } from './model'
import './passport.css'

const RESULT_FORMS = {
  en: { one: '{count} country or territory', other: '{count} countries and territories' },
  ru: { one: '{count} страна или территория', few: '{count} страны и территории', many: '{count} стран и территорий', other: '{count} страны и территории' },
}

// Arc search-field (uiarc.dev, MIT; docs/research/2026-10-08-arc-source-inventory.md): reserved clear slot and focus return, composed with Field.
/**
 * Add a country: search pinned at the top, verified suggestions (recent visits and land neighbors of collected
 * countries) and the full catalog list with collected markers. Picking a country opens its detail sheet, where the
 * visit form and the claim live.
 */
export function AddCountrySheet({ open, onOpenChange, locale, mobile, entries, name, onPick }: {
  open: boolean; onOpenChange: (open: boolean) => void; locale: Locale; mobile: boolean
  entries: PassportEntry[]; name: (code: string) => string
  /** The sheet closes into the country sheet; `opener` is where that sheet should return focus. */
  onPick: (code: string, opener: HTMLElement | null) => void
}) {
  const ru = locale === 'ru'
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const collected = useMemo(() => new Map(entries.map(entry => [entry.code, entry])), [entries])
  const suggestions = useMemo(() => suggestCountries(entries), [entries])
  const results = useMemo(() => searchCountries(query, name), [query, name])
  // The sheet has no Radix trigger (the cover and the empty state both open it), so it remembers the focused opener
  // before its own initial focus moves in, and returns there unless a pick handed focus to the country sheet.
  const opener = useRef<HTMLElement | null>(null)
  const handedOff = useRef(false)
  useLayoutEffect(() => {
    if (!open) return
    const active = document.activeElement
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null
    handedOff.current = false
  }, [open])
  const restoreFocus = (event: Event) => {
    event.preventDefault()
    if (handedOff.current) return
    if (opener.current?.isConnected) { opener.current.focus(); return }
    const heading = document.querySelector<HTMLElement>('main h1')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus({ preventScroll: true })
  }
  const pick = (code: string) => { setQuery(''); handedOff.current = true; onPick(code, opener.current) }
  const status = (code: string) => {
    const entry = collected.get(code)
    return !entry ? '' : entry.status === 'pending' ? (ru ? 'ждёт отметки' : 'waiting') : (ru ? 'в паспорте' : 'in passport')
  }
  const choice = (code: string) => <li key={code}><button type="button" className="passport-choice" onClick={() => pick(code)}>{name(code)}</button></li>

  return <Sheet open={open} onOpenChange={next => { if (!next) setQuery(''); onOpenChange(next) }} side={mobile ? 'bottom' : 'right'}
    className="passport-sheet-panel" title={ru ? 'Добавить страну' : 'Add country'} closeLabel={ru ? 'Закрыть' : 'Close'} initialFocusRef={search} onCloseAutoFocus={restoreFocus}>
    <div className="passport-sheet">
      <div className="passport-search">
        <Field ref={search} type="search" label={ru ? 'Найти страну' : 'Find a country'} value={query} autoComplete="off"
          onChange={event => setQuery(event.target.value)} hint={ru ? 'Название на любом языке или код страны' : 'Name in any language or country code'} />
        <Button className="passport-search-clear" variant="ghost" aria-label={ru ? 'Очистить поиск' : 'Clear search'} disabled={!query}
          onClick={() => { setQuery(''); search.current?.focus() }}><X size={18} aria-hidden="true" /></Button>
      </div>
      {!query.trim() && suggestions.recent.length ? <section aria-labelledby="add-recent">
        <h3 id="add-recent">{ru ? 'Недавние визиты' : 'Recent visits'}</h3>
        <ul className="passport-choices">{suggestions.recent.map(choice)}</ul>
      </section> : null}
      {!query.trim() && suggestions.neighbors.length ? <section aria-labelledby="add-neighbors">
        <h3 id="add-neighbors">{ru ? 'Соседи ваших стран' : 'Neighbors of your countries'}</h3>
        <ul className="passport-choices">{suggestions.neighbors.map(choice)}</ul>
      </section> : null}
      <section aria-labelledby="add-all">
        <h3 id="add-all">{query.trim() ? (ru ? 'Найдено' : 'Results') : (ru ? 'Все страны и территории' : 'All countries and territories')}</h3>
        <p role="status" className="passport-note">{query.trim() ? (results.length ? formatCount(locale, results.length, RESULT_FORMS) : (ru ? 'Ничего не найдено. Попробуйте другое название.' : 'Nothing found. Try another name.')) : ''}</p>
        <ul className="passport-list passport-country-list" aria-label={ru ? 'Страны' : 'Countries'}>
          {results.map(code => <li key={code} data-collected={collected.has(code)}>
            <button type="button" onClick={() => pick(code)}><span>{name(code)}</span>{status(code) ? <span><span className="sr-only">, </span>{status(code)}</span> : null}</button>
          </li>)}
        </ul>
      </section>
    </div>
  </Sheet>
}
