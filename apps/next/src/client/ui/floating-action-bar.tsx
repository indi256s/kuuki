'use client'

import type { ReactNode } from 'react'
import './ui.css'

export type FloatingActionBarProps = {
  /** Accessible name of the region, e.g. "Selection actions". */
  label: string
  /** Already-formatted, pluralized count text, e.g. «Выбрано: 3». */
  countLabel: ReactNode
  /** Primary action, Cancel, etc. */
  children: ReactNode
}

/** Level-2 sticky bar. Sticks to the bottom of the scroll container, above the safe area; it does not push content. */
export function FloatingActionBar({ label, countLabel, children }: FloatingActionBarProps) {
  return (
    <div className="ui-action-bar" role="region" aria-label={label}>
      <span className="ui-action-bar-count" aria-live="polite">{countLabel}</span>
      <div className="ui-action-bar-actions">{children}</div>
    </div>
  )
}
