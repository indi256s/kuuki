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

export function useMobile(): boolean | null {
  return useSyncExternalStore(subscribe, snapshot, server)
}
