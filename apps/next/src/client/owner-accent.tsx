'use client'

import { useLayoutEffect } from 'react'
import type { Accent } from '../lib/theme-colors'
import { deviceAccent, inOwnerScope } from './appearance'

/**
 * Shows a public profile in its owner's accent. The inline script paints it during parse on a hard load; the layout
 * effect does the same after soft navigation (React never runs a client-rendered script) and restores the visitor's
 * accent on leave. Only `data-accent` and `data-accent-scope` change: no cookie, no profile write, mode untouched.
 */
export function OwnerAccent({ accent }: { accent: Accent }) {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.accent = accent
    root.dataset.accentScope = 'owner'
    return () => {
      root.dataset.accent = deviceAccent()
      delete root.dataset.accentScope
      // A profile-to-profile move re-enters the scope in this commit; only a real exit tells the shell.
      queueMicrotask(() => {
        if (!inOwnerScope()) window.dispatchEvent(new Event('kuuki:appearance'))
      })
    }
  }, [accent])
  const script = `document.documentElement.dataset.accent=${JSON.stringify(accent)};document.documentElement.dataset.accentScope='owner'`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
