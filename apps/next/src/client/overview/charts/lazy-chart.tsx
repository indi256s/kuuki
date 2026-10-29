'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

const subscribe = () => () => {}
const observerAvailable = () => typeof IntersectionObserver !== 'undefined'
const serverObserverAvailable = () => true

// Render chart content with its chapter; viewport visibility controls motion only.
export function LazyChart({
  height,
  children,
}: {
  height: number
  label: string
  children: (inView: boolean) => ReactNode
}) {
  const host = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const hasObserver = useSyncExternalStore(subscribe, observerAvailable, serverObserverAvailable)
  useEffect(() => {
    const element = host.current
    if (!element || !hasObserver) return
    const visibility = new IntersectionObserver((entries) =>
      setInView(entries[entries.length - 1].isIntersecting),
    )
    visibility.observe(element)
    return () => {
      visibility.disconnect()
    }
  }, [hasObserver])
  return (
    <div ref={host} style={{ minHeight: height }}>
      {children(inView || !hasObserver)}
    </div>
  )
}
