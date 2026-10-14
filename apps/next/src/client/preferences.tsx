'use client'

import { useSyncExternalStore } from 'react'
import { setLocale, setTheme } from './appearance'

function subscribe(listener: () => void) {
  window.addEventListener('kuuki:appearance', listener)
  return () => window.removeEventListener('kuuki:appearance', listener)
}

function localeSnapshot(fallback: 'en' | 'ru'): 'en' | 'ru' {
  const locale = document.documentElement.lang
  return locale === 'en' || locale === 'ru' ? locale : fallback
}

function themeSnapshot(): 'system' | 'light' | 'dark' {
  const selected = document.cookie
    .split('; ')
    .find((part) => part.startsWith('kuuki_theme='))
    ?.slice('kuuki_theme='.length)
  return selected === 'light' || selected === 'dark' ? selected : 'system'
}

/** Live locale only, so components that never show the theme don't re-render during a theme switch. */
export function useLocale(initialLocale: 'en' | 'ru' = 'en') {
  return useSyncExternalStore(
    subscribe,
    () => localeSnapshot(initialLocale),
    () => initialLocale,
  )
}

/** Live locale and theme selection; the same cookie/attribute sources the first-paint bootstrap writes. */
export function useAppearance(initialLocale: 'en' | 'ru' = 'en') {
  const locale = useLocale(initialLocale)
  const theme = useSyncExternalStore(subscribe, themeSnapshot, () => 'system' as const)
  return { locale, theme }
}

export function Preferences({ initialLocale = 'en' }: { initialLocale?: 'en' | 'ru' }) {
  const { locale, theme } = useAppearance(initialLocale)
  return (
    <div className="preferences">
      <label>
        <span className="sr-only">{locale === 'ru' ? 'Язык' : 'Language'}</span>
        <select value={locale} onChange={(event) => setLocale(event.target.value as 'en' | 'ru')}>
          <option value="en">EN</option>
          <option value="ru">RU</option>
        </select>
      </label>
      <label>
        <span className="sr-only">{locale === 'ru' ? 'Тема' : 'Theme'}</span>
        <select
          value={theme}
          onChange={(event) => setTheme(event.target.value as 'system' | 'light' | 'dark')}
        >
          <option value="system">{locale === 'ru' ? 'Система' : 'System'}</option>
          <option value="light">{locale === 'ru' ? 'Светлая' : 'Light'}</option>
          <option value="dark">{locale === 'ru' ? 'Тёмная' : 'Dark'}</option>
        </select>
      </label>
    </div>
  )
}
