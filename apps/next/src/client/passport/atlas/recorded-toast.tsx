'use client'
// The recorded toast's own controls (quick-visit.ts): the visit's year and Undo, under "Poland is in your passport."
// The year pill opens a five-row wheel inside the toast, which grows to hold it; while open the pill reads Done.

import { Plus } from '@keyline-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { Locale } from '../../../lib/format'
import { useLocale } from '../../preferences'
import type { ToastControls } from '../../ui/toast'
import { YEAR_NAME, YearDrum, yearLabel, type YearDrumResult, type YearValue } from '../year-drum'
import type { SetYear } from './quick-visit'
import './recorded-toast.css'

type Country = Record<Locale, string>

const COPY = {
  year: { en: 'Year', ru: 'Год' },
  done: { en: 'Done', ru: 'Готово' },
  undo: { en: 'Undo', ru: 'Отменить' },
} as const

export const recordedMessage = (country: Country) => ({
  en: `${country.en} is in your passport.`,
  ru: `${country.ru} в паспорте.`,
})
const pickingMessage = (country: Country) => ({
  en: `${country.en} · year of visit`,
  ru: `${country.ru} · год визита`,
})

export function RecordedToast({
  controls,
  country,
  setYear,
  undo,
}: {
  controls: ToastControls
  country: Country
  setYear: SetYear
  undo: () => void
}) {
  const locale = useLocale()
  const [year, setShown] = useState<YearValue>(null)
  /** How the wheel was opened (the keyboard skips its entrance), or null while closed. */
  const [wheel, setWheel] = useState<'pointer' | 'keyboard' | null>(null)
  const pill = useRef<HTMLButtonElement>(null)
  // The toast waits while the wheel is open, and lets go if it unmounts open. The toast keeps `controls` stable.
  useEffect(() => {
    controls.hold(wheel !== null)
    return () => controls.hold(false)
  }, [controls, wheel])

  function open(how: 'pointer' | 'keyboard') {
    setWheel(how)
    controls.update({ message: pickingMessage(country) })
  }
  function close(result: YearDrumResult) {
    setWheel(null)
    setShown(result.year)
    controls.update({ message: recordedMessage(country) })
    if (result.changed) setYear(result.year)
    if (result.refocus) pill.current?.focus({ preventScroll: true })
  }

  const set = year !== null
  return (
    <div className="recorded-toast">
      <div className="recorded-toast-actions">
        <button
          ref={pill}
          type="button"
          className="recorded-toast-year"
          data-set={set || undefined}
          data-open={wheel ? '' : undefined}
          aria-expanded={wheel !== null}
          aria-label={
            wheel ? COPY.done[locale] : `${YEAR_NAME[locale]}: ${yearLabel(year, locale)}`
          }
          onClick={(event) => {
            if (!wheel) open(event.detail === 0 ? 'keyboard' : 'pointer')
          }}
        >
          {wheel ? (
            COPY.done[locale]
          ) : set ? (
            year
          ) : (
            <>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              {COPY.year[locale]}
            </>
          )}
        </button>
        <button
          type="button"
          className="ui-button recorded-toast-undo"
          data-variant="ghost"
          data-dense="true"
          onClick={undo}
        >
          <span>{COPY.undo[locale]}</span>
        </button>
      </div>
      {wheel ? (
        <YearDrum
          size="wheel"
          value={year}
          locale={locale}
          instant={wheel === 'keyboard'}
          trigger={() => pill.current}
          onClose={close}
        />
      ) : null}
    </div>
  )
}
