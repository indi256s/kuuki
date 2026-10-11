'use client'

import { useEffect } from 'react'
import { THEME_COLOR, isAccent, type Accent } from '../lib/theme-colors'

type Theme = 'light' | 'dark' | 'system'
type Locale = 'en' | 'ru'
const year = 365 * 24 * 60 * 60

function cookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${year}; SameSite=Lax`
}

export function setLocale(locale: Locale, reload = true) {
  cookie('kuuki_locale', locale)
  try {
    localStorage.setItem('kuuki-language', locale)
  } catch {
    /* storage unavailable */
  }
  document.documentElement.lang = locale
  document.documentElement.dataset.locale = locale
  if (reload) window.location.reload()
  else window.dispatchEvent(new Event('kuuki:appearance'))
}

export function setTheme(theme: Theme) {
  cookie('kuuki_theme', theme)
  try {
    localStorage.setItem('kuuki-theme-mode', theme)
  } catch {
    /* storage unavailable */
  }
  switchTheme(theme)
  window.dispatchEvent(new Event('kuuki:appearance'))
}

let switchToken = 0

/** Controls skip color transitions while the new theme snapshot crossfades; the Horizon sun keeps moving. */
function switchTheme(theme: Theme) {
  const root = document.documentElement
  const effective = resolveTheme(theme)
  // Dark to System on a dark device changes only the stored choice; a fade would announce a change that isn't there.
  if (root.dataset.theme === effective && root.dataset.themeSwitching === undefined) return
  const token = ++switchToken
  const direction = effective === 'dark' ? 'dusk' : 'dawn'
  root.dataset.themeSwitching = direction
  // A quick second toggle skips the first transition; only the latest switch clears the attribute and settles the bar.
  const done = () => {
    if (token !== switchToken) return
    setBrowserBar(effective)
    delete root.dataset.themeSwitching
    delete root.dataset.themePainting
  }
  if (
    typeof document.startViewTransition !== 'function' ||
    root.dataset.routeTransition !== undefined
  ) {
    root.dataset.themePainting = ''
    applyTheme(theme)
    requestAnimationFrame(() => requestAnimationFrame(done))
    return
  }
  const transition = document.startViewTransition(() => {
    // A skipped switch still paints its theme; the next switch captures that page, so the bar follows it.
    root.dataset.themePainting = ''
    paintTheme(effective)
    setBrowserBar(effective)
  })
  // `ready` rejects with "Transition was skipped" when a later switch or a hidden tab skips this one; that is expected, not an error.
  transition.ready.catch(() => {})
  transition.finished.finally(done)
}

/** Same cookie and `data-accent` contract as public/bootstrap.js; unknown names are ignored. */
export function setAccent(accent: Accent) {
  if (!isAccent(accent)) return
  cookie('kuuki_accent', accent)
  document.documentElement.dataset.accent = accent
  window.dispatchEvent(new Event('kuuki:appearance'))
}

/** Reads the stored accent; removed names are rewritten to shu the first time they are seen. */
function normalizeAccent(): Accent | undefined {
  const saved = document.cookie.match(/(?:^|; )kuuki_accent=([^;]+)/)?.[1]
  if (['terracotta', 'kincha', 'sumi', 'yellow'].includes(saved ?? '')) {
    setAccent('shu')
    return 'shu'
  }
  return isAccent(saved) ? saved : undefined
}

function currentTheme(): Theme {
  let legacy: string | null = null
  try {
    legacy = localStorage.getItem('kuuki-theme-mode')
  } catch {
    /* storage unavailable */
  }
  if (legacy === 'light' || legacy === 'dark' || legacy === 'system') return legacy
  const saved = document.cookie.match(/(?:^|; )kuuki_theme=([^;]+)/)?.[1]
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}

function resolveTheme(theme: Theme): keyof typeof THEME_COLOR {
  return theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    : theme
}

function paintTheme(effective: keyof typeof THEME_COLOR) {
  document.documentElement.dataset.theme = effective
  document.documentElement.style.colorScheme = effective
}

function setBrowserBar(effective: keyof typeof THEME_COLOR) {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[effective])
}

function applyTheme(theme: Theme) {
  const effective = resolveTheme(theme)
  paintTheme(effective)
  setBrowserBar(effective)
}

export function AppearanceProvider() {
  useEffect(() => {
    const selected = currentTheme()
    applyTheme(selected)
    normalizeAccent()
    if (!document.cookie.includes('kuuki_theme=')) cookie('kuuki_theme', selected)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const changed = () => {
      if (currentTheme() === 'system') switchTheme('system')
    }
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  return null
}
