'use client'

import { SunMoon } from 'lucide-react'
import { setTheme } from '../appearance'
import { useAppearance } from '../preferences'
import type { Locale } from '../../lib/format'
import './auth-card.css'

/**
 * Temporary theme control for the card corner: the existing System / Light / Dark choice as a native select over a
 * 44×44 icon. The Horizon toggle (auth one-form ticket 07) replaces this component.
 */
export function ThemeControl({ locale }: { locale: Locale }) {
  const { theme } = useAppearance(locale)
  const ru = locale === 'ru'
  return <span className="auth-corner-control">
    <SunMoon size={16} strokeWidth={1.75} aria-hidden="true" />
    <select aria-label={ru ? 'Тема' : 'Theme'} value={theme} onChange={event => setTheme(event.target.value as 'system' | 'light' | 'dark')}>
      <option value="system">{ru ? 'Система' : 'System'}</option>
      <option value="light">{ru ? 'Светлая' : 'Light'}</option>
      <option value="dark">{ru ? 'Тёмная' : 'Dark'}</option>
    </select>
  </span>
}
