'use client'
import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const KEY = 'kuuki:add-origin'

/** Where Add a flight returns to: the last member screen before /add, kept for the tab so a reload keeps it. */
export function addOrigin() {
  try {
    const path = sessionStorage.getItem(KEY)
    // Local paths only; anything else falls back to Journal, as a direct visit to /add does.
    if (path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/add'))
      return path
  } catch {
    /* storage unavailable */
  }
  return '/journal'
}

function Track() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  useEffect(() => {
    if (!pathname || pathname.startsWith('/add')) return
    try {
      sessionStorage.setItem(KEY, search ? `${pathname}?${search}` : pathname)
    } catch {
      /* storage unavailable: /add falls back to Journal */
    }
  }, [pathname, search])
  return null
}

/** Mounted once in the member shell. */
export function AddOriginTracker() {
  return (
    <Suspense fallback={null}>
      <Track />
    </Suspense>
  )
}
