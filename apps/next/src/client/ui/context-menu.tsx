'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal } from '@keyline-icons/react'
import {
  createContext,
  useContext,
  useRef,
  useState,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { MenuItem } from './menu'
import './arc-interactions.css'

export type ContextMenuItem = {
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
}

type Point = { x: number; y: number }
type MenuContextValue = { open: boolean; openFrom: (element: HTMLElement) => void }
const MenuContext = createContext<MenuContextValue | null>(null)

export type ContextMenuProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'onContextMenu' | 'onKeyDown'
> & {
  label: string
  items: ContextMenuItem[]
  reason?: ReactNode
  returnFocus?: () => HTMLElement | null | undefined
  children: ReactNode
}

export function ContextMenu({
  label,
  items,
  reason,
  returnFocus,
  children,
  ...rest
}: ContextMenuProps) {
  const [open, setOpen] = useState(false)
  const [point, setPoint] = useState<Point>({ x: 0, y: 0 })
  const pendingAction = useRef<(() => void) | null>(null)
  const anchor = useRef<HTMLSpanElement>(null)
  const show = (at: Point) => {
    const element = anchor.current
    let origin = { left: 0, top: 0 }
    if (element) {
      const { left, top } = element.style
      element.style.left = element.style.top = '0px'
      origin = element.getBoundingClientRect()
      Object.assign(element.style, { left, top })
    }
    setPoint({ x: at.x - origin.left, y: at.y - origin.top })
    pendingAction.current = null
    setOpen(true)
  }
  const openFrom = (element: HTMLElement) => {
    const box = element.getBoundingClientRect()
    show({ x: box.left + Math.min(box.width, 24) / 2, y: box.bottom })
  }
  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.shiftKey ||
      (event.target as HTMLElement).closest(
        'input, textarea, select, [contenteditable], [data-native-menu]',
      )
    )
      return
    event.preventDefault()
    show({ x: event.clientX, y: event.clientY })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('input, textarea, select, [contenteditable]')) return
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault()
      openFrom(target)
    }
  }
  return (
    <MenuContext.Provider value={{ open, openFrom }}>
      <div {...rest} onContextMenu={onContextMenu} onKeyDown={onKeyDown}>
        {children}
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger asChild>
            <span
              ref={anchor}
              className="arc-context-anchor"
              aria-hidden="true"
              style={{ left: point.x, top: point.y }}
            />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="ui-menu arc-context-menu"
              aria-label={label}
              align="start"
              side="bottom"
              sideOffset={4}
              collisionPadding={8}
              avoidCollisions
              onCloseAutoFocus={(event) => {
                event.preventDefault()
                const action = pendingAction.current
                pendingAction.current = null
                if (action) action()
                else returnFocus?.()?.focus()
              }}
            >
              <DropdownMenu.Arrow width={0} height={0} aria-hidden="true" />
              {items.map((item) => (
                <MenuItem
                  key={item.id}
                  danger={item.danger}
                  disabled={item.disabled}
                  onSelect={() => {
                    pendingAction.current = item.onSelect
                  }}
                >
                  {item.label}
                </MenuItem>
              ))}
              {reason && items.some((item) => item.disabled) && (
                <p className="arc-context-reason">{reason}</p>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </MenuContext.Provider>
  )
}

export function ContextMenuButton({ label, className }: { label: string; className?: string }) {
  const menu = useContext(MenuContext)
  if (!menu) throw new Error('ContextMenuButton must sit inside a ContextMenu')
  return (
    <button
      type="button"
      className={['arc-context-button', className].filter(Boolean).join(' ')}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={menu.open}
      onClick={(event) => menu.openFrom(event.currentTarget)}
    >
      <MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
