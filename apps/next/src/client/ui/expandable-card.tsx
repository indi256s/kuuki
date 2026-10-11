'use client'

import clsx from 'clsx'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronIcon } from './icon-morph'
import './expandable-card.css'

// Adapted from Arc "expandable-card" (uiarc.dev, MIT, see ARC-LICENSE.txt): one header button that opens a details panel
// kept mounted (inert while closed), a summary whose changed words rise in place while unchanged words hold still, a
// chevron that turns with the state, and Escape closing it with focus back on the header.
// Changed for Kuuki: CSS replaces `motion` (a grid-row height transition and opacity, Kuuki tokens, no width morph), the
// panel can open upward from a bottom-anchored card, actions sit beside the header button instead of inside it, the
// open state can be controlled, and `onTrigger` lets the header open something else (the phone sheet) instead. The
// upstream inset divider and tinted panel are gone: space groups the rows.

type Fresh = { text: string; keys: Set<string>; fresh: Set<string> }
const wordsOf = (text: string) => text.split(/(\s+)/).map((word, index) => `${index}:${word}`)

function RollingText({ text }: { text: string }) {
  const [state, setState] = useState<Fresh>(() => ({
    text,
    keys: new Set(wordsOf(text)),
    fresh: new Set(),
  }))
  let current = state
  if (state.text !== text) {
    const keys = wordsOf(text)
    current = {
      text,
      keys: new Set(keys),
      fresh: new Set(keys.filter((key) => !state.keys.has(key))),
    }
    setState(current)
  }
  return (
    <span className="ui-xcard-roll">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {wordsOf(text).map((key) => (
          <span
            key={key}
            className="ui-xcard-word"
            data-roll={current.fresh.has(key) ? 'true' : undefined}
          >
            {key.slice(key.indexOf(':') + 1)}
          </span>
        ))}
      </span>
    </span>
  )
}

export interface ExpandableCardProps {
  /** The one-line summary. */
  title: ReactNode
  /** A second line; changed words rise in place. */
  description?: string
  /** Leading mark inside the header button. */
  icon?: ReactNode
  /** Controls beside the header button (an action, a dismiss). */
  actions?: ReactNode
  children?: ReactNode
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  /** `up` puts the panel above the header, for a card anchored to the bottom of the screen. */
  direction?: 'down' | 'up'
  /** When set, the header calls this instead of opening the panel (it opens a sheet or dialog). */
  onTrigger?: () => void
  /** Accessible name of the header when it opens something else. */
  triggerLabel?: string
  className?: string
}

export function ExpandableCard({
  title,
  description,
  icon,
  actions,
  children,
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  direction = 'down',
  onTrigger,
  triggerLabel,
  className,
}: ExpandableCardProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultExpanded)
  const expanded = onTrigger ? false : (expandedProp ?? uncontrolled)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const toggle = (next: boolean) => {
    if (expandedProp === undefined) setUncontrolled(next)
    onExpandedChange?.(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.key !== 'Escape' || !expanded) return
    event.preventDefault()
    toggle(false)
    trigger.current?.focus()
  }

  return (
    <div
      className={clsx('ui-xcard', className)}
      data-expanded={expanded ? 'true' : undefined}
      data-direction={direction}
      onKeyDown={onKeyDown}
    >
      <div className="ui-xcard-head">
        <button
          ref={trigger}
          type="button"
          className="ui-xcard-trigger"
          aria-label={onTrigger ? triggerLabel : undefined}
          aria-haspopup={onTrigger ? 'dialog' : undefined}
          aria-expanded={onTrigger ? undefined : expanded}
          aria-controls={onTrigger || !children ? undefined : panelId}
          onClick={() => (onTrigger ? onTrigger() : toggle(!expanded))}
        >
          {icon ? <span className="ui-xcard-icon">{icon}</span> : null}
          <span className="ui-xcard-copy">
            <span className="ui-xcard-title">{title}</span>
            {description ? (
              <span className="ui-xcard-description">
                <RollingText text={description} />
              </span>
            ) : null}
          </span>
          {children || onTrigger ? (
            <span className="ui-xcard-chevron" aria-hidden="true">
              <ChevronIcon state={expanded} size={18} strokeWidth={2} />
            </span>
          ) : null}
        </button>
        {actions ? <div className="ui-xcard-actions">{actions}</div> : null}
      </div>
      {children && !onTrigger ? (
        <div id={panelId} className="ui-xcard-panel" inert={!expanded}>
          <div className="ui-xcard-panel-inner">{children}</div>
        </div>
      ) : null}
    </div>
  )
}
