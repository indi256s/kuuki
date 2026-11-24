'use client'

import { useSyncExternalStore } from 'react'

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

export function useLocale(initialLocale: 'en' | 'ru' = 'en') {
  return useSyncExternalStore(
    subscribe,
    () => localeSnapshot(initialLocale),
    () => initialLocale,
  )
}

export function useAppearance(initialLocale: 'en' | 'ru' = 'en') {
  const locale = useLocale(initialLocale)
  const theme = useSyncExternalStore(subscribe, themeSnapshot, () => 'system' as const)
  return { locale, theme }
}
