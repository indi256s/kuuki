'use client'

import clsx from 'clsx'
import { useSyncExternalStore } from 'react'
import './text-shimmer.css'

const subscribeVisibility = (notify: () => void) => {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}
const hidden = () => document.hidden
const serverHidden = () => false

export interface TextShimmerProps {
  children: string
  active?: boolean
  className?: string
}

export function TextShimmer({ children, active = true, className }: TextShimmerProps) {
  const paused = useSyncExternalStore(subscribeVisibility, hidden, serverHidden)
  return (
    <span
      className={clsx('ui-shimmer', className)}
      data-active={active ? 'true' : undefined}
      data-paused={paused ? 'true' : undefined}
      aria-busy={active || undefined}
    >
      <span key={children} className="ui-shimmer-label">
        {children}
      </span>
    </span>
  )
}
