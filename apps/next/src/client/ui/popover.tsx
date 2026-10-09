'use client'

import * as RadixPopover from '@radix-ui/react-popover'
import { forwardRef, useState } from 'react'
import './ui.css'

export const PopoverRoot = RadixPopover.Root
export const PopoverTrigger = RadixPopover.Trigger

export const PopoverContent = forwardRef<HTMLDivElement, RadixPopover.PopoverContentProps>(
  function PopoverContent(props, ref) {
    return (
      <RadixPopover.Portal>
        <MountedPopoverContent {...props} ref={ref} />
      </RadixPopover.Portal>
    )
  },
)

const MountedPopoverContent = forwardRef<HTMLDivElement, RadixPopover.PopoverContentProps>(
  function MountedPopoverContent(
    {
      align = 'start',
      sideOffset = 8,
      collisionPadding = 8,
      className = '',
      onOpenAutoFocus,
      onCloseAutoFocus,
      ...props
    },
    ref,
  ) {
    // Capture on each fresh Portal mount, before child autoFocus or ref callbacks run.
    const [opener] = useState(() => {
      if (typeof document === 'undefined') return null
      const active = document.activeElement
      return active instanceof HTMLElement && active !== document.body ? active : null
    })
    return (
      <RadixPopover.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={`ui-popover ${className}`}
        {...props}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          if (event.defaultPrevented || !opener) return
          // Radix runs this after unmount; an outside control may already own focus.
          if (
            document.activeElement === document.body ||
            (event.target instanceof HTMLElement && event.target.contains(document.activeElement))
          ) {
            if (opener.isConnected) opener.focus()
          }
          event.preventDefault()
        }}
      />
    )
  },
)
