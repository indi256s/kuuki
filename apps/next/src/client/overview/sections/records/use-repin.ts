'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const SINK_MS = 120

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
  useLayoutEffect(() => {
    if (!landed) return
    void host.current?.getBoundingClientRect()
    // oxlint-disable-next-line react/set-state-in-effect -- the pins rise only after the forced layout above
    setDown(false)
  }, [landed])
  return { shown, down, host }
}
