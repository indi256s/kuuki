'use client'

import { ChevronIcon } from './icon-morph'
import { useId, useState, type ReactNode } from 'react'
import './ui.css'

export type DisclosureProps = {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** `row`: a full-width row with the chevron at the end. The default stays a fit-content trigger. */
  layout?: 'inline' | 'row'
  /** One line under the summary on a `row`, shown only while closed (what is inside, or what was filled). */
  description?: ReactNode
}

/** Layout snaps before the content fades in. Collapsed content is inert and hidden. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  open: controlled,
  onOpenChange,
  layout = 'inline',
  description,
}: DisclosureProps) {
  const [own, setOwn] = useState(defaultOpen)
  const open = controlled ?? own
  const id = useId()
  const toggle = () => {
    const next = !open
    setOwn(next)
    onOpenChange?.(next)
  }
  return (
    <div className="ui-disclosure" data-layout={layout}>
      <button
        type="button"
        className="ui-disclosure-trigger"
        id={`${id}-t`}
        aria-expanded={open}
        aria-controls={id}
        aria-labelledby={layout === 'row' ? `${id}-s` : undefined}
        aria-describedby={layout === 'row' && description && !open ? `${id}-d` : undefined}
        onClick={toggle}
      >
        {layout === 'row' ? (
          <span className="ui-disclosure-text">
            <span id={`${id}-s`} className="ui-disclosure-summary">
              {summary}
            </span>
            {description && !open ? (
              <span id={`${id}-d`} className="ui-disclosure-description">
                {description}
              </span>
            ) : null}
          </span>
        ) : (
          summary
        )}
        <span className="ui-disclosure-chevron" aria-hidden="true">
          <ChevronIcon state={open} size={layout === 'row' ? 20 : 18} strokeWidth={2} />
        </span>
      </button>
      <div className="ui-disclosure-panel" data-open={open ? 'true' : 'false'}>
        <div
          id={id}
          className="ui-disclosure-inner"
          aria-hidden={open ? undefined : true}
          inert={!open}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
