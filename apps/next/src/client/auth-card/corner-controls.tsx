'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Droplet, Pause, Play } from '@keyline-icons/react'
import { deviceAccent, rememberSignedOutPick, setAccent } from '../appearance'
import { useLocale } from '../preferences'
import { Menu, MenuTray } from '../ui/menu'
import { NAMES } from '../ui/swatch-picker'
import { ACCENTS, type Accent } from '../../lib/theme-colors'
import type { Locale } from '../../lib/format'
import { HorizonToggle } from './horizon-toggle'
import { LanguageControl } from './language-control'
import './auth-card.css'

const words = {
  en: { pause: 'Pause animation', accent: 'Accent' },
  ru: { pause: 'Приостановить анимацию', accent: 'Акцент' },
}

function AccentControl({ locale }: { locale: Locale }) {
  const [accent, setLocalAccent] = useState<Accent>('shu')
  useEffect(() => {
    const read = () => setLocalAccent(deviceAccent())
    read()
    window.addEventListener('kuuki:appearance', read)
    return () => window.removeEventListener('kuuki:appearance', read)
  }, [])
  const label = words[locale].accent
  return (
    <Menu
      align="end"
      className="auth-accent-menu"
      trigger={
        <button
          type="button"
          className="auth-corner-control"
          data-kind="accent"
          aria-label={`${label}: ${NAMES[accent][locale]}`}
          title={label}
        >
          <Droplet size={16} aria-hidden="true" />
        </button>
      }
    >
      <MenuTray
        label={label}
        hideLabel
        value={accent}
        onValueChange={(next) => {
          setLocalAccent(next)
          setAccent(next)
          rememberSignedOutPick(next)
        }}
        options={ACCENTS.map((item) => ({
          value: item,
          label: NAMES[item][locale],
          swatch: `var(--swatch-${item})`,
          swatchInk: `var(--swatch-${item}-ink)`,
        }))}
      />
    </Menu>
  )
}

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
      <AccentControl locale={locale} />
      {theme ?? <HorizonToggle locale={locale} />}
    </div>
  )
}
