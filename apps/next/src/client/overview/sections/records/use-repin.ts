'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** How long the old pins take to sink, in ms: map.css's `--dur-press`. The route swaps when they are down. */
const SINK_MS = 120

/**
 * What the Records figure draws while the reading changes. A pick sinks the pins (`down`), swaps the route when they are
 * under, then lets them rise again; the host's `data-pins="down"` is the whole motion (map.css).
 * `animate` is false for everything that is not a pick (first render, a swipe, a filter, reduced motion): the route swaps at once.
 * A new pick during the sink only changes where the swap lands; one during the rise sinks the pins again from where they are.
 */
export function useRepin(target: string, animate: boolean) {
  const [shown, setShown] = useState(target)
  const [down, setDown] = useState(false)
  const [landed, setLanded] = useState(0)
  const host = useRef<HTMLDivElement>(null)
  const wanted = useRef(target)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  if (!animate && (shown !== target || down)) {
    setShown(target)
    setDown(false)
  }
  useEffect(() => {
    wanted.current = target
    if (!animate) {
      clearTimeout(timer.current)
      timer.current = undefined
      return
    }
    if (target === shown && timer.current === undefined) return
    setDown(true)
    timer.current ??= setTimeout(() => {
      timer.current = undefined
      setShown(wanted.current)
      setLanded((n) => n + 1)
    }, SINK_MS)
  }, [target, animate, shown])
  useEffect(() => () => clearTimeout(timer.current), [])
  // The new route is drawn with the pins still down; flush that pose, then let them rise.
  useLayoutEffect(() => {
    if (!landed) return
    void host.current?.getBoundingClientRect()
    setDown(false)
  }, [landed])
  return { shown, down, host }
}
