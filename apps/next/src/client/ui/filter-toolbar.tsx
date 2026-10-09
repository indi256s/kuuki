'use client'

import type { ReactNode } from 'react'
import './filter-toolbar.css'

// Adapted from Arc "filter-toolbar" (uiarc.dev, MIT, see ARC-LICENSE.txt): the toolbar row of applied-filter chips with a trailing actions area.
// Dropped: the Add filter menu morph, the animated "Clear all", the empty note, the live status and the `motion` package.
// The caller owns filters and query normalisation; this is layout only. Put `ChipGroup` (chip-group.tsx) in `children`.

export type FilterToolbarProps = {
  /** Accessible name of the whole toolbar, for example "Journal filters". */
  label: string
  /** Search field. Grows to fill the row and drops to its own line when the row is narrow. */
  search?: ReactNode
  /** Trailing controls such as sort or view options. Wraps under the chips when there is no room. */
  actions?: ReactNode
  /** The chips, usually one `ChipGroup`. */
  children?: ReactNode
  className?: string
}

export function FilterToolbar({
  label,
  search,
  actions,
  children,
  className = '',
}: FilterToolbarProps) {
  return (
    <div role="group" aria-label={label} className={`ui-filter-toolbar ${className}`.trim()}>
      {search ? <div className="ui-filter-toolbar-search">{search}</div> : null}
      {children}
      {actions ? <div className="ui-filter-toolbar-actions">{actions}</div> : null}
    </div>
  )
}
