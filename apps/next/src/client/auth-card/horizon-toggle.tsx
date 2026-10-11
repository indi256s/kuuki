'use client'

import { useSyncExternalStore } from 'react'
import { Minus, Sun } from '@keyline-icons/react'
import { setTheme } from '../appearance'
import type { Locale } from '../../lib/format'
import './auth-card.css'

/** The theme in effect (`html[data-theme]`), so a device that flips while the preference is `system` is followed too. */
function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}
const isDark = () => document.documentElement.dataset.theme === 'dark'

/**
 * The card's theme control: a pressed button showing the theme in effect. A click sets the opposite theme explicitly;
 * until then the stored preference stays `system`. The name is constant, and `aria-pressed` carries the state.
 */
export function HorizonToggle({ locale }: { locale: Locale }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false)
  const label = locale === 'ru' ? 'Тёмная тема' : 'Dark theme'
  return (
    <button
      type="button"
      className="auth-corner-control auth-horizon"
      aria-label={label}
      title={label}
      aria-pressed={dark}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      <span className="auth-horizon-icon" aria-hidden="true">
        <span className="auth-horizon-sky">
          <Sun size={16} className="auth-horizon-sun" />
        </span>
        <Minus size={16} className="auth-horizon-line" />
      </span>
    </button>
  )
}
