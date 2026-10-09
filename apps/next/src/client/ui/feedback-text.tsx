'use client'

import { useEffect, useRef, useState } from 'react'
import { MorphController } from 'torph'

/** Only the scoped short feedback labels in DESIGN.md. Semantics belong to the caller. */
export function FeedbackText({
  children,
  fast = false,
  numbers = false,
  disabled = false,
  locale = 'en',
}: {
  children: string | number
  fast?: boolean
  numbers?: boolean
  disabled?: boolean
  locale?: string
}) {
  const element = useRef<HTMLSpanElement>(null)
  const attached = useRef(false)
  const lastUpdate = useRef<number | null>(null)
  const [controller] = useState(() => new MorphController())
  // React keeps the SSR text stable; Torph owns this node's contents after hydration.
  const [initial] = useState(() =>
    typeof children === 'number' ? children.toLocaleString(locale) : children,
  )
  useEffect(() => {
    if (!element.current) return
    const tokens = getComputedStyle(document.documentElement)
    const time = tokens.getPropertyValue(fast ? '--dur-fast' : '--dur-base').trim()
    const duration = parseFloat(time) * (time.endsWith('ms') ? 1 : 1000) || (fast ? 150 : 200)
    const now = performance.now()
    // ponytail: one quiet interval ends burst mode; use stream-level backpressure if updates become expensive.
    const rapid = numbers && lastUpdate.current !== null && now - lastUpdate.current < duration
    const options = {
      duration,
      ease: tokens.getPropertyValue('--ease-out').trim() || 'cubic-bezier(.23,1,.32,1)',
      locale,
      scale: false,
      numbers,
      disabled: disabled || rapid,
    }
    if (!attached.current || controller.needsRecreate(options)) {
      controller.attach(element.current, options)
      attached.current = true
    }
    controller.update(children)
    lastUpdate.current = now
  }, [children, controller, disabled, fast, locale, numbers])
  useEffect(
    () => () => {
      controller.destroy()
      attached.current = false
    },
    [controller],
  )
  return (
    <span ref={element} style={{ whiteSpace: 'normal', maxWidth: '100%' }}>
      {initial}
    </span>
  )
}
