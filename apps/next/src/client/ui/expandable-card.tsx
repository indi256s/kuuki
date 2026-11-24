'use client'

import clsx from 'clsx'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronIcon } from './icon-morph'
import './expandable-card.css'

type Rolled = { text: string; keys: Set<string>; fresh: Set<string> }
const wordsOf = (text: string) =>
  text.split(/(\s+)/).map((word, index) => ({ key: `${index}:${word}`, word }))

function RollingText({ text }: { text: string }) {
  const [state, setState] = useState<Rolled>(() => ({
    text,
    keys: new Set(wordsOf(text).map((word) => word.key)),
    fresh: new Set(),
  }))
  const words = wordsOf(text)
  let current = state
  if (state.text !== text) {
    const keys = words.map((word) => word.key)
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
        {words.map(({ key, word }) => (
          <span
            key={key}
            className="ui-xcard-word"
            data-roll={current.fresh.has(key) ? 'true' : undefined}
          >
            {word}
          </span>
        ))}
      </span>
    </span>
  )
}

export interface ExpandableCardProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  direction?: 'down' | 'up'
  onTrigger?: () => void
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

  const opens = Boolean(children) || Boolean(onTrigger)
  const summary = (
    <>
      {icon ? <span className="ui-xcard-icon">{icon}</span> : null}
      <span className="ui-xcard-copy">
        <span className="ui-xcard-title">{title}</span>
        {description ? (
          <span className="ui-xcard-description">
            {typeof description === 'string' ? <RollingText text={description} /> : description}
          </span>
        ) : null}
      </span>
    </>
  )

  return (
    <div
      className={clsx('ui-xcard', className)}
      data-expanded={expanded ? 'true' : undefined}
      data-direction={direction}
      onKeyDown={onKeyDown}
    >
      <div className="ui-xcard-head">
        {opens ? (
          <button
            ref={trigger}
            type="button"
            className="ui-xcard-trigger"
            aria-haspopup={onTrigger ? 'dialog' : undefined}
            aria-expanded={onTrigger ? undefined : expanded}
            aria-controls={onTrigger ? undefined : panelId}
            onClick={() => (onTrigger ? onTrigger() : toggle(!expanded))}
          >
            {summary}
            <span className="ui-xcard-chevron" aria-hidden="true">
              <ChevronIcon state={expanded} size={18} strokeWidth={2} />
            </span>
          </button>
        ) : (
          <div className="ui-xcard-trigger" data-static="true">
            {summary}
          </div>
        )}
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
