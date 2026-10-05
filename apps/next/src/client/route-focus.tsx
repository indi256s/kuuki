'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

/** Query keys whose change is a real mode/step change that deserves a new heading focus, by pathname. */
const MODE_KEYS: Record<string, string> = { '/onboarding': 'step', '/passport': 'view' }

/**
 * Moves focus to the page heading after navigation. Fires for a pathname change or a change of the
 * route's mode key; never for filters, search text or detail-sheet params.
 */
export function RouteFocus() {
  const pathname = usePathname()
  const search = useSearchParams()
  const mode = MODE_KEYS[pathname] ? search.get(MODE_KEYS[pathname]) ?? '' : ''
  const key = `${pathname}\u0000${mode}`
  const previous = useRef(key)
  useEffect(() => {
    if (previous.current === key) return
    previous.current = key
    const focusHeading = () => {
      const heading = document.querySelector<HTMLElement>('main h1')
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
      return heading
    }
    let heading = focusHeading()
    // A route loading state may swap its heading for the real one; follow it only while focus is lost.
    const main = document.getElementById('main')
    if (!main) return
    const observer = new MutationObserver(() => {
      if (heading?.isConnected) return
      if (document.activeElement && document.activeElement !== document.body) { observer.disconnect(); return }
      heading = focusHeading()
    })
    observer.observe(main, { childList: true, subtree: true })
    const timer = setTimeout(() => observer.disconnect(), 4000)
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [key])
  return null
}
