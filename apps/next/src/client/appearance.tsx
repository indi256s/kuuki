'use client'

import { useEffect, useRef } from 'react'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from './activity'
import {
  THEME_COLOR,
  isAccent,
  recognizeAccent,
  resolveAccent,
  type Accent,
} from '../lib/theme-colors'

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

/** True while a public profile page shows its owner's accent (`OwnerAccent`); nothing is saved or adopted then. */
export function inOwnerScope() {
  return document.documentElement.dataset.accentScope === 'owner'
}

/** Same cookie and `data-accent` contract as public/bootstrap.js; unknown names are ignored. */
export function setAccent(accent: Accent) {
  if (!isAccent(accent)) return
  cookie('kuuki_accent', accent)
  // An owner's accent stays on screen until its page is left; the device choice is already in the cookie.
  if (!inOwnerScope()) document.documentElement.dataset.accent = accent
  window.dispatchEvent(new Event('kuuki:appearance'))
}

/** The accent this device chose: the cookie, else what the page shows unless an owner's accent is on screen. */
export function deviceAccent(): Accent {
  const saved = document.cookie.match(/(?:^|; )kuuki_accent=([^;]+)/)?.[1]
  return resolveAccent(
    saved ?? (inOwnerScope() ? undefined : document.documentElement.dataset.accent),
  )
}

/** Last accent this page session saw stored on the profile; wins over a stale server payload after soft navigation. */
let savedAccent: Accent | null = null

/** Profile accent writes run one after another, so the server sees them in the order they were issued. */
let queue: Promise<void> | null = null

/**
 * Stores the accent on the signed-in profile; rejects if the write failed so the caller can revert and say so.
 * Writes land in issue order, so the saved-accent cache follows every success under the current sign-in:
 * the last one to succeed is what the profile holds, even when a later write failed.
 */
export function persistAccent(accent: Accent, signal?: AbortSignal) {
  const generation = getAuthGeneration()
  const send = async () => {
    await api.patch('/api/profiles/me', { theme_color: accent }, { signal })
    if (generation === getAuthGeneration()) savedAccent = accent
  }
  const result = queue ? queue.then(send) : send()
  const release = () => {
    if (queue === settled) queue = null
  }
  const settled: Promise<void> = result.then(release, release)
  queue = settled
  return result
}

/**
 * The cookie bootstraps the device; once a signed-in shell mounts, a recognized profile accent (canonical or retired
 * name) wins and a retired name is rewritten canonical. A missing or unrecognized one receives the device accent.
 */
export function reconcileAccent(
  profile: string | null | undefined,
  device: Accent,
): { device: Accent; save: Accent | null } {
  const recognized = recognizeAccent(profile)
  if (!recognized) return { device, save: device }
  return { device: recognized, save: isAccent(profile) ? null : recognized }
}

/** Reconciles the device with the profile once per mount of the signed-in shell, never inside an owner scope. */
export function AccentSync({ profileAccent }: { profileAccent: string | null }) {
  const done = useRef(false)
  useEffect(() => {
    const run = () => {
      if (done.current || inOwnerScope()) return
      done.current = true
      const current = deviceAccent()
      const plan = reconcileAccent(savedAccent ?? profileAccent, current)
      if (plan.device !== current) setAccent(plan.device)
      if (!plan.save) return
      const controller = new AbortController(),
        release = trackPrivateOperation(controller)
      // A failed save leaves `done` set: the device keeps its accent, and a re-run on the user's next pick would
      // repaint the stale profile value over it. The next shell mount tries again.
      persistAccent(plan.save, controller.signal)
        .catch(() => {})
        .finally(release)
    }
    run()
    // Leaving an owner's profile fires this, so a shell that mounted inside that scope still reconciles once.
    window.addEventListener('kuuki:appearance', run)
    return () => window.removeEventListener('kuuki:appearance', run)
  }, [profileAccent])
  return null
}

/** Reads the stored accent; removed names are rewritten to their successor the first time they are seen. */
function normalizeAccent() {
  const saved = document.cookie.match(/(?:^|; )kuuki_accent=([^;]+)/)?.[1]
  const next = resolveAccent(saved)
  if (saved !== undefined && saved !== next) setAccent(next)
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
