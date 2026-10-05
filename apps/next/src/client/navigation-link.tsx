'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { announceJournalLink } from './journal-links'

export const ROUTE_LINK_EVENT = 'kuuki:route-link'

/** Owned shell links announce intent before a cold App Router navigation commits. */
export function NavigationLink(props: Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & { href: string }) {
  return <Link {...props} onNavigate={() => {
    window.dispatchEvent(new CustomEvent<string>(ROUTE_LINK_EVENT, { detail: props.href }))
    announceJournalLink(props.href)?.()
  }} />
}
