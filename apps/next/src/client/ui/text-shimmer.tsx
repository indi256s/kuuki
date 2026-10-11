'use client'

import clsx from 'clsx'
import { useSyncExternalStore } from 'react'
import './text-shimmer.css'

// Adapted from Arc "text-shimmer" (uiarc.dev, MIT, see ARC-LICENSE.txt): a light band sweeping across a short status line
// while work runs, over a base that leans toward muted text, with `aria-busy` while active and a changed label rising in.
// Dropped: `motion` and its per-frame gradient rebuild, the in-view observer, the glide-off on finish and the width
// spring. Here one CSS animation moves a fixed gradient; it pauses while the tab is hidden, the line turns solid when
// `active` ends, and under reduced motion the text is simply solid.

const subscribeVisibility = (notify: () => void) => {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}
const hidden = () => document.hidden
const serverHidden = () => false

export interface TextShimmerProps {
  /** The status text. Keep it to one short line. */
  children: string
  /** Sweep while work is ongoing. Defaults to true. */
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
      {/* A new label is a new node, so it rises in once; the same label never replays. */}
      <span key={children} className="ui-shimmer-label">
        {children}
      </span>
    </span>
  )
}
