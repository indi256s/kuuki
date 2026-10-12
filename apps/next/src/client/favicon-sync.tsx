'use client'

import { useEffect } from 'react'
import { SURFACES, THEMES, type Mode } from '@kuuki/shared/theme/palette'
import { resolveAccent, type Accent } from '../lib/theme-colors'

// Hairline strokes of app/icon.svg, which the shared palette has no entry for.
/* oxlint-disable kuuki/design-tokens -- the icon is a standalone image and cannot read CSS variables */
const HAIRLINE: Record<Mode, string> = { light: '#dedad5', dark: '#554f4a' }
/* oxlint-enable kuuki/design-tokens */
const GLYPH =
  'M6.75 21.96V9.92H9.18V14.92H10.88L14.01 9.92H16.8L12.92 15.77L16.8 21.96H13.94L10.98 17.16H9.18V21.96ZM21.22 22.08Q19.25 22.08 18.18 21.07Q17.12 20.05 17.12 18.01V13H19.5V17.84Q19.5 18.46 19.68 18.92Q19.86 19.39 20.23 19.66Q20.61 19.94 21.22 19.94Q21.88 19.94 22.24 19.65Q22.6 19.36 22.73 18.87Q22.87 18.39 22.87 17.84V13H25.25V18.01Q25.25 20.14 24.19 21.11Q23.12 22.08 21.22 22.08Z'

/** The geometry of app/icon.svg in one accent and mode, as a data URI; the static file stays the default. */
export function faviconHref(accent: Accent, mode: Mode) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect x=".5" y=".5" width="31" height="31" rx="6.5" stroke-width="1" fill="${SURFACES[mode].background}" stroke="${HAIRLINE[mode]}"/>` +
    `<path fill="${THEMES[accent][mode].text}" d="${GLYPH}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const SVG_ICONS = 'link[rel~="icon"][type="image/svg+xml"]'

/** Every SVG icon link in the head, creating one when the document has none; favicon.ico and the apple icon are not SVG and stay. */
function iconLinks() {
  const existing = document.head.querySelectorAll<HTMLLinkElement>(SVG_ICONS)
  if (existing.length) return existing
  const link = document.createElement('link')
  link.rel = 'icon'
  link.type = 'image/svg+xml'
  link.setAttribute('sizes', 'any')
  document.head.appendChild(link)
  return [link]
}

/** Keeps the tab icon in the accent and mode on screen, an owner's accent included. */
export function FaviconSync() {
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const href = faviconHref(
        resolveAccent(root.dataset.accent),
        root.dataset.theme === 'dark' ? 'dark' : 'light',
      )
      // Next emits its static icon.svg link next to ours; the first SVG link wins in some browsers, so set them all.
      // Writing an href that is already current changes nothing, so the head observer cannot loop on its own edits.
      for (const link of iconLinks()) {
        if (link.getAttribute('href') !== href) link.setAttribute('href', href)
      }
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(root, { attributes: true, attributeFilter: ['data-accent', 'data-theme'] })
    // Next re-renders its icon links on navigation; take the tab icon back when it does.
    observer.observe(document.head, { childList: true })
    return () => observer.disconnect()
  }, [])
  return null
}
