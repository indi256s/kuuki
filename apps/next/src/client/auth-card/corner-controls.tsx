'use client'

import { useState, type ReactNode } from 'react'
import { CircleQuestion as CircleHelp, Globe, Pause, Play } from '@keyline-icons/react'
import { setLocale } from '../appearance'
import { useAppearance } from '../preferences'
import { Dialog } from '../ui/dialog'
import type { Locale } from '../../lib/format'
import { HorizonToggle } from './horizon-toggle'
import './auth-card.css'

const words = {
  en: {
    language: 'Language',
    help: 'Help',
    pause: 'Pause animation',
    close: 'Close',
    about: 'About Kuuki',
    body: [
      'Kuuki is a private flight journal.',
      'Sign in with your email and password, or use a new email to start your journal. Your flights stay private until you share them.',
      'Need another link? Return to sign in and choose “Can’t sign in?”.',
    ],
  },
  ru: {
    language: 'Язык',
    help: 'Помощь',
    pause: 'Приостановить анимацию',
    close: 'Закрыть',
    about: 'О Kuuki',
    body: [
      'Kuuki — личный журнал перелётов.',
      'Войдите с почтой и паролем или укажите новую почту, чтобы начать журнал. Перелёты видны только вам, пока вы ими не поделитесь.',
      'Нужна новая ссылка? Вернитесь ко входу и выберите «Не получается войти?».',
    ],
  },
}

function LanguageControl({
  locale,
  onLocaleChange = setLocale,
}: {
  locale: Locale
  onLocaleChange?: (locale: Locale) => void
}) {
  const current = useAppearance(locale).locale
  return (
    <span className="auth-corner-control" data-kind="language">
      <Globe size={16} strokeWidth={1.75} aria-hidden="true" />
      <span aria-hidden="true">{current.toUpperCase()}</span>
      <select
        aria-label={words[locale].language}
        value={current}
        onChange={(event) => onLocaleChange(event.target.value as Locale)}
      >
        <option value="en">EN</option>
        <option value="ru">RU</option>
      </select>
    </span>
  )
}

function HelpControl({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false)
  const t = words[locale]
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t.about}
      closeLabel={t.close}
      trigger={
        <button type="button" className="auth-corner-control" aria-label={t.help}>
          <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      }
    >
      {t.body.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </Dialog>
  )
}

/**
 * Language, theme and help in the card corner (top right of the form panel on desktop, the band header on mobile).
 * Each control is at least 44×44. `theme` swaps the theme control; the default is the `HorizonToggle`.
 */
export function CornerControls({
  locale,
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
      <HelpControl locale={locale} />
    </div>
  )
}
