'use client'

import { PlaneLanding, Plus } from '@keyline-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { Locale } from '../../../lib/format'
import { useLocale } from '../../preferences'
import { NavigationLink } from '../../navigation-link'
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
  flightHref,
}: {
  controls: ToastControls
  country: Country
  setYear: SetYear
  undo: () => void
  flightHref?: Promise<string | null>
}) {
  const locale = useLocale()
  const [year, setShown] = useState<YearValue>(null)
  const [wheel, setWheel] = useState<'pointer' | 'keyboard' | null>(null)
  const pill = useRef<HTMLButtonElement>(null)
  const [flight, setFlight] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    void flightHref?.then((href) => {
      if (current) setFlight(href)
    })
    return () => {
      current = false
    }
  }, [flightHref])
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
      {flight ? (
        <NavigationLink
          href={flight}
          className="ui-button"
          data-variant="ghost"
          onClick={() => controls.dismiss()}
        >
          <PlaneLanding size={18} aria-hidden="true" />
          {locale === 'ru' ? 'Добавить перелёт' : 'Add flight'}
        </NavigationLink>
      ) : null}
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
