'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'

export const ROUTE_LINK_EVENT = 'kuuki:route-link'

/**
 * Owned shell links announce intent before a cold App Router navigation commits. Link calls `onNavigate` only for a plain, local click that nobody
 * cancelled, just before navigating; a mounted Journal treats a link to /journal like Reset or Back (see `JournalView`).
 */
export function NavigationLink(
  props: Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & { href: string },
) {
  return (
    <Link
      {...props}
      onNavigate={() =>
        window.dispatchEvent(new CustomEvent<string>(ROUTE_LINK_EVENT, { detail: props.href }))
      }
    />
  )
}
