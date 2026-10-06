'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { addDays } from '@kuuki/shared/calendar'
import { formatDateOnly, formatMonthYear, type Locale } from '../../lib/format'
import './flight-controls.css'

function normalize(text: string, locale: Locale) {
  const match = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(text)
  return match ? `${match[3]}-${locale === 'ru' ? match[2] : match[1]}-${locale === 'ru' ? match[1] : match[2]}` : text
}
function todayLabel() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
/** Same day number in another month, clamped to the last day of a shorter month (Jan 31 + 1 month = Feb 28). */
function addMonths(day: string, delta: number) {
  const [year, month, date] = day.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + delta, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  return `${String(target.getUTCFullYear()).padStart(4, '0')}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(date, last)).padStart(2, '0')}`
}
function valid(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value
}
export function Calendar({ label, value, onChange, onBlur, inputRef, locale, error, disabled }: {
  label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; inputRef?: Ref<HTMLInputElement>; locale: Locale; error?: string; disabled?: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => valid(value) ? value.slice(0, 7) : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  const popover = useRef<HTMLDivElement>(null)
  const [year, monthNumber] = month.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const start = addDays(`${month}-01`, -((weekday + (locale === 'ru' ? 6 : 0)) % 7))
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index))
  const shiftMonth = (delta: number) => {
    const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
    setMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const [focusTarget, setFocusTarget] = useState<{ day: string } | null>(null)
  // Focus after the target month has rendered, so a move across a month edge lands on a mounted button.
  useEffect(() => { if (focusTarget) popover.current?.querySelector<HTMLButtonElement>(`[data-day="${focusTarget.day}"]`)?.focus() }, [focusTarget])
  const focusDay = (day: string) => { setMonth(day.slice(0, 7)); setFocusTarget({ day }) }
  const weeks = Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7))
  const today = todayLabel()
  const headingId = `${id}-heading`
  // Offset of a day from the start of its week (Sunday in English, Monday in Russian).
  const weekOffset = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + (locale === 'ru' ? 6 : 0)) % 7
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, day: string) => {
    const target = ({
      ArrowLeft: addDays(day, -1), ArrowRight: addDays(day, 1), ArrowUp: addDays(day, -7), ArrowDown: addDays(day, 7),
      Home: addDays(day, -weekOffset(day)), End: addDays(day, 6 - weekOffset(day)),
      PageUp: addMonths(day, event.shiftKey ? -12 : -1), PageDown: addMonths(day, event.shiftKey ? 12 : 1),
    } as Record<string, string>)[event.key]
    if (target) { event.preventDefault(); focusDay(target) }
  }
  return <div className="flight-calendar" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}><label htmlFor={id}>{label}</label><div className="flight-date-input"><input id={id} ref={inputRef} type="text" inputMode="numeric" placeholder={locale === 'ru' ? 'ДД.ММ.ГГГГ' : 'MM/DD/YYYY'} aria-invalid={!!error} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} disabled={disabled} value={valid(value) ? formatDateOnly(locale, value, 'short') : value} onChange={event => onChange(normalize(event.target.value, locale))} onBlur={onBlur} /><button type="button" disabled={disabled} aria-expanded={open} aria-controls={`${id}-calendar`} onClick={() => { if (valid(value)) setMonth(value.slice(0, 7)); setOpen(!open) }}>{locale === 'ru' ? 'Календарь' : 'Calendar'}</button></div><small id={`${id}-hint`}>{locale === 'ru' ? 'ДД.ММ.ГГГГ или ГГГГ-ММ-ДД' : 'MM/DD/YYYY or YYYY-MM-DD'}</small>{error && <p id={`${id}-error`} role="alert">{error}</p>}
    {open && <div id={`${id}-calendar`} ref={popover} className="flight-calendar-popover" role="group" aria-label={locale === 'ru' ? 'Выберите дату' : 'Choose date'} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); document.getElementById(id)?.focus() } }}><div className="flight-calendar-heading"><button type="button" aria-label={locale === 'ru' ? 'Предыдущий месяц' : 'Previous month'} onClick={() => shiftMonth(-1)}><ChevronLeft size={18} strokeWidth={2} aria-hidden="true" /></button><strong id={headingId} aria-live="polite">{formatMonthYear(locale, `${month}-01`)}</strong><button type="button" aria-label={locale === 'ru' ? 'Следующий месяц' : 'Next month'} onClick={() => shiftMonth(1)}><ChevronRight size={18} strokeWidth={2} aria-hidden="true" /></button></div><div role="grid" aria-labelledby={headingId} className="flight-calendar-grid"><div role="row" className="flight-calendar-week">{(locale === 'ru' ? ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map(day => <small role="columnheader" key={day}>{day}</small>)}</div>{weeks.map(week => <div role="row" className="flight-calendar-week" key={week[0]}>{week.map(day => <div role="gridcell" key={day} aria-selected={day === value}><button data-day={day} data-outside={!day.startsWith(month)} type="button" aria-label={formatDateOnly(locale, day, 'long')} aria-current={day === today ? 'date' : undefined} tabIndex={day === (valid(value) && value.startsWith(month) ? value : `${month}-01`) ? 0 : -1} onClick={() => { onChange(day); setOpen(false); document.getElementById(id)?.focus() }} onKeyDown={event => moveFocus(event, day)}>{Number(day.slice(-2))}</button></div>)}</div>)}</div></div>}
  </div>
}
