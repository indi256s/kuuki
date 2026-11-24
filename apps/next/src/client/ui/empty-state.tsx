'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import './empty-state.css'

export type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  label?: string
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
