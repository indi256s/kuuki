'use client'

import type { ReactNode } from 'react'
import './filter-toolbar.css'

export type FilterToolbarProps = {
  label: string
  search?: ReactNode
  actions?: ReactNode
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
