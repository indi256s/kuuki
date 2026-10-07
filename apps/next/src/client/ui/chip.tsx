'use client'

import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import './ui.css'

export type ChipProps = {
  label: string
  swatch?: ReactNode
  onOpen: () => void
  onRemove: () => void
  removeLabel: string
}

export function Chip({ label, swatch, onOpen, onRemove, removeLabel }: ChipProps) {
  return <span className="ui-chip">
    <button type="button" className="ui-chip-body" onClick={onOpen}>
      {swatch ? <span className="ui-chip-swatch" aria-hidden="true">{swatch}</span> : null}
      <span className="ui-chip-label">{label}</span>
    </button>
    <button type="button" className="ui-chip-remove" onClick={onRemove} aria-label={removeLabel}><X size={14} aria-hidden="true" /></button>
  </span>
}
