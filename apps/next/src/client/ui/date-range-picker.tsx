'use client'

import type { Locale } from '../../lib/format'
import { Calendar } from './calendar'
import { Button } from './button'
import './flight-controls.css'

export type DateRangeValue = { from: string; to: string }

// Arc's paired-calendar/Apply composition uses Kuuki's typed calendar and date-label authority.
export function DateRangePicker({ from, to, onChange, onApply, onClear, locale, error, disabled }: DateRangeValue & {
  onChange: (value: DateRangeValue) => void
  onApply?: () => void
  onClear?: () => void
  locale: Locale
  error?: string
  disabled?: boolean
}) {
  return <fieldset className="ui-date-range" disabled={disabled}>
    <legend>{locale === 'ru' ? 'Диапазон дат' : 'Date range'}</legend>
    <div className="ui-date-range-fields">
      <Calendar label={locale === 'ru' ? 'С даты' : 'From date'} value={from} onChange={from => onChange({ from, to })} locale={locale} disabled={disabled} error={error} />
      <Calendar label={locale === 'ru' ? 'По дату' : 'To date'} value={to} onChange={to => onChange({ from, to })} locale={locale} disabled={disabled} />
    </div>
    {onApply || onClear ? <div className="ui-button-group">
      {onApply ? <Button onClick={onApply} disabled={disabled}>{locale === 'ru' ? 'Применить диапазон' : 'Apply range'}</Button> : null}
      {onClear ? <Button variant="ghost" onClick={onClear} disabled={disabled}>{locale === 'ru' ? 'Очистить диапазон' : 'Clear range'}</Button> : null}
    </div> : null}
  </fieldset>
}
