'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
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

/** Collision-aware: Radix flips and shifts the content to stay inside the viewport (8px padding). */
export function Menu({
  trigger,
  children,
  align = 'start',
  side = 'bottom',
  open,
  onOpenChange,
}: MenuProps) {
  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="ui-menu"
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          avoidCollisions
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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
