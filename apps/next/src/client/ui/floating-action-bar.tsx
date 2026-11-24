'use client'

import type { ReactNode } from 'react'
import './ui.css'

export type FloatingActionBarProps = {
  label: string
  countLabel: ReactNode
  children: ReactNode
}

export function FloatingActionBar({ label, countLabel, children }: FloatingActionBarProps) {
  return (
    <div className="ui-action-bar" role="region" aria-label={label}>
      <span className="ui-action-bar-count" aria-live="polite">
        {countLabel}
      </span>
      <div className="ui-action-bar-actions">{children}</div>
    </div>
  )
}
