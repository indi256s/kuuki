'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from '@keyline-icons/react'
import { useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
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

export function Dialog({
  open,
  onOpenChange,
  trigger,
  dismissible = true,
  ...contentProps
}: DialogProps) {
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (dismissible || next) onOpenChange(next)
      }}
    >
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="ui-overlay" />
        <MountedDialogContent {...contentProps} trigger={trigger} dismissible={dismissible} />
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

function MountedDialogContent({
  ref,
  title,
  description,
  trigger,
  children,
  footer,
  closeLabel = 'Close',
  dismissible,
  initialFocusRef,
  onCloseAutoFocus,
  className = '',
}: Omit<DialogProps, 'open' | 'onOpenChange'> & { ref?: Ref<HTMLDivElement> }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  // Capture each Portal mount before a child autoFocus can replace the opener.
  const [opener] = useState(() => {
    if (typeof document === 'undefined') return null
    const active = document.activeElement
    return active instanceof HTMLElement && active !== document.body ? active : null
  })
  return (
    <RadixDialog.Content
      ref={ref}
      className={`ui-dialog ${className}`}
      {...(description ? {} : { 'aria-describedby': undefined })}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event)
        if (!event.defaultPrevented && !trigger && opener?.isConnected) {
          event.preventDefault()
          opener.focus()
        }
      }}
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        ;(initialFocusRef?.current ?? titleRef.current)?.focus()
      }}
      onEscapeKeyDown={(event) => {
        if (!dismissible) event.preventDefault()
      }}
      onPointerDownOutside={(event) => {
        if (!dismissible) event.preventDefault()
      }}
      onInteractOutside={(event) => {
        if (!dismissible) event.preventDefault()
      }}
    >
      <div className="ui-panel-header">
        <div>
          <RadixDialog.Title ref={titleRef} tabIndex={-1} className="ui-panel-title">
            {title}
          </RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="ui-panel-description">
              {description}
            </RadixDialog.Description>
          ) : null}
        </div>
        {dismissible ? (
          <RadixDialog.Close className="ui-icon-button" aria-label={closeLabel}>
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </RadixDialog.Close>
        ) : null}
      </div>
      <div className="ui-panel-body">{children}</div>
      {footer ? <div className="ui-panel-footer">{footer}</div> : null}
    </RadixDialog.Content>
  )
}
