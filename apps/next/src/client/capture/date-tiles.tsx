'use client'
import { useId, useState, type Ref } from 'react'
import { Calendar } from '../ui/calendar'
import type { Locale } from '../../lib/format'

/** The device's local calendar day, `offset` days from now, as YYYY-MM-DD. */
export function localDay(offset = 0, now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

/** "Sun 11 Oct" / «вс 11 окт», plus the year, from Intl parts so the order does not follow en-US. */
export function dayParts(locale: Locale, day: string) {
  const parts = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${day}T00:00:00Z`))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((item) => item.type === type)?.value ?? '').replace(/\.$/, '')
  return {
    weekday: part('weekday'),
    day: part('day'),
    month: part('month'),
    year: part('year'),
  }
}
const short = (locale: Locale, day: string) => {
  const { weekday, day: date, month } = dayParts(locale, day)
  return `${weekday} ${date} ${month}`
}
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

type Choice = 'today' | 'yesterday' | 'other'

/**
 * Departure date as three native radios: Today, Yesterday, Other. Nothing is checked until the member picks; a relative
 * tile is checked only while its date equals the stored value, so a restored entry keeps its exact day under Other.
 */
export function DateTiles({
  value,
  onChange,
  onBlur,
  inputRef,
  locale,
  error,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  inputRef?: Ref<HTMLInputElement>
  locale: Locale
  error?: string
  disabled?: boolean
}) {
  const id = useId()
  const ru = locale === 'ru'
  const today = localDay(0)
  const yesterday = localDay(-1)
  // Other picked before a day is chosen. Picking it also opens the month grid.
  const [pickedOther, setPickedOther] = useState(false)
  const choice: Choice | null =
    value === today
      ? 'today'
      : value === yesterday
        ? 'yesterday'
        : value || pickedOther
          ? 'other'
          : null
  const otherDay = choice === 'other' && validDay(value) ? dayParts(locale, value) : null
  const tiles: { key: Choice; title: string; date: string }[] = [
    {
      key: 'today',
      title: ru ? 'Сегодня' : 'Today',
      date: short(locale, today),
    },
    {
      key: 'yesterday',
      title: ru ? 'Вчера' : 'Yesterday',
      date: short(locale, yesterday),
    },
    otherDay
      ? {
          key: 'other',
          title: `${otherDay.day} ${otherDay.month}`,
          date: `${otherDay.weekday} ${otherDay.year}`,
        }
      : {
          key: 'other',
          title: ru ? 'Другая' : 'Other',
          date: ru ? 'календарь' : 'calendar',
        },
  ]
  const pick = (key: Choice) => {
    if (key === 'other') {
      setPickedOther(true)
      // Leaving a relative day for Other starts the calendar empty rather than on that day.
      if (value === today || value === yesterday) onChange('')
      return
    }
    setPickedOther(false)
    onChange(key === 'today' ? today : yesterday)
  }
  const errorId = `${id}-error`
  const showCalendar = choice === 'other'
  return (
    <fieldset className="date-tiles" disabled={disabled}>
      <legend>{ru ? 'Дата вылета' : 'Departure date'}</legend>
      <div className="date-tiles-track">
        {tiles.map((tile, index) => (
          <label className="date-tile" key={tile.key}>
            <input
              type="radio"
              name={`${id}-date`}
              value={tile.key}
              required
              checked={choice === tile.key}
              ref={!showCalendar && index === 0 ? inputRef : undefined}
              aria-describedby={error && !showCalendar ? errorId : undefined}
              onChange={() => pick(tile.key)}
              onBlur={onBlur}
            />
            <span className="date-tile-title">{tile.title}</span>{' '}
            <span className="date-tile-date">{tile.date}</span>
          </label>
        ))}
      </div>
      {showCalendar ? (
        <Calendar
          label={ru ? 'Другая дата' : 'Other date'}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          inputRef={inputRef}
          locale={locale}
          error={error}
          disabled={disabled}
          defaultOpen={pickedOther}
          inline
        />
      ) : (
        error && (
          <p id={errorId} role="alert">
            {error}
          </p>
        )
      )}
    </fieldset>
  )
}
