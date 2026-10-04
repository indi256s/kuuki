'use client'

import { useEffect } from 'react'

type Theme = 'light' | 'dark' | 'system'
type Locale = 'en' | 'ru'
const year = 365 * 24 * 60 * 60

function cookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${year}; SameSite=Lax`
}

export function setLocale(locale: Locale) {
  cookie('kuuki_locale', locale)
  try { localStorage.setItem('kuuki-language', locale) } catch { /* storage unavailable */ }
  document.documentElement.lang = locale
  window.location.reload()
}

export function setTheme(theme: Theme) {
  cookie('kuuki_theme', theme)
  try { localStorage.setItem('kuuki-theme-mode', theme) } catch { /* storage unavailable */ }
  applyTheme(theme)
  window.dispatchEvent(new Event('kuuki:appearance'))
}

function currentTheme(): Theme {
  let legacy: string | null = null
  try { legacy = localStorage.getItem('kuuki-theme-mode') } catch { /* storage unavailable */ }
  if (legacy === 'light' || legacy === 'dark' || legacy === 'system') return legacy
  const saved = document.cookie.match(/(?:^|; )kuuki_theme=([^;]+)/)?.[1]
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}

function applyTheme(theme: Theme) {
  const effective = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
  document.documentElement.dataset.theme = effective
  document.documentElement.style.colorScheme = effective
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effective === 'dark' ? '#292827' : '#fbfaf8')
}

export function AppearanceProvider() {
  useEffect(() => {
    const selected = currentTheme()
    applyTheme(selected)
    if (!document.cookie.includes('kuuki_theme=')) cookie('kuuki_theme', selected)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const changed = () => { if (currentTheme() === 'system') applyTheme('system') }
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  return null
}
