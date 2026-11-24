'use client'

import { useLayoutEffect } from 'react'
import type { Accent } from '../lib/theme-colors'
import { deviceAccent, inOwnerScope } from './appearance'

export function OwnerAccent({ accent }: { accent: Accent }) {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.accent = accent
    root.dataset.accentScope = 'owner'
    return () => {
      root.dataset.accent = deviceAccent()
      delete root.dataset.accentScope
      queueMicrotask(() => {
        if (!inOwnerScope()) window.dispatchEvent(new Event('kuuki:appearance'))
      })
    }
  }, [accent])
  const script = `document.documentElement.dataset.accent=${JSON.stringify(accent)};document.documentElement.dataset.accentScope='owner'`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
