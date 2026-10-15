'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check } from '@keyline-icons/react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useTransitionPresence } from './use-transition-presence'
import './ui.css'

export type MenuProps = {
  /** The element that opens the menu (rendered as-is via asChild; must be a button). */
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  sideOffset?: number
  alignOffset?: number
  /** Added to the content's `ui-menu` class. */
  className?: string
  /** Tints the shield with the sheet scrim: always, or only at the mobile breakpoint (700px and below). */
  scrim?: 'always' | 'mobile'
  /** Hides the content while its trigger is scrolled out of view. */
  hideWhenDetached?: boolean
  /** Skips the content's enter and exit motion, for a close that a navigation causes. */
  instant?: boolean
  /** Names the menu by one of its own elements instead of its trigger (whose name may change while open). */
  labelledBy?: string
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
  sideOffset = 6,
  alignOffset,
  className,
  scrim,
  hideWhenDetached,
  instant,
  labelledBy,
}: MenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  // A menu opened or closed from the keyboard skips its motion: people do that many times a day.
  const [keyboard, setKeyboard] = useState(false)
  const isOpen = open ?? uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (open === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  // Radix closes on Escape from a document capture listener, so a key is recorded on window first: the close renders
  // without motion from the start instead of cancelling a running exit, which would leave the menu mounted. A pointer
  // never clears the flag while open, so a keyboard-opened menu does not replay its entrance.
  useEffect(() => {
    if (!isOpen) return
    const key = () => setKeyboard(true)
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [isOpen])
  const still = keyboard || instant ? '' : undefined
  const content = useRef<HTMLDivElement>(null)
  const shield = useRef<HTMLDivElement>(null)
  const contentPresent = useTransitionPresence(content, isOpen, still !== undefined)
  const shieldPresent = useTransitionPresence(shield, isOpen, !scrim || still !== undefined)
  return (
    <DropdownMenu.Root modal={false} open={isOpen} onOpenChange={setOpen}>
      {shieldPresent ? (
        <MenuShield
          node={shield}
          open={isOpen}
          scrim={scrim}
          instant={still}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
      <DropdownMenu.Trigger
        asChild
        onPointerDown={() => setKeyboard(false)}
        onKeyDown={() => setKeyboard(true)}
      >
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal forceMount={contentPresent || undefined}>
        <DropdownMenu.Content
          ref={content}
          inert={!isOpen || undefined}
          className={className ? `ui-menu ${className}` : 'ui-menu'}
          data-instant={still}
          // Radix names the menu after its trigger; an explicit undefined would erase that.
          {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
          align={align}
          side={side}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          collisionPadding={8}
          hideWhenDetached={hideWhenDetached}
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
  open,
  scrim,
  instant,
  onDismiss,
}: {
  node: RefObject<HTMLDivElement | null>
  open: boolean
  scrim?: 'always' | 'mobile'
  instant?: string
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
    <div
      ref={node}
      className="ui-menu-shield"
      data-state={open ? 'open' : 'closed'}
      data-scrim={scrim}
      data-instant={instant}
      aria-hidden="true"
    />,
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

export function MenuGroup(props: ComponentProps<typeof DropdownMenu.Group>) {
  return <DropdownMenu.Group {...props} className="ui-menu-group" />
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="ui-menu-separator" />
}

export function MenuLabel(props: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label {...props} className="ui-menu-label" />
}

export type MenuTrayOption<T extends string> = {
  value: T
  /** Visible text, or the accessible name of a swatch. */
  label: string
  /** A colour for a swatch cell; the label is then accessible-only. */
  swatch?: string
  /** The check colour on that swatch; defaults to the page background. */
  swatchInk?: string
  /** An icon for the cell; the label is then accessible-only. */
  icon?: ReactNode
}

/**
 * A preference picked in place inside a menu, as a radio group with one stop in the menu's Up/Down order: only the
 * selected cell is a menu item. Left and Right select the neighbour at once, and no pick closes the menu. The cells
 * share the tray's width equally and one thumb slides under the selected cell. Swatch and icon cells keep their name
 * for assistive tech; a swatch adds a check. `hideLabel` keeps the row label accessible-only.
 */
export function MenuTray<T extends string>({
  label,
  value,
  options,
  onValueChange,
  hideLabel,
}: {
  label: string
  value: T
  options: readonly MenuTrayOption<T>[]
  onValueChange: (value: T) => void
  hideLabel?: boolean
}) {
  const id = useId()
  const selected = useRef<HTMLDivElement>(null)
  // The pick shows at once, before the caller's preference event re-renders the menu.
  const [current, setCurrent] = useState(value)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setCurrent(value)
  }
  // A value the caller puts back (a failed save) swaps the focused cell for a span; focus moves to the new item.
  const focused = useRef(false)
  useLayoutEffect(() => {
    if (focused.current && document.activeElement === document.body) selected.current?.focus()
  }, [current])
  const pick = (next: T) => {
    if (next === current) return
    setCurrent(next)
    onValueChange(next)
  }
  // The selected cell is the only menu item, so focus follows the pick into its new cell.
  const choose = (next: T) => {
    flushSync(() => pick(next))
    selected.current?.focus()
  }
  const step = (event: KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const index = options.findIndex((option) => option.value === current)
    choose(options[(index + delta + options.length) % options.length].value)
  }
  const kind = options.some((option) => option.swatch)
    ? 'swatch'
    : options.some((option) => option.icon)
      ? 'icon'
      : 'text'
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === current),
  )
  return (
    <DropdownMenu.RadioGroup
      className="ui-menu-tray-row"
      aria-labelledby={id}
      value={current}
      onValueChange={(next) => pick(next as T)}
    >
      <span id={id} className={hideLabel ? 'sr-only' : 'ui-menu-tray-label'}>
        {label}
      </span>
      <span
        className="ui-menu-tray"
        data-kind={kind}
        style={{ '--n': options.length, '--i': index } as CSSProperties}
      >
        <span className="ui-menu-tray-thumb" aria-hidden="true" />
        {options.map((option) => {
          const content = option.swatch ? (
            <span
              className="ui-menu-tray-dot"
              style={
                { '--swatch': option.swatch, '--swatch-ink': option.swatchInk } as CSSProperties
              }
              aria-hidden="true"
            >
              {option.value === current ? <Check size={12} strokeWidth={3} /> : null}
            </span>
          ) : (
            (option.icon ?? option.label)
          )
          const name = option.swatch || option.icon ? option.label : undefined
          return option.value === current ? (
            <DropdownMenu.RadioItem
              key={option.value}
              ref={selected}
              value={option.value}
              className="ui-menu-tray-cell"
              aria-label={name}
              onSelect={(event) => event.preventDefault()}
              onKeyDown={step}
              onFocus={() => {
                focused.current = true
              }}
              onBlur={(event) => {
                if (event.relatedTarget) focused.current = false
              }}
            >
              {content}
            </DropdownMenu.RadioItem>
          ) : (
            <span
              key={option.value}
              role="menuitemradio"
              aria-checked="false"
              aria-label={name}
              tabIndex={-1}
              className="ui-menu-tray-cell"
              onClick={() => choose(option.value)}
            >
              {content}
            </span>
          )
        })}
      </span>
    </DropdownMenu.RadioGroup>
  )
}
