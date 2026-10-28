'use client'

import type { Locale } from '../../lib/format'
import dynamic from 'next/dynamic'
import { Button } from './button'
import './flight-controls.css'

const Calendar = dynamic(() => import('./calendar').then((module) => module.Calendar), {
  loading: () => (
    <p role="status">
      <span className="locale-en">Loading calendar…</span>
      <span className="locale-ru" lang="ru">
        Загружаем календарь…
      </span>
    </p>
  ),
})

export type DateRangeValue = { from: string; to: string }
export type DateRangePreset = { label: string; from: string; to: string }

// Arc's paired-calendar/Apply composition uses Kuuki's typed calendar and date-label authority.
// Both hosts (Journal period popover, Overview filter panel) scroll themselves, so the grids flow inline instead of floating past the host's edge.
// `presets` (for example whole years) fill the two dates through `onChange` like typing would; committing stays with Apply.
export function DateRangePicker({
  from,
  to,
  onChange,
  onApply,
  onClear,
  locale,
  error,
  disabled,
  presets,
}: DateRangeValue & {
  onChange: (value: DateRangeValue) => void
  presets?: DateRangePreset[]
  onApply?: () => void
  onClear?: () => void
  locale: Locale
  error?: string
  disabled?: boolean
}) {
  return (
    <fieldset className="ui-date-range" disabled={disabled}>
      <legend>{locale === 'ru' ? 'Диапазон дат' : 'Date range'}</legend>
      {presets?.length ? (
        <div
          className="ui-button-group"
          role="group"
          aria-label={locale === 'ru' ? 'Быстрый выбор' : 'Quick ranges'}
        >
          {presets.map((preset) => (
            <Button
              key={preset.label}
              dense
              onClick={() => onChange({ from: preset.from, to: preset.to })}
              disabled={disabled}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="ui-date-range-fields">
        <Calendar
          label={locale === 'ru' ? 'С даты' : 'From date'}
          value={from}
          onChange={(from) => onChange({ from, to })}
          locale={locale}
          disabled={disabled}
          error={error}
          inline
        />
        <Calendar
          label={locale === 'ru' ? 'По дату' : 'To date'}
          value={to}
          onChange={(to) => onChange({ from, to })}
          locale={locale}
          disabled={disabled}
          inline
        />
      </div>
      {onApply || onClear ? (
        <div className="ui-button-group">
          {onApply ? (
            <Button onClick={onApply} disabled={disabled}>
              {locale === 'ru' ? 'Применить диапазон' : 'Apply range'}
            </Button>
          ) : null}
          {onClear ? (
            <Button variant="ghost" onClick={onClear} disabled={disabled}>
              {locale === 'ru' ? 'Очистить диапазон' : 'Clear range'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  )
}
