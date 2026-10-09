'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import './empty-state.css'

// Adapted from Arc "empty-state" (uiarc.dev, MIT, see ARC-LICENSE.txt): the centred title, one line of description and the action below.
// Dropped: `motion` (text swaps, height spring), the icon tile and its entrance. There is no icon here; the copy and the one action carry the state.

export type EmptyStateProps = {
  title: string
  /** One line: what is missing and what to do about it. */
  description: string
  /** The one next step, e.g. a Button. */
  action?: ReactNode
  className?: string
  /** Optional accessible name for the region. */
  label?: string
}

export function EmptyState({ title, description, action, className, label }: EmptyStateProps) {
  return (
    <section className={clsx('ui-empty', className)} aria-label={label}>
      <h3 className="ui-empty-title">{title}</h3>
      <p className="ui-empty-description">{description}</p>
      {action ? <div className="ui-empty-action">{action}</div> : null}
    </section>
  )
}
