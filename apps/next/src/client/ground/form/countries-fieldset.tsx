'use client'

import { useId, useMemo, useState } from 'react'
import type { Locale } from '../../../lib/format'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Field } from '../../ui/field'
import { countryNamer, searchCountries } from '../../passport/model'

export interface CountriesValue {
  countries: string[]
  noCountries: boolean
}

/** The checklist state after one change. "None of these" and any country exclude each other. */
export function toggleCountry(value: CountriesValue, code: string, on: boolean): CountriesValue {
  const without = value.countries.filter((entry) => entry !== code)
  return { countries: on ? [...without, code] : without, noCountries: false }
}
export function chooseNone(value: CountriesValue, on: boolean): CountriesValue {
  return on ? { countries: [], noCountries: true } : { ...value, noCountries: false }
}
export function addSuggested(value: CountriesValue, suggested: readonly string[]): CountriesValue {
  const next = [...value.countries]
  for (const code of suggested) if (!next.includes(code)) next.push(code)
  return { countries: next, noCountries: false }
}

const MAX_RESULTS = 8

export function CountriesFieldset({
  value,
  onChange,
  routeCodes,
  locale,
  error,
  disabled,
}: {
  value: CountriesValue
  onChange: (value: CountriesValue) => void
  /** Countries of the chosen route places, offered as suggestions; none of them is ticked for the member. */
  routeCodes: readonly string[]
  locale: Locale
  error?: string
  disabled?: boolean
}) {
  const ru = locale === 'ru'
  const id = useId()
  const name = useMemo(() => countryNamer(locale), [locale])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const missing = routeCodes.filter((code) => !value.countries.includes(code))
  const onRoute = routeCodes
  const others = value.countries.filter((code) => !routeCodes.includes(code))
  const results = useMemo(
    () =>
      query.trim() === ''
        ? []
        : searchCountries(query, name)
            .filter((code) => !value.countries.includes(code))
            .slice(0, MAX_RESULTS),
    [query, name, value.countries],
  )
  const row = (code: string) => (
    <li key={code}>
      <Checkbox
        className="gt-country-row"
        label={name(code)}
        checked={value.countries.includes(code)}
        disabled={disabled}
        onChange={(event) => onChange(toggleCountry(value, code, event.target.checked))}
      />
    </li>
  )
  return (
    <fieldset
      className="gt-countries"
      aria-describedby={[`${id}-note`, error ? `${id}-error` : ''].filter(Boolean).join(' ')}
      disabled={disabled}
    >
      <legend>
        {ru ? 'Страны, которые вы действительно пересекли' : 'Countries you actually crossed'}
      </legend>
      <p id={`${id}-note`} className="gt-muted">
        {ru ? 'Транзит без остановки тоже считается.' : 'Transit without stopping counts.'}
      </p>
      {onRoute.length > 0 && (
        <div className="gt-countries-group">
          <div className="gt-countries-head">
            <h3 className="gt-subhead">{ru ? 'На маршруте' : 'On the route'}</h3>
            <Button
              dense
              disabled={missing.length === 0 || disabled}
              onClick={() => {
                onChange(addSuggested(value, routeCodes))
                setStatus(ru ? 'Предложенные страны отмечены' : 'Suggested countries ticked')
              }}
            >
              {ru
                ? `Отметить предложенные (${missing.length})`
                : `Add suggested (${missing.length})`}
            </Button>
          </div>
          <ul className="gt-checklist">{onRoute.map(row)}</ul>
        </div>
      )}
      {others.length > 0 && (
        <div className="gt-countries-group">
          <h3 className="gt-subhead">{ru ? 'Добавлены вручную' : 'Added by you'}</h3>
          <ul className="gt-checklist">{others.map(row)}</ul>
        </div>
      )}
      <div className="gt-countries-group">
        <Field
          type="search"
          label={ru ? 'Добавить другую страну' : 'Add another country'}
          value={query}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          hint={
            ru ? 'Название на любом языке или код страны' : 'Name in any language or country code'
          }
        />
        {results.length > 0 && (
          <ul className="gt-checklist">
            {results.map((code) => (
              <li key={code}>
                <button
                  type="button"
                  className="gt-country-choice"
                  onClick={() => {
                    onChange(toggleCountry(value, code, true))
                    setQuery('')
                    setStatus(ru ? `Добавлено: ${name(code)}` : `${name(code)} added`)
                  }}
                >
                  {name(code)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() !== '' && results.length === 0 && (
          <p className="gt-muted" role="status">
            {ru ? 'Такой страны нет в списке.' : 'No country by that name.'}
          </p>
        )}
      </div>
      <Checkbox
        className="gt-country-row"
        label={ru ? 'Ни одной из них' : 'None of these'}
        description={ru ? 'Граница не пересекалась.' : 'No border was crossed.'}
        checked={value.noCountries}
        disabled={disabled}
        onChange={(event) => onChange(chooseNone(value, event.target.checked))}
      />
      <p className="gt-sr" role="status">
        {status}
      </p>
      {error && (
        <p id={`${id}-error`} className="gt-error-text" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
