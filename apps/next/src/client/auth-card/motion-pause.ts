'use client'

import { useSyncExternalStore } from 'react'

const KEY = 'kuuki-auth-motion-paused'
let unsaved: boolean | undefined
function snapshot() {
  if (unsaved !== undefined) return unsaved
  try {
    return localStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}
function subscribe(listener: () => void) {
  window.addEventListener('kuuki:auth-motion', listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener('kuuki:auth-motion', listener)
    window.removeEventListener('storage', listener)
  }
}
function setPaused(value: boolean) {
  unsaved = value
  try {
    localStorage.setItem(KEY, String(value))
    unsaved = undefined
  } catch {
    // Storage may be blocked; the pause still lasts for this page.
  }
  window.dispatchEvent(new Event('kuuki:auth-motion'))
}

export function useMotionPause() {
  // Keep the decoration stopped until the saved choice is available after hydration.
  return [useSyncExternalStore(subscribe, snapshot, () => true), setPaused] as const
}
