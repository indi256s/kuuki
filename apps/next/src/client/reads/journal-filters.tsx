'use client'

import Link from 'next/link'
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../ui/button'
import { Sheet } from '../ui/sheet'
import type { Locale } from '../../server/locale'
import { JOURNAL_SORTS, normalizeJournalQuery, resetJournalFilters, withQuery } from '../../lib/url-state'

export const TEXT_KEYS = ['year', 'airline', 'aircraft', 'airport', 'origin', 'destination'] as const
const SELECT_KEYS = ['status', 'sort', 'order'] as const
type TextKey = (typeof TEXT_KEYS)[number]
type Values = Record<string, string>

const text = {
  en: {
    search: 'Search routes, cities, codes or flight number', submit: 'Search', year: 'Year', status: 'Status', all: 'All', upcoming: 'Upcoming', awaiting: 'Awaiting', logged: 'Logged', completed: 'Completed',
    airline: 'Airline', aircraft: 'Aircraft', airport: 'Airport', origin: 'Origin', destination: 'Destination', sort: 'Sort', order: 'Order', desc: 'Descending', asc: 'Ascending', date: 'Date', distance: 'Distance', duration: 'Duration',
    filters: 'Filters', apply: 'Apply filters', close: 'Close filters', reset: 'Reset filters',
  },
  ru: {
    search: 'Поиск по маршруту, городу, коду или номеру рейса', submit: 'Найти', year: 'Год', status: 'Статус', all: 'Все', upcoming: 'Предстоящие', awaiting: 'Ждут подтверждения', logged: 'В журнале', completed: 'Завершённые',
    airline: 'Авиакомпания', aircraft: 'Самолёт', airport: 'Аэропорт', origin: 'Откуда', destination: 'Куда', sort: 'Сортировка', order: 'Порядок', desc: 'По убыванию', asc: 'По возрастанию', date: 'Дата', distance: 'Расстояние', duration: 'Длительность',
    filters: 'Фильтры', apply: 'Применить фильтры', close: 'Закрыть фильтры', reset: 'Сбросить фильтры',
  },
} as const

function problemText(locale: Locale, key: TextKey): string {
  const year = new Date().getUTCFullYear() + 1
  if (locale === 'ru') return ({
    year: `Введите год от 1900 до ${year}, например 2025.`,
    airline: 'Введите 2–3 буквы или цифры кода авиакомпании, например TK.',
    aircraft: 'Введите 2–4 буквы или цифры кода самолёта, например B738.',
    airport: 'Введите трёхбуквенный код аэропорта, например IST.',
    origin: 'Введите трёхбуквенный код аэропорта, например IST.',
    destination: 'Введите трёхбуквенный код аэропорта, например IST.',
  })[key]
  return ({
    year: `Enter a year from 1900 to ${year}, for example 2025.`,
    airline: 'Enter a 2 or 3 character airline code, for example TK.',
    aircraft: 'Enter a 2 to 4 character aircraft code, for example B738.',
    airport: 'Enter a 3-letter airport code, for example IST.',
    origin: 'Enter a 3-letter airport code, for example IST.',
    destination: 'Enter a 3-letter airport code, for example IST.',
  })[key]
}

/** What the C1 contract keeps for one field, or null when it would silently drop the value. The contract stays the single source of truth. */
export function normalizeField(key: string, value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return normalizeJournalQuery(new URLSearchParams({ [key]: trimmed })).state[key] ?? null
}

type Change = Record<string, string>
type Props = {
  locale: Locale
  query: string
  filtered: boolean
  /** One navigation for the whole change set; the page owns history and selection rules. */
  apply: (changes: Change) => void
}

export function JournalFilters({ locale, query, filtered, apply }: Props) {
  const t = text[locale]
  const base = useId()
  const params = new URLSearchParams(query)
  const urlValues: Values = { q: params.get('q') ?? '' }
  for (const key of TEXT_KEYS) urlValues[key] = params.get(key) ?? ''
  const [drafts, setDrafts] = useState<Values>(urlValues)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  // Values this component sent that the URL has not confirmed yet, oldest first. A URL value found in the list is our own navigation arriving
  // (possibly an intermediate one), so the draft is left alone; a value that is not in the list is an external change (Reset, Back, a link) and replaces it.
  const [sent, setSent] = useState<Record<string, string[]>>({})
  const [lastUrl, setLastUrl] = useState(urlValues)
  const [seen, setSeen] = useState(query)
  if (seen !== query) {
    setSeen(query)
    setLastUrl(urlValues)
    const adopt: Values = {}
    const remaining = { ...sent }
    for (const key of ['q', ...TEXT_KEYS]) {
      if (urlValues[key] === lastUrl[key]) continue
      const list = sent[key] ?? []
      const at = list.indexOf(urlValues[key])
      if (at < 0) { adopt[key] = urlValues[key]; delete remaining[key]; continue }
      const rest = list.slice(at + 1)
      if (rest.length) remaining[key] = rest; else delete remaining[key]
    }
    setSent(remaining)
    if (Object.keys(adopt).length) setDrafts(old => ({ ...old, ...adopt }))
  }
  /** What the field holds as far as this component knows: the last value it sent, otherwise the URL's. */
  const effective = (key: string) => sent[key]?.at(-1) ?? urlValues[key]
  const [open, setOpen] = useState(false)
  const [staged, setStaged] = useState<Values>({})
  const [stagedTouched, setStagedTouched] = useState<Record<string, boolean>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const selectValues: Values = { status: params.get('status') ?? '', sort: params.get('sort') ?? 'date', order: params.get('order') ?? 'desc' }

  const problems = (values: Values, shown: Record<string, boolean>) => {
    const result: Record<string, string | undefined> = {}
    for (const key of TEXT_KEYS) if (shown[key] && normalizeField(key, values[key] ?? '') === null) result[key] = problemText(locale, key)
    return result
  }
  const invalidKeys = (values: Values) => TEXT_KEYS.filter(key => normalizeField(key, values[key] ?? '') === null)

  /** Only the fields whose normalized value differs from the URL. Nothing changed means nothing is sent. */
  const diff = (values: Values, keys: readonly string[]) => {
    const changes: Change = {}
    for (const key of keys) {
      const next = key === 'q' ? values.q.trim().slice(0, 100) : normalizeField(key, values[key] ?? '')
      if (next === null) continue
      if (next !== effective(key)) changes[key] = next
    }
    return changes
  }
  const send = (changes: Change) => {
    if (!Object.keys(changes).length) return
    setSent(old => { const next = { ...old }; for (const key of Object.keys(changes)) if (key === 'q' || (TEXT_KEYS as readonly string[]).includes(key)) next[key] = [...(next[key] ?? []), changes[key]]; return next })
    apply(changes)
  }

  const commitField = (key: string) => {
    if (key !== 'q') {
      setTouched(old => ({ ...old, [key]: true }))
      if (normalizeField(key, drafts[key] ?? '') === null) return
    }
    const normalized = key === 'q' ? drafts.q.trim() : normalizeField(key, drafts[key] ?? '')!
    // Show the canonical form (TK, not tk) once it is accepted.
    if (normalized !== drafts[key]) setDrafts(old => ({ ...old, [key]: normalized }))
    send(diff({ ...drafts, [key]: normalized }, [key]))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const bad = invalidKeys(drafts)
    if (bad.length) {
      setTouched(old => ({ ...old, ...Object.fromEntries(bad.map(key => [key, true])) }))
      formRef.current?.querySelector<HTMLElement>(`[data-filter="${bad[0]}"]`)?.focus()
      return
    }
    const clean: Values = { q: drafts.q.trim() }
    for (const key of TEXT_KEYS) clean[key] = normalizeField(key, drafts[key] ?? '')!
    setDrafts(clean)
    send(diff(clean, ['q', ...TEXT_KEYS]))
  }

  const openSheet = (next: boolean) => {
    if (next) { setStaged({ ...Object.fromEntries(TEXT_KEYS.map(key => [key, effective(key)])), ...selectValues }); setStagedTouched({}) }
    setOpen(next)
  }
  const applyStaged = () => {
    const bad = invalidKeys(staged)
    if (bad.length) {
      setStagedTouched(old => ({ ...old, ...Object.fromEntries(bad.map(key => [key, true])) }))
      sheetRef.current?.querySelector<HTMLElement>(`[data-filter="${bad[0]}"]`)?.focus()
      return
    }
    const changes: Change = {}
    const accepted: Values = {}
    for (const key of TEXT_KEYS) { const next = normalizeField(key, staged[key] ?? '')!; accepted[key] = next; if (next !== effective(key)) changes[key] = next }
    for (const key of SELECT_KEYS) if (staged[key] !== selectValues[key]) changes[key] = staged[key]
    // Search submits the desktop drafts, so the accepted mobile values become the drafts.
    setDrafts(old => ({ ...old, ...accepted }))
    send(changes)
    setOpen(false)
  }

  const desktop = <Fields idBase={`${base}-d`} t={t} values={{ ...drafts, ...selectValues }} problems={problems(drafts, touched)}
    onChange={(key, value) => { if ((SELECT_KEYS as readonly string[]).includes(key)) send({ [key]: value }); else setDrafts(old => ({ ...old, [key]: value })) }}
    onBlur={commitField} />
  const mobile = <div ref={sheetRef} className="journal-filter-sheet"><Fields idBase={`${base}-m`} t={t} values={staged} problems={problems(staged, stagedTouched)}
    onChange={(key, value) => setStaged(old => ({ ...old, [key]: value }))}
    onBlur={key => setStagedTouched(old => ({ ...old, [key]: true }))} /></div>

  return <div className="journal-filters">
    <form ref={formRef} role="search" className="journal-search" onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor={`${base}-q`}>{t.search}</label>
      <input id={`${base}-q`} type="search" value={drafts.q} onChange={event => setDrafts(old => ({ ...old, q: event.target.value }))} placeholder={t.search} />
      <Button type="submit">{t.submit}</Button>
      <div className="journal-filter-fields journal-filters-desktop">{desktop}</div>
    </form>
    <Sheet open={open} onOpenChange={openSheet} title={t.filters} closeLabel={t.close} trigger={<Button className="journal-filters-trigger">{t.filters}</Button>} footer={<Button variant="primary" onClick={applyStaged}>{t.apply}</Button>}>{mobile}</Sheet>
    {filtered && <Link className="text-link" href={withQuery('/journal', resetJournalFilters(query))}>{t.reset}</Link>}
  </div>
}

function Fields({ idBase, t, values, problems, onChange, onBlur }: {
  idBase: string; t: (typeof text)[Locale]; values: Values; problems: Record<string, string | undefined>
  onChange: (key: string, value: string) => void; onBlur: (key: string) => void
}) {
  const input = (key: TextKey, label: string, extra: { placeholder: string; maxLength: number; inputMode?: 'numeric' }): ReactNode => {
    const problem = problems[key]
    const id = `${idBase}-${key}`
    return <div className="journal-filter" key={key}>
      <label htmlFor={id}>{label}</label>
      <input id={id} data-filter={key} autoComplete="off" spellCheck={false} value={values[key] ?? ''} maxLength={extra.maxLength} placeholder={extra.placeholder} inputMode={extra.inputMode}
        aria-invalid={problem ? true : undefined} aria-describedby={problem ? `${id}-error` : undefined}
        onChange={event => onChange(key, event.target.value)} onBlur={() => onBlur(key)} />
      {problem && <span id={`${id}-error`} className="journal-filter-error">{problem}</span>}
    </div>
  }
  const select = (key: (typeof SELECT_KEYS)[number], label: string, options: ReadonlyArray<readonly [string, string]>) => {
    const id = `${idBase}-${key}`
    return <div className="journal-filter" key={key}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={values[key] ?? ''} onChange={event => onChange(key, event.target.value)}>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
    </div>
  }
  const sortNames: Record<(typeof JOURNAL_SORTS)[number], string> = { date: t.date, origin: t.origin, destination: t.destination, airline_iata: t.airline, aircraft_icao: t.aircraft, distance_km: t.distance, duration_minutes: t.duration }
  return <>
    {input('year', t.year, { placeholder: t.all, maxLength: 4, inputMode: 'numeric' })}
    {select('status', t.status, [['', t.all], ['upcoming', t.upcoming], ['awaiting', t.awaiting], ['logged', t.logged], ['completed', t.completed]])}
    {input('airline', t.airline, { placeholder: 'IATA', maxLength: 3 })}
    {input('aircraft', t.aircraft, { placeholder: 'ICAO', maxLength: 4 })}
    {input('airport', t.airport, { placeholder: 'IATA', maxLength: 3 })}
    {input('origin', t.origin, { placeholder: 'IATA', maxLength: 3 })}
    {input('destination', t.destination, { placeholder: 'IATA', maxLength: 3 })}
    {select('sort', t.sort, JOURNAL_SORTS.map(sort => [sort, sortNames[sort]] as const))}
    {select('order', t.order, [['desc', t.desc], ['asc', t.asc]])}
  </>
}
