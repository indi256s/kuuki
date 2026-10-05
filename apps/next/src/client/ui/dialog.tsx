'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useRef, type ReactNode, type RefObject } from 'react'
import './ui.css'

export type DialogProps = {
  className?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Optional trigger element (rendered as-is via asChild); focus returns to it on close. */
  trigger?: ReactNode
  children?: ReactNode
  /** Pinned below the scrolling body. */
  footer?: ReactNode
  closeLabel?: string
  /** false: no close button, Escape and outside clicks are ignored (used while an action is pending). */
  dismissible?: boolean
  /** Element to focus on open instead of the title (e.g. Cancel in a destructive confirm). */
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Runs when focus is about to return to the trigger; `preventDefault()` lets the caller place focus instead. */
  onCloseAutoFocus?: (event: Event) => void
}

export function Dialog({ open, onOpenChange, title, description, trigger, children, footer, closeLabel = 'Close', dismissible = true, initialFocusRef, onCloseAutoFocus, className = '' }: DialogProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  return (
    <RadixDialog.Root open={open} onOpenChange={next => { if (dismissible || next) onOpenChange(next) }}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="ui-overlay" />
        <RadixDialog.Content
          className={`ui-dialog ${className}`}
          {...(description ? {} : { 'aria-describedby': undefined })}
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={event => { event.preventDefault(); (initialFocusRef?.current ?? titleRef.current)?.focus() }}
          onEscapeKeyDown={event => { if (!dismissible) event.preventDefault() }}
          onPointerDownOutside={event => { if (!dismissible) event.preventDefault() }}
          onInteractOutside={event => { if (!dismissible) event.preventDefault() }}
        >
          <div className="ui-panel-header">
            <div>
              <RadixDialog.Title ref={titleRef} tabIndex={-1} className="ui-panel-title">{title}</RadixDialog.Title>
              {description ? <RadixDialog.Description className="ui-panel-description">{description}</RadixDialog.Description> : null}
            </div>
            {dismissible ? <RadixDialog.Close className="ui-icon-button" aria-label={closeLabel}><X size={20} strokeWidth={2} aria-hidden="true" /></RadixDialog.Close> : null}
          </div>
          <div className="ui-panel-body">{children}</div>
          {footer ? <div className="ui-panel-footer">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
