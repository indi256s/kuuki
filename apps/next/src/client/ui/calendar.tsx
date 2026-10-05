'use client'
import { useId, useRef, useState, type Ref } from 'react'
import { addDays } from '../../../../../packages/shared/src/calendar'
import { formatDateOnly, formatMonthYear, type Locale } from '../../lib/format'
import './flight-controls.css'

function normalize(text: string, locale: Locale) {
  const match = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(text)
  return match ? `${match[3]}-${locale === 'ru' ? match[2] : match[1]}-${locale === 'ru' ? match[1] : match[2]}` : text
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
  const focusDay = (day: string) => {
    setMonth(day.slice(0, 7))
    requestAnimationFrame(() => popover.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus())
  }
  return <div className="flight-calendar" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}><label htmlFor={id}>{label}</label><div className="flight-date-input"><input id={id} ref={inputRef} type="text" inputMode="numeric" placeholder={locale === 'ru' ? 'ДД.ММ.ГГГГ' : 'MM/DD/YYYY'} aria-invalid={!!error} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} disabled={disabled} value={valid(value) ? formatDateOnly(locale, value, 'short') : value} onChange={event => onChange(normalize(event.target.value, locale))} onBlur={onBlur} /><button type="button" disabled={disabled} aria-expanded={open} aria-controls={`${id}-calendar`} onClick={() => { if (valid(value)) setMonth(value.slice(0, 7)); setOpen(!open) }}>{locale === 'ru' ? 'Календарь' : 'Calendar'}</button></div><small id={`${id}-hint`}>{locale === 'ru' ? 'ДД.ММ.ГГГГ или ГГГГ-ММ-ДД' : 'MM/DD/YYYY or YYYY-MM-DD'}</small>{error && <p id={`${id}-error`} role="alert">{error}</p>}
    {open && <div id={`${id}-calendar`} ref={popover} className="flight-calendar-popover" role="group" aria-label={locale === 'ru' ? 'Выберите дату' : 'Choose date'} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false) } }}><div className="flight-calendar-heading"><button type="button" aria-label={locale === 'ru' ? 'Предыдущий месяц' : 'Previous month'} onClick={() => shiftMonth(-1)}>←</button><strong>{formatMonthYear(locale, `${month}-01`)}</strong><button type="button" aria-label={locale === 'ru' ? 'Следующий месяц' : 'Next month'} onClick={() => shiftMonth(1)}>→</button></div><div className="flight-calendar-grid">{(locale === 'ru' ? ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map(day => <small key={day}>{day}</small>)}{days.map(day => <button key={day} data-day={day} data-outside={!day.startsWith(month)} type="button" aria-label={formatDateOnly(locale, day, 'long')} aria-pressed={day === value} tabIndex={day === (valid(value) && value.startsWith(month) ? value : `${month}-01`) ? 0 : -1} onClick={() => { onChange(day); setOpen(false); document.getElementById(id)?.focus() }} onKeyDown={event => { const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]; if (offset) { event.preventDefault(); focusDay(addDays(day, offset)) } }}>{Number(day.slice(-2))}</button>)}</div></div>}
  </div>
}
