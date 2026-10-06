'use client'

import { useId, useSyncExternalStore } from 'react'
import { setTheme } from '../appearance'
import type { Locale } from '../../lib/format'
import './auth-card.css'

/*
 * The artwork is the "Horizon" theme toggle from toggles.dev, published as `@theme-toggles/react` v5.0.5
 * (https://github.com/AlfieJones/theme-toggles) by Alfie Jones under the MIT License. The SVG paths below are copied
 * as published; the package component is not rendered, and the sun and icon motion are driven from `data-theme` in
 * auth-card.css instead of the package's Tailwind `dark:` utilities.
 */
const HORIZON_LINE = 'M30.7 29.9H1.3c-.7 0-1.3.5-1.3 1.1 0 .6.6 1 1.3 1h29.3c.7 0 1.3-.5 1.3-1.1.1-.5-.5-1-1.2-1z'
const SUN = 'M16 8.8c-3.4 0-6.1 2.8-6.1 6.1s2.7 6.3 6.1 6.3 6.1-2.8 6.1-6.1-2.7-6.3-6.1-6.3zm13.3 11L26 15l3.3-4.8c.3-.5.1-1.1-.5-1.2l-5.7-1-1-5.7c-.1-.6-.8-.8-1.2-.5L16 5.1l-4.8-3.3c-.5-.4-1.2-.1-1.3.4L8.9 8 3.2 9c-.6.1-.8.8-.5 1.2L6 15l-3.3 4.8c-.3.5-.1 1.1.5 1.2l5.7 1 1 5.7c.1.6.8.8 1.2.5L16 25l4.8 3.3c.5.3 1.1.1 1.2-.5l1-5.7 5.7-1c.7-.1.9-.8.6-1.3zM16 22.5A7.6 7.6 0 0 1 8.3 15c0-4.2 3.5-7.5 7.7-7.5s7.7 3.4 7.7 7.5c0 4.2-3.4 7.5-7.7 7.5z'

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
  const clip = useId()
  const label = locale === 'ru' ? 'Тёмная тема' : 'Dark theme'
  return <button type="button" className="auth-corner-control auth-horizon" aria-label={label} title={label} aria-pressed={dark}
    onClick={() => setTheme(dark ? 'light' : 'dark')}>
    <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <defs><clipPath id={clip}><path d="M0 0h32v29h-32z" /></clipPath></defs>
      <path d={HORIZON_LINE} />
      <g clipPath={`url(#${clip})`}><path className="auth-horizon-sun" d={SUN} /></g>
    </svg>
  </button>
}
