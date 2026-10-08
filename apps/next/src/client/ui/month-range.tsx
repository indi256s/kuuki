'use client'

import { useState } from 'react'
import type { Locale } from '../../lib/format'
import { Button } from './button'
import './ui.css'

export type MonthRangeValue = { from: string; to: string }
export type MonthRangeProps = MonthRangeValue & {
  min?: string
  max?: string
  onChange: (value: MonthRangeValue | null) => void
  onClear: () => void
  locale: Locale
}

export function MonthRange({ from, to, min, max, onChange, onClear, locale }: MonthRangeProps) {
  // Only incomplete input is local; complete ranges remain controlled by the caller.
  const [draft, setDraft] = useState<(MonthRangeValue & { sourceFrom: string; sourceTo: string }) | null>(null)
  const valid = (value: string) => !value || (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && (!min || value >= min) && (!max || value <= max))
  const current = draft && draft.sourceFrom === from && draft.sourceTo === to && valid(draft.from) && valid(draft.to) ? draft : { from, to }
  if (draft && current !== draft) setDraft(null)
  const change = (field: keyof MonthRangeValue, value: string) => {
    const next = { from: current.from, to: current.to, [field]: value }
    if (!valid(next.from) || !valid(next.to)) return
    if (next.from && next.to) {
      setDraft(null)
      onChange(next.from > next.to ? { from: next.to, to: next.from } : next)
    } else {
      setDraft({ ...next, sourceFrom: from, sourceTo: to })
      if (!next.from && !next.to) onChange(null)
    }
  }
  return <div className="ui-month-range" lang={locale}>
    <label className="ui-month-range-field">{locale === 'ru' ? 'С' : 'From'}
      <input className="ui-field-input" type="month" value={current.from} min={min} max={max} onChange={event => change('from', event.target.value)} />
    </label>
    <label className="ui-month-range-field">{locale === 'ru' ? 'По' : 'To'}
      <input className="ui-field-input" type="month" value={current.to} min={min} max={max} onChange={event => change('to', event.target.value)} />
    </label>
    <Button onClick={() => { setDraft(null); onChange(null); onClear() }}>{locale === 'ru' ? 'Очистить' : 'Clear'}</Button>
  </div>
}
