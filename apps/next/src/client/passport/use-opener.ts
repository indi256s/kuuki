'use client'

import { useCallback, useRef } from 'react'

/**
 * Where focus returns when a sheet opened from the page closes: the control that opened it, or the page heading when
 * that control is gone (a removed country, a deep link). Safari does not focus a clicked button, so callers pass the
 * element explicitly and the focused element is only the fallback.
 */
export function useOpener() {
  const opener = useRef<HTMLElement | null>(null)
  const remember = useCallback((element?: HTMLElement | null) => {
    const active = document.activeElement
    opener.current =
      element ?? (active instanceof HTMLElement && active !== document.body ? active : null)
  }, [])
  const restore = useCallback((event: Event) => {
    const opened = opener.current?.isConnected ? opener.current : null
    const target = opened ?? document.querySelector<HTMLElement>('main h1')
    if (!target) return
    event.preventDefault()
    // The heading is not focusable by itself; RouteFocus prepares it the same way.
    // oxlint-disable-next-line react/immutability -- a DOM node in an event handler, not a React value
    if (!opened) target.tabIndex = -1
    target.focus({ preventScroll: !opened })
  }, [])
  return { remember, restore }
}
