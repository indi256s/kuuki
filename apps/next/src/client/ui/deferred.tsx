'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

const subscribe = () => () => {}
const supported = () => typeof IntersectionObserver !== 'undefined'
const server = () => true

/** Keep below-fold code and rendering behind its placeholder until the reader approaches it. */
export function Deferred({
  children,
  fallback,
  as: Host = 'div',
}: {
  children: ReactNode
  fallback: ReactNode
  as?: 'div' | 'span'
}) {
  const host = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)
  const canObserve = useSyncExternalStore(subscribe, supported, server)
  useEffect(() => {
    if (shown || !canObserve || !host.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [shown, canObserve])
  return (
    <Host
      ref={(node) => {
        host.current = node
      }}
      style={Host === 'span' ? { display: 'block' } : undefined}
    >
      {shown || !canObserve ? children : fallback}
    </Host>
  )
}
