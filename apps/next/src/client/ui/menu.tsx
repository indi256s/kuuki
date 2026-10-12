'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check } from '@keyline-icons/react'
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import './ui.css'

export type MenuProps = {
  /** The element that opens the menu (rendered as-is via asChild; must be a button). */
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Collision-aware: Radix flips and shifts the content to stay inside the viewport (8px padding).
 * Non-modal, as the menu button pattern is: Radix's modal mode writes `pointer-events` and a scroll-lock custom
 * property on `body`, and both restyle every element on the page at each open and close. The shield keeps what modal
 * mode gave members: a press outside only closes the menu and never reaches the page or a parent sheet.
 */
export function Menu({
  trigger,
  children,
  align = 'start',
  side = 'bottom',
  open,
  onOpenChange,
}: MenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const shield = useRef<HTMLDivElement>(null)
  const isOpen = open ?? uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (open === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  return (
    <DropdownMenu.Root modal={false} open={isOpen} onOpenChange={setOpen}>
      {isOpen ? <MenuShield node={shield} onDismiss={() => setOpen(false)} /> : null}
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="ui-menu"
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          avoidCollisions
          // The shield's own click closes the menu, so it stays up until the press ends.
          onPointerDownOutside={(event) => {
            if (event.target === shield.current) event.preventDefault()
          }}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/**
 * Transparent layer under an open menu and over everything else, toasts included. The press still reaches Radix, so
 * its layer bookkeeping stays current: it renders inside any parent sheet's React tree, which therefore treats it as
 * inside and stays open. The click is stopped at the shield and closes the menu, and focus returns to the trigger as
 * on Escape.
 */
function MenuShield({
  node,
  onDismiss,
}: {
  node: RefObject<HTMLDivElement | null>
  onDismiss: () => void
}) {
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  })
  useEffect(() => {
    const shield = node.current
    if (!shield) return
    // Only a press that starts on the shield closes the menu: the tap that opened it can end with a click here.
    let armed = false
    const press = (event: Event) => {
      event.preventDefault()
      armed = true
    }
    const click = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      if (armed) dismiss.current()
      armed = false
    }
    shield.addEventListener('pointerdown', press)
    shield.addEventListener('click', click)
    return () => {
      shield.removeEventListener('pointerdown', press)
      shield.removeEventListener('click', click)
    }
  }, [node])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div ref={node} className="ui-menu-shield" aria-hidden="true" />,
    document.body,
  )
}

export function MenuItem({
  danger,
  ...props
}: ComponentProps<typeof DropdownMenu.Item> & { danger?: boolean }) {
  return (
    <DropdownMenu.Item
      {...props}
      className="ui-menu-item"
      data-variant={danger ? 'danger' : undefined}
    />
  )
}

export function MenuRadioGroup(props: ComponentProps<typeof DropdownMenu.RadioGroup>) {
  return <DropdownMenu.RadioGroup {...props} />
}

/** The check is a visible indicator in a reserved gutter, so the selected item never relies on color alone. */
export function MenuRadioItem({
  children,
  ...props
}: ComponentProps<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem {...props} className="ui-menu-item ui-menu-radio">
      <DropdownMenu.ItemIndicator className="ui-menu-check">
        <Check size={16} strokeWidth={2} aria-hidden="true" />
      </DropdownMenu.ItemIndicator>
      {children}
    </DropdownMenu.RadioItem>
  )
}

/** Toggle row with the same visible check gutter as radios, so on/off never relies on color alone. */
export function MenuCheckboxItem({
  children,
  ...props
}: ComponentProps<typeof DropdownMenu.CheckboxItem>) {
  return (
    <DropdownMenu.CheckboxItem {...props} className="ui-menu-item ui-menu-radio">
      <DropdownMenu.ItemIndicator className="ui-menu-check">
        <Check size={16} strokeWidth={2} aria-hidden="true" />
      </DropdownMenu.ItemIndicator>
      {children}
    </DropdownMenu.CheckboxItem>
  )
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="ui-menu-separator" />
}

export function MenuLabel(props: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label {...props} className="ui-menu-label" />
}
