'use client'

import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import './ui.css'

export type DisclosureProps = {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Height animates via grid rows 0fr -> 1fr. Collapsed content is `inert` (no focus, no AT) and `visibility:hidden` after the collapse. */
export function Disclosure({ summary, children, defaultOpen = false, open: controlled, onOpenChange }: DisclosureProps) {
  const [own, setOwn] = useState(defaultOpen)
  const open = controlled ?? own
  const id = useId()
  const toggle = () => { const next = !open; setOwn(next); onOpenChange?.(next) }
  return (
    <div className="ui-disclosure">
      <button type="button" className="ui-disclosure-trigger" id={`${id}-t`} aria-expanded={open} aria-controls={id} onClick={toggle}>
        {summary}
        <span className="ui-disclosure-chevron" aria-hidden="true"><ChevronDown size={18} strokeWidth={2} /></span>
      </button>
      <div className="ui-disclosure-panel" data-open={open ? 'true' : 'false'}>
        <div id={id} className="ui-disclosure-inner" role="region" aria-labelledby={`${id}-t`} aria-hidden={open ? undefined : true} inert={!open}>{children}</div>
      </div>
    </div>
  )
}
