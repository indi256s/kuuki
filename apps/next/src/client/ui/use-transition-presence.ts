'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

/** Radix Presence waits for animations, so transition exits retain the portal explicitly. */
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
    // Cancellation (including reduced motion changing mid-exit) also releases the portal.
    void Promise.allSettled(transitions.map((transition) => transition.finished)).then(finish)
    // A detached document or interrupted browser lifecycle must not strand the layer.
    const timeout = window.setTimeout(finish, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [ref, open, present, instant])

  return present
}
