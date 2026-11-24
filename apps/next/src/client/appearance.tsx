'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
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

export function setLocale(locale: Locale) {
  cookie('kuuki_locale', locale)
  try {
    localStorage.setItem('kuuki-language', locale)
  } catch {}
  document.documentElement.lang = locale
  document.documentElement.dataset.locale = locale
  window.dispatchEvent(new Event('kuuki:appearance'))
}

export function setTheme(theme: Theme) {
  cookie('kuuki_theme', theme)
  try {
    localStorage.setItem('kuuki-theme-mode', theme)
  } catch {}
  switchTheme(theme)
  window.dispatchEvent(new Event('kuuki:appearance'))
}

let switchToken = 0

function switchTheme(theme: Theme) {
  const root = document.documentElement
  const effective = resolveTheme(theme)
  if (root.dataset.theme === effective && root.dataset.themeSwitching === undefined) return
  const token = ++switchToken
  const direction = effective === 'dark' ? 'dusk' : 'dawn'
  root.dataset.themeSwitching = direction
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
    root.dataset.themePainting = ''
    paintTheme(effective)
    setBrowserBar(effective)
  })
  transition.ready.catch(() => {})
  transition.finished.finally(done)
}

export function inOwnerScope() {
  return document.documentElement.dataset.accentScope === 'owner'
}

export function setAccent(accent: Accent) {
  if (!isAccent(accent)) return
  cookie('kuuki_accent', accent)
  if (!inOwnerScope()) document.documentElement.dataset.accent = accent
  window.dispatchEvent(new Event('kuuki:appearance'))
}

export function deviceAccent(): Accent {
  const saved = document.cookie.match(/(?:^|; )kuuki_accent=([^;]+)/)?.[1]
  return resolveAccent(
    saved ?? (inOwnerScope() ? undefined : document.documentElement.dataset.accent),
  )
}

let savedAccent: Accent | null = null
let savedGeneration = -1
let latestAccentPick = 0

let queue: Promise<void> | null = null

export function persistAccent(accent: Accent, signal?: AbortSignal) {
  const generation = getAuthGeneration()
  const send = async () => {
    await api.patch('/api/profiles/me', { theme_color: accent }, { signal })
    if (generation === getAuthGeneration()) {
      savedAccent = accent
      savedGeneration = generation
    }
  }
  const result = queue ? queue.then(send) : send()
  const release = () => {
    if (queue === settled) queue = null
  }
  const settled: Promise<void> = result.then(release, release)
  queue = settled
  return result
}

export function useAccentSave(profileAccent?: string | null, onFail?: () => void) {
  const baseline = useRef<Accent | null>(null),
    mounted = useRef(false),
    fail = useRef(onFail),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    fail.current = onFail
  })
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    baseline.current ??=
      recognizeAccent(profileAccent) ?? resolveAccent(document.documentElement.dataset.accent)
  }, [profileAccent])
  const save = (accent: Accent) => {
    const pick = ++latestAccentPick,
      controller = new AbortController(),
      release = trackPrivateOperation(controller),
      generation = getAuthGeneration()
    setFailed(false)
    persistAccent(accent, controller.signal)
      .catch(() => {
        if (!mounted.current || pick !== latestAccentPick || generation !== getAuthGeneration())
          return
        const back = savedGeneration === generation && savedAccent ? savedAccent : baseline.current
        if (back) setAccent(back)
        setFailed(true)
        fail.current?.()
      })
      .finally(release)
  }
  return { save, failed }
}

const SIGNED_OUT_PICK = 'kuuki-accent-pick'

export function rememberSignedOutPick(accent: Accent) {
  try {
    sessionStorage.setItem(SIGNED_OUT_PICK, accent)
  } catch {}
}

function takeSignedOutPick(): Accent | null {
  try {
    const pick = sessionStorage.getItem(SIGNED_OUT_PICK)
    sessionStorage.removeItem(SIGNED_OUT_PICK)
    return isAccent(pick) ? pick : null
  } catch {
    return null
  }
}

export function reconcileAccent(
  profile: string | null | undefined,
  device: Accent,
  picked: Accent | null = null,
): { device: Accent; save: Accent | null } {
  if (picked && picked === device) return { device, save: profile === device ? null : device }
  const recognized = recognizeAccent(profile)
  if (!recognized) return { device, save: device }
  return { device: recognized, save: isAccent(profile) ? null : recognized }
}

export function AccentSync({ profileAccent }: { profileAccent: string | null }) {
  const done = useRef(false)
  useEffect(() => {
    const run = () => {
      if (done.current || inOwnerScope()) return
      done.current = true
      const current = deviceAccent()
      const plan = reconcileAccent(savedAccent ?? profileAccent, current, takeSignedOutPick())
      if (plan.device !== current) setAccent(plan.device)
      if (!plan.save) return
      const controller = new AbortController(),
        release = trackPrivateOperation(controller)
      persistAccent(plan.save, controller.signal)
        .catch(() => {})
        .finally(release)
    }
    run()
    window.addEventListener('kuuki:appearance', run)
    return () => window.removeEventListener('kuuki:appearance', run)
  }, [profileAccent])
  return null
}

function normalizeAccent() {
  const saved = document.cookie.match(/(?:^|; )kuuki_accent=([^;]+)/)?.[1]
  const next = resolveAccent(saved)
  if (saved !== undefined && saved !== next) setAccent(next)
}

function currentTheme(): Theme {
  let legacy: string | null = null
  try {
    legacy = localStorage.getItem('kuuki-theme-mode')
  } catch {}
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
  const top = getComputedStyle(document.documentElement)
    .getPropertyValue('--edge-top-background')
    .trim()
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', top || THEME_COLOR[effective])
}

function syncBrowserBar() {
  setBrowserBar(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
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
    const narrow = window.matchMedia('(max-width: 700px)')
    narrow.addEventListener('change', syncBrowserBar)
    window.addEventListener('pageshow', syncBrowserBar)
    const transitions = new MutationObserver(syncBrowserBar)
    transitions.observe(document.documentElement, { attributeFilter: ['data-route-transition'] })
    return () => {
      media.removeEventListener('change', changed)
      narrow.removeEventListener('change', syncBrowserBar)
      window.removeEventListener('pageshow', syncBrowserBar)
      transitions.disconnect()
    }
  }, [])
  const pathname = usePathname()
  useEffect(syncBrowserBar, [pathname])
  return null
}
