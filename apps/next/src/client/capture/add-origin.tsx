'use client'
import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const KEY = 'kuuki:add-origin'

const GROUND_FORM = /^\/ground-travel\/(new|[^/]+\/edit)(?:[/?#]|$)/

export function addOrigin() {
  try {
    const path = sessionStorage.getItem(KEY)
    if (
      path &&
      path.startsWith('/') &&
      !path.startsWith('//') &&
      !path.startsWith('/add') &&
      !GROUND_FORM.test(path)
    )
      return path
  } catch {}
  return '/journal'
}

function Track() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  useEffect(() => {
    if (!pathname || pathname.startsWith('/add') || GROUND_FORM.test(pathname)) return
    try {
      sessionStorage.setItem(KEY, search ? `${pathname}?${search}` : pathname)
    } catch {}
  }, [pathname, search])
  return null
}

export function AddOriginTracker() {
  return (
    <Suspense fallback={null}>
      <Track />
    </Suspense>
  )
}
