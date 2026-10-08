import type { CSSProperties } from 'react'
import './ui.css'

export function Skeleton({ height, label }: { height: CSSProperties['height']; label: string }) {
  return <div className="ui-skeleton" role="region" aria-label={label} aria-busy="true" style={{ height }} />
}
