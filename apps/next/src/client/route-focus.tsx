'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

const MODE_KEYS: Record<string, readonly string[]> = { '/passport': ['view', 'as'] }

export function RouteFocus() {
  const pathname = usePathname()
  const search = useSearchParams()
  const mode = (MODE_KEYS[pathname] ?? []).map((name) => search.get(name) ?? '').join('\u0001')
  const key = `${pathname}\u0000${mode}`
  const previous = useRef(key)
  useEffect(() => {
    if (previous.current === key) return
    previous.current = key
    const focusHeading = () => {
      const heading = [...document.querySelectorAll<HTMLElement>('main h1')].find(
        (node) => !node.closest('[hidden], [inert], [aria-hidden="true"]'),
      )
      if (heading) {
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
      } else {
        const main = document.getElementById('main')
        if (main) {
          main.tabIndex = -1
          main.focus({ preventScroll: true })
        }
      }
      return heading
    }
    let heading = focusHeading()
    const main = document.getElementById('main')
    if (!main) return
    const observer = new MutationObserver(() => {
      if (heading?.isConnected && !heading.closest('[hidden], [inert]')) return
      if (
        document.activeElement !== heading &&
        document.activeElement &&
        document.activeElement !== document.body &&
        document.activeElement !== main
      ) {
        observer.disconnect()
        return
      }
      heading = focusHeading()
    })
    observer.observe(main, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'inert'],
    })
    const timer = setTimeout(() => observer.disconnect(), 4000)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [key])
  return null
}
