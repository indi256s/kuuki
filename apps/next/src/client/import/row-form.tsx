'use client'

import clsx from 'clsx'
import { useId } from 'react'
import type { Locale } from '../../lib/format'
import { Field } from '../ui/field'
import { FIELD_ERROR, FIELD_HINT, FIELD_LABEL, S } from './copy'
import { FIELDS, type FieldError, type FieldName, type FieldValues } from './review-model'

const CODES: FieldName[] = ['origin', 'destination', 'airline_iata', 'aircraft_icao']
const OPTIONAL: FieldName[] = ['airline_iata', 'flight_number', 'aircraft_icao', 'departure_time', 'arrival_time']

/** The one field set for draft edits and manual rows, so both share the same labels, hints and validation messages. */
export function RowForm({ locale, values, onChange, errors, low = [], disabled, year, idPrefix }: {
  locale: Locale
  values: FieldValues
  onChange: (next: FieldValues) => void
  errors: Partial<Record<FieldName, FieldError>>
  /** Fields the source was unsure about: marked with a dot, a tint and a text reason, never colour alone. */
  low?: FieldName[]
  disabled?: boolean
  /** Present when the document showed no year: the date needs the member's explicit decision. */
  year?: { missing: boolean; checked: boolean; onChange: (checked: boolean) => void }
  idPrefix: string
}) {
  const yearId = useId()
  const optional = locale === 'ru' ? 'необязательно' : 'optional'
  return <div className="import-form">
    {FIELDS.map(name => {
      const unsure = low.includes(name)
      const hint = [FIELD_HINT[name]?.[locale], unsure ? S.fieldUnsure[locale] + '. ' + (locale === 'ru' ? 'Проверьте значение.' : 'Check this value.') : null].filter(Boolean).join(' ')
      return <div key={name} className={clsx('import-form-field', unsure && 'is-unsure')} data-field={name}>
        <Field id={`${idPrefix}-${name}`} label={FIELD_LABEL[name][locale]} optionalLabel={OPTIONAL.includes(name) ? ` · ${optional}` : undefined}
          type={name === 'date' ? 'date' : 'text'} value={values[name]} disabled={disabled} hint={hint || undefined}
          autoCapitalize={CODES.includes(name) ? 'characters' : 'off'} autoComplete="off" spellCheck={false}
          error={errors[name] ? FIELD_ERROR[errors[name]!][locale] : undefined}
          onChange={event => onChange({ ...values, [name]: CODES.includes(name) ? event.target.value.toUpperCase() : event.target.value })} />
        {name === 'date' && year ? <div className="import-year">
          <p className="import-hint">{year.missing ? S.yearMissing[locale] : S.yearUnconfirmed[locale]}</p>
          <label className="import-check" htmlFor={yearId}>
            <input id={yearId} type="checkbox" checked={year.checked} disabled={disabled || !values.date} onChange={event => year.onChange(event.target.checked)} />
            <span>{S.yearConfirm[locale]}</span>
          </label>
        </div> : null}
      </div>
    })}
  </div>
}
