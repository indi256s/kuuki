'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

export function useTransitionPresence(
  ref: RefObject<HTMLDivElement | null>,
  open: boolean,
  instant = false,
) {
  const [present, setPresent] = useState(open)
  if (open && !present) setPresent(true)

  useLayoutEffect(() => {
    const node = ref.current
    if (open || !present || !node) return
    const transitions = instant ? [] : (node.getAnimations?.() ?? [])
    if (!transitions.length) {
      setPresent(false)
      return
    }
    let cancelled = false
    const finish = () => {
      if (!cancelled) setPresent(false)
    }
    void Promise.allSettled(transitions.map((transition) => transition.finished)).then(finish)
    const timeout = window.setTimeout(finish, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [ref, open, present, instant])

  return present
}
