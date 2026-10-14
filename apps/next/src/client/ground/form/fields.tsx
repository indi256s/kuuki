'use client'

import { useId, type KeyboardEvent, type TextareaHTMLAttributes } from 'react'
import type { Locale } from '../../../lib/format'
import { Field } from '../../ui/field'
import type { ErrorCode } from './model'

/** Enter in a helper input (country search, ticket preview) must not submit the whole journey form. */
export function blockImplicitSubmit(event: KeyboardEvent<HTMLElement>) {
  if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault()
}

export function errorText(code: ErrorCode | undefined, locale: Locale): string | undefined {
  if (!code) return undefined
  const ru = locale === 'ru'
  switch (code) {
    case 'required':
      return ru ? 'Выберите место из списка.' : 'Choose a place from the list.'
    case 'date':
      return ru ? 'Дата в формате ГГГГ-ММ-ДД.' : 'Use a valid date.'
    case 'time':
      return ru ? 'Время в формате ЧЧ:ММ.' : 'Use a valid time, HH:MM.'
    case 'date-order':
      return ru ? 'Эта дата раньше предыдущей.' : 'This date is before the one it follows.'
    case 'too-long':
      return ru ? 'Слишком длинный текст.' : 'This is too long.'
    case 'duration':
      return ru ? 'Целое число минут, от 1 до 20 160.' : 'Whole minutes, 1 to 20,160.'
    case 'nights':
      return ru ? 'Целое число от 0 до 3650.' : 'A whole number, 0 to 3650.'
    case 'too-many':
      return ru ? 'Слишком много пунктов (не более 100).' : 'Too many entries (at most 100).'
    case 'too-few':
      return ru ? 'Добавьте ещё пункты маршрута.' : 'Add more route entries.'
    case 'countries':
      return ru
        ? 'Выберите пересечённые страны или «Ни одной из них».'
        : 'Choose the countries you crossed, or “None of these”.'
  }
}

/** A native date input. An empty value is stated as "Date unknown": the journey is saved without a date. */
export function DateField({
  label,
  value,
  onChange,
  locale,
  error,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  locale: Locale
  error?: string
  disabled?: boolean
}) {
  return (
    <Field
      type="date"
      label={label}
      optionalLabel={locale === 'ru' ? 'необязательно' : 'optional'}
      hint={value === '' ? (locale === 'ru' ? 'Дата неизвестна' : 'Date unknown') : undefined}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      error={error}
    />
  )
}

export function TimeField({
  label,
  value,
  onChange,
  locale,
  error,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  locale: Locale
  error?: string
  disabled?: boolean
}) {
  return (
    <Field
      type="time"
      label={label}
      optionalLabel={locale === 'ru' ? 'необязательно' : 'optional'}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      error={error}
    />
  )
}

/** `Field` has no multi-line variant; this mirrors its label, hint and error wiring. */
export function TextAreaField({
  label,
  optionalLabel,
  error,
  className,
  ...textarea
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'aria-invalid'> & {
  label: string
  optionalLabel?: string
  error?: string
}) {
  const id = useId()
  return (
    <div className={`ui-field${className ? ` ${className}` : ''}`}>
      <label className="ui-field-label" htmlFor={id}>
        {label}
        {optionalLabel ? <span className="ui-field-optional">{optionalLabel}</span> : null}
      </label>
      <textarea
        {...textarea}
        id={id}
        className="ui-field-input gt-textarea"
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <p id={`${id}-error`} className="ui-field-error" role={error ? 'alert' : undefined}>
        {error ?? null}
      </p>
    </div>
  )
}
