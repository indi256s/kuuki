'use client'

import Link from 'next/link'
import { useState, type ComponentProps } from 'react'
import { isConstrainedConnection } from './network'

export const ROUTE_LINK_EVENT = 'kuuki:route-link'

export function NavigationLink({
  prefetch,
  onPointerEnter,
  onFocus,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & { href: string }) {
  const [warmHref, setWarmHref] = useState<string | null>(null)
  const warm = () => {
    if (prefetch === false || !navigator.onLine) return
    if (isConstrainedConnection()) return
    setWarmHref(props.href)
  }
  return (
    <Link
      {...props}
      prefetch={warmHref === props.href ? (prefetch ?? null) : false}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        if (!event.defaultPrevented && event.pointerType === 'mouse') warm()
      }}
      onFocus={(event) => {
        onFocus?.(event)
        if (!event.defaultPrevented) warm()
      }}
      onNavigate={() =>
        window.dispatchEvent(new CustomEvent<string>(ROUTE_LINK_EVENT, { detail: props.href }))
      }
    />
  )
}
