'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Skeleton } from '../../ui/skeleton'

const subscribe = () => () => {}
const observerAvailable = () => typeof IntersectionObserver !== 'undefined'
const serverObserverAvailable = () => true

// `height` only reserves space (pre-mount skeleton and closed chart); mounted content sizes naturally so an opened table pushes later content down.
export function LazyChart({ height, label, children }: { height: number; label: string; children: (inView: boolean) => ReactNode }) {
  const host = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [inView, setInView] = useState(false)
  const hasObserver = useSyncExternalStore(subscribe, observerAvailable, serverObserverAvailable)
  useEffect(() => {
    const element = host.current
    if (!element || !hasObserver) return
    const preload = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setMounted(true)
        preload.disconnect()
      }
    }, { rootMargin: '200px' })
    // Preload distance is not visibility: only the viewport observer enables motion.
    const visibility = new IntersectionObserver(entries => setInView(entries[entries.length - 1].isIntersecting))
    preload.observe(element)
    visibility.observe(element)
    return () => { preload.disconnect(); visibility.disconnect() }
  }, [hasObserver])
  return <div ref={host} style={{ minHeight: height }}>{mounted || !hasObserver ? children(inView || !hasObserver) : <Skeleton height={height} label={label} />}</div>
}
