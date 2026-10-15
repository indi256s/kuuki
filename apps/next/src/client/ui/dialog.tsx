'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from '@keyline-icons/react'
import { useLayoutEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { useKeyboardMotion } from './use-keyboard-motion'
import { useTransitionPresence } from './use-transition-presence'
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
  const keyboard = useKeyboardMotion(open)
  const content = useRef<HTMLDivElement>(null)
  const present = useTransitionPresence(content, open, keyboard)
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (dismissible || next) onOpenChange(next)
      }}
    >
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal forceMount={present || undefined}>
        <RadixDialog.Overlay
          className="ui-overlay ui-dialog-overlay"
          data-instant={keyboard ? '' : undefined}
        />
        <MountedDialogContent
          {...contentProps}
          ref={content}
          trigger={trigger}
          dismissible={dismissible}
          instant={keyboard}
          open={open}
        />
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
  instant,
  open,
}: Omit<DialogProps, 'onOpenChange'> & { ref?: Ref<HTMLDivElement>; instant: boolean }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const focused = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(open)
  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      const target = focused.current?.isConnected
        ? focused.current
        : (initialFocusRef?.current ?? titleRef.current)
      target?.focus()
    }
    wasOpen.current = open
  }, [open, initialFocusRef])
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
      inert={!open || undefined}
      data-instant={instant ? '' : undefined}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLElement) focused.current = event.target
      }}
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
