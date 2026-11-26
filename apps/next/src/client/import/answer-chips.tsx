'use client'

import { useEffect, useRef, useState } from 'react'
import { findAirportLabel } from '@kuuki/data/airport-labels'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { S } from './copy'

export function OtherYear({
  locale,
  max,
  disabled,
  onApply,
}: {
  locale: Locale
  max: number
  disabled: boolean
  onApply: (year: number) => boolean
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])
  if (!open)
    return (
      <Button disabled={disabled} aria-expanded={false} onClick={() => setOpen(true)}>
        {S.yearOther[locale]}
      </Button>
    )
  const submit = () => {
    const year = Number(value)
    if (!/^\d{4}$/.test(value) || year < 1950 || year > max) {
      setError(S.yearInvalid[locale].replace('{max}', String(max)))
      return
    }
    if (!onApply(year)) setError(S.yearNoSuchDay[locale].replace('{year}', String(year)))
  }
  return (
    <form
      className="import-question-year"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Field
        ref={input}
        label={S.yearLabel[locale]}
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={value}
        error={error}
        onChange={(event) => {
          setValue(event.target.value.trim())
          setError('')
        }}
        disabled={disabled}
      />
      <Button type="submit" disabled={disabled}>
        {S.yearApply[locale]}
      </Button>
    </form>
  )
}

export function YearChoices({
  locale,
  years,
  today,
  disabled,
  dense,
  onAnswer,
}: {
  locale: Locale
  years: readonly number[]
  today: string
  disabled: boolean
  dense?: boolean
  onAnswer: (year: number, typed: boolean) => boolean
}) {
  return (
    <div className="leg-chip-row">
      {years.map((year) => (
        <Button key={year} dense={dense} disabled={disabled} onClick={() => onAnswer(year, false)}>
          <span className="import-code">{year}</span>
        </Button>
      ))}
      <OtherYear
        locale={locale}
        max={Number(today.slice(0, 4)) + 1}
        disabled={disabled}
        onApply={(year) => onAnswer(year, true)}
      />
    </div>
  )
}

export function AirportChoices({
  options,
  disabled,
  dense,
  onPick,
}: {
  options: readonly string[]
  disabled: boolean
  dense?: boolean
  onPick: (code: string) => void
}) {
  return (
    <div className="leg-chip-row">
      {options.map((code) => {
        const name = findAirportLabel(code)?.name
        return (
          <Button
            key={code}
            dense={dense}
            disabled={disabled}
            aria-label={`${code}, ${name ?? code}`}
            onClick={() => onPick(code)}
          >
            <span className="leg-chip-code">{code}</span>
            <span className="leg-chip-name">{name ?? ''}</span>
          </Button>
        )
      })}
    </div>
  )
}
