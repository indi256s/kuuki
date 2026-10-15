'use client'

import * as RadixPopover from '@radix-ui/react-popover'
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTransitionPresence } from './use-transition-presence'
import './ui.css'

const PopoverState = createContext({ open: false, keyboard: false })

export function PopoverRoot({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ...props
}: RadixPopover.PopoverProps) {
  const [uncontrolledOpen, setOpen] = useState(defaultOpen)
  const [keyboard, setKeyboard] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  useEffect(() => {
    const key = () => setKeyboard(true)
    const pointer = () => {
      if (!open) setKeyboard(false)
    }
    window.addEventListener('keydown', key, true)
    window.addEventListener('pointerdown', pointer, true)
    return () => {
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('pointerdown', pointer, true)
    }
  }, [open])
  return (
    <PopoverState.Provider value={{ open, keyboard }}>
      <RadixPopover.Root
        {...props}
        open={open}
        onOpenChange={(next) => {
          if (controlledOpen === undefined) setOpen(next)
          onOpenChange?.(next)
        }}
      />
    </PopoverState.Provider>
  )
}
export const PopoverTrigger = RadixPopover.Trigger
export const PopoverAnchor = RadixPopover.Anchor

export const PopoverContent = forwardRef<HTMLDivElement, RadixPopover.PopoverContentProps>(
  function PopoverContent(props, ref) {
    const { open, keyboard } = useContext(PopoverState)
    const content = useRef<HTMLDivElement>(null)
    const present = useTransitionPresence(content, open, keyboard)
    const setRef = useCallback(
      (node: HTMLDivElement | null) => {
        content.current = node
        if (typeof ref === 'function') return ref(node)
        if (ref) ref.current = node
      },
      [ref],
    )
    return (
      <RadixPopover.Portal forceMount={props.forceMount || present || undefined}>
        <MountedPopoverContent {...props} ref={setRef} data-instant={keyboard ? '' : undefined} />
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
    const { open } = useContext(PopoverState)
    const [wasOpen, setWasOpen] = useState(open)
    const [opener, setOpener] = useState(() => {
      if (typeof document === 'undefined') return null
      const active = document.activeElement
      return active instanceof HTMLElement && active !== document.body ? active : null
    })
    if (open !== wasOpen) {
      setWasOpen(open)
      if (open) {
        const active = document.activeElement
        setOpener(active instanceof HTMLElement && active !== document.body ? active : null)
      }
    }
    return (
      <RadixPopover.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={`ui-popover ${className}`}
        {...props}
        inert={!open || undefined}
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
