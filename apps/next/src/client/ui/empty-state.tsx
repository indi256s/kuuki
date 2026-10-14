'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import './empty-state.css'

// Adapted from Arc "empty-state" (uiarc.dev, MIT, see ARC-LICENSE.txt): the centred title, one line of description and the action below.
// Dropped: `motion` (text swaps, height spring), the icon tile and its entrance. There is no icon here; the copy and the one action carry the state.

export type EmptyStateProps = {
  title: string
  description?: string
  /** The one next step, e.g. a Button. */
  action?: ReactNode
  className?: string
  /** Optional accessible name for the region. */
  label?: string
  /** The title's heading level; pick the one that follows the page's outline. */
  headingLevel?: 2 | 3
}

export function EmptyState({
  title,
  description,
  action,
  className,
  label,
  headingLevel = 3,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section className={clsx('ui-empty', className)} aria-label={label}>
      <Heading className="ui-empty-title">{title}</Heading>
      {description ? <p className="ui-empty-description">{description}</p> : null}
      {action ? <div className="ui-empty-action">{action}</div> : null}
    </section>
  )
}
