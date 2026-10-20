'use client'

import { useLocale } from '../preferences'

import type { ReactNode } from 'react'
import { Pause, Play } from '@keyline-icons/react'
import { setLocale } from '../appearance'
import { useAppearance } from '../preferences'
import type { Locale } from '../../lib/format'
import { HorizonToggle } from './horizon-toggle'
import './auth-card.css'

const words = {
  en: { pause: 'Pause animation' },
  ru: { pause: 'Приостановить анимацию' },
}

/** Each language names itself, so the switch reads the same to someone who cannot read the current page. */
const endonyms: Record<Locale, string> = { en: 'English', ru: 'Русский' }

/**
 * Two languages need no picker: the button names the other one in its own language and switches to it in one tap.
 * The page itself shows the current language. Both names share one grid cell, so the button keeps the wider name's
 * width and its neighbours stay put when the label swaps.
 */
function LanguageControl({
  locale,
  onLocaleChange = setLocale,
}: {
  locale: Locale
  onLocaleChange?: (locale: Locale) => void
}) {
  const other: Locale = useAppearance(locale).locale === 'ru' ? 'en' : 'ru'
  return (
    <button
      type="button"
      className="auth-corner-control"
      data-kind="language"
      lang={other}
      onClick={() => onLocaleChange(other)}
    >
      {(Object.keys(endonyms) as Locale[]).map((name) => (
        <span key={name} lang={name} aria-hidden={name !== other || undefined}>
          {endonyms[name]}
        </span>
      ))}
    </button>
  )
}

/**
 * Animation pause, language and theme in the card corner (top right of the form panel on desktop, the band header on mobile).
 * Each control is at least 44×44. `theme` swaps the theme control; the default is the `HorizonToggle`.
 */
export function CornerControls({
  locale: initialLocale,
  theme,
  onLocaleChange,
  motionPaused,
  onMotionPauseChange,
}: {
  locale: Locale
  theme?: ReactNode
  onLocaleChange?: (locale: Locale) => void
  motionPaused?: boolean
  onMotionPauseChange?: (paused: boolean) => void
}) {
  const locale = useLocale(initialLocale)
  return (
    <div className="auth-corner">
      {motionPaused !== undefined ? (
        <button
          type="button"
          className="auth-corner-control"
          aria-label={words[locale].pause}
          title={words[locale].pause}
          aria-pressed={motionPaused}
          onClick={() => onMotionPauseChange?.(!motionPaused)}
        >
          {motionPaused ? (
            <Play size={16} aria-hidden="true" />
          ) : (
            <Pause size={16} aria-hidden="true" />
          )}
        </button>
      ) : null}
      <LanguageControl locale={locale} onLocaleChange={onLocaleChange} />
      {theme ?? <HorizonToggle locale={locale} />}
    </div>
  )
}
