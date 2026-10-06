'use client'

import { useEffect } from 'react'
import { THEME_COLOR, isAccent, type Accent } from '../lib/theme-colors'

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

/** Same cookie and `data-accent` contract as public/bootstrap.js; unknown names are ignored. */
export function setAccent(accent: Accent) {
  if (!isAccent(accent)) return
  cookie('kuuki_accent', accent)
  document.documentElement.dataset.accent = accent
  window.dispatchEvent(new Event('kuuki:appearance'))
}

/** Reads the stored accent; the removed kincha and sumi are rewritten to terracotta the first time they are seen. */
function normalizeAccent(): Accent | undefined {
  const saved = document.cookie.match(/(?:^|; )kuuki_accent=([^;]+)/)?.[1]
  if (saved === 'kincha' || saved === 'sumi') { setAccent('terracotta'); return 'terracotta' }
  return isAccent(saved) ? saved : undefined
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
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[effective])
}

export function AppearanceProvider() {
  useEffect(() => {
    const selected = currentTheme()
    applyTheme(selected)
    normalizeAccent()
    if (!document.cookie.includes('kuuki_theme=')) cookie('kuuki_theme', selected)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const changed = () => { if (currentTheme() === 'system') applyTheme('system') }
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  return null
}
