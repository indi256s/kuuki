'use client'
import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 700px)'
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const snapshot = () => window.matchMedia(QUERY).matches
const server = () => null

/**
 * `null` until the media query can be read (server and hydration), then true on phones.
 * Callers that choose a surface must render nothing for `null` instead of guessing desktop,
 * so a phone never sees the desktop dialog swap for the sheet.
 */
export function useMobile(): boolean | null {
  return useSyncExternalStore(subscribe, snapshot, server)
}
