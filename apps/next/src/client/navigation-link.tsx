'use client'

import Link from 'next/link'
import { useState, type ComponentProps } from 'react'
import { isConstrainedConnection } from './network'

export const ROUTE_LINK_EVENT = 'kuuki:route-link'

/**
 * Owned shell links announce intent before a cold App Router navigation commits. Link calls `onNavigate` only for a plain, local click that nobody
 * cancelled, just before navigating; a mounted Journal treats a link to /journal like Reset or Back (see `JournalView`).
 */
export function NavigationLink({
  prefetch,
  onPointerEnter,
  onFocus,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & { href: string }) {
  const [warmHref, setWarmHref] = useState<string | null>(null)
  const warm = () => {
    if (prefetch === false || !navigator.onLine) return
    if (isConstrainedConnection()) return
    setWarmHref(props.href)
  }
  return (
    <Link
      {...props}
      // Full-route viewport prefetches compete with the page being read. Warm only an intended destination.
      prefetch={warmHref === props.href ? (prefetch ?? null) : false}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        if (!event.defaultPrevented && event.pointerType === 'mouse') warm()
      }}
      onFocus={(event) => {
        onFocus?.(event)
        if (!event.defaultPrevented) warm()
      }}
      onNavigate={() =>
        window.dispatchEvent(new CustomEvent<string>(ROUTE_LINK_EVENT, { detail: props.href }))
      }
    />
  )
}
