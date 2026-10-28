'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from '@keyline-icons/react'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'
import { BottomSheet, type BottomSheetProps } from './bottom-sheet'
import { rubberBand } from './sheet-physics'
import { useKeyboardMotion } from './use-keyboard-motion'
import './ui.css'

/** Release past this share of the sheet's size dismisses it. */
export const DISMISS_RATIO = 0.35
/** Release faster than this (px/ms, in the dismissing direction) dismisses it. */
export const DISMISS_VELOCITY = 0.11

/** Pure release decision. `distance` and `velocity` are measured in the dismissing direction (down / right). */
export function shouldDismiss({
  distance,
  height,
  velocity,
}: {
  distance: number
  height: number
  velocity: number
}): boolean {
  if (distance <= 0) return false
  return velocity > DISMISS_VELOCITY || (height > 0 && distance >= height * DISMISS_RATIO)
}

export type SheetProps = Pick<
  BottomSheetProps,
  'detents' | 'initialDetent' | 'onDetentChange' | 'titleAction' | 'onEscapeKeyDown'
> & {
  initialFocusRef?: RefObject<HTMLElement | null>
  onCloseAutoFocus?: (event: Event) => void
  className?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** `bottom` on mobile, `right` on desktop. */
  side?: 'bottom' | 'right'
  trigger?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** Visible, keyboard-reachable alternative to dragging. */
  closeLabel?: string
}

type Sample = { t: number; p: number }

export function Sheet({ open, onOpenChange, trigger, ...contentProps }: SheetProps) {
  const keyboard = useKeyboardMotion(open)
  if (contentProps.side !== 'right') {
    return (
      <BottomSheet {...contentProps} open={open} onOpenChange={onOpenChange} trigger={trigger} />
    )
  }
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="ui-overlay" data-instant={keyboard ? '' : undefined} />
        <SideSheetContent
          {...contentProps}
          open={open}
          instant={keyboard}
          trigger={trigger}
          onOpenChange={onOpenChange}
        />
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/**
 * The desktop `right` sheet. Every other side renders BottomSheet. `ref` is the Portal's Presence ref: it must reach the
 * Content node, or Presence cannot see the exit animation and unmounts the sheet at once.
 */
function SideSheetContent({
  ref,
  open,
  onOpenChange,
  title,
  titleAction,
  description,
  trigger,
  children,
  footer,
  closeLabel = 'Close',
  className = '',
  initialFocusRef,
  onCloseAutoFocus,
  onEscapeKeyDown,
  instant,
}: Omit<SheetProps, 'side'> & { ref?: Ref<HTMLDivElement>; instant: boolean }) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const setContent = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )
  // Reopened during a drag-dismiss exit: Presence keeps this node, so drop the dragged offset before the enter plays.
  useLayoutEffect(() => {
    if (open && contentRef.current) contentRef.current.style.transform = ''
  }, [open])
  // Capture each Portal mount before a child autoFocus can replace the opener, as Dialog does.
  const [opener] = useState(() => {
    if (typeof document === 'undefined') return null
    const active = document.activeElement
    return active instanceof HTMLElement && active !== document.body ? active : null
  })
  const titleRef = useRef<HTMLHeadingElement>(null)
  const drag = useRef<{ id: number; start: number; samples: Sample[] } | null>(null)

  const setOffset = (px: number) => {
    if (contentRef.current) contentRef.current.style.transform = `translateX(${px}px)`
  }
  const setDragging = (on: boolean) => {
    if (contentRef.current) contentRef.current.dataset.dragging = String(on)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const p = event.clientX
    drag.current = { id: event.pointerId, start: p, samples: [{ t: event.timeStamp, p }] }
    setDragging(true)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== event.pointerId) return
    const p = event.clientX
    d.samples.push({ t: event.timeStamp, p })
    if (d.samples.length > 8) d.samples.shift()
    const delta = p - d.start
    setOffset(delta >= 0 ? delta : -rubberBand(-delta))
  }
  const finish = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current
    if (!d || d.id !== event.pointerId) return
    drag.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setDragging(false)
    const p = event.clientX
    const distance = p - d.start
    // Velocity over roughly the last 100ms of movement.
    const last = { t: event.timeStamp, p }
    const from = d.samples.find((s) => last.t - s.t <= 100) ?? d.samples[d.samples.length - 1]
    const elapsed = from ? last.t - from.t : 0
    const velocity = from && elapsed > 0 ? (last.p - from.p) / elapsed : 0
    const size = contentRef.current?.getBoundingClientRect().width ?? 0
    if (!cancelled && shouldDismiss({ distance, height: size, velocity })) onOpenChange(false) // exit animation starts from the dragged offset
    else setOffset(0) // transition settles it back with --ease-drawer
  }

  return (
    <RadixDialog.Content
      ref={setContent}
      className={`ui-sheet ${className}`}
      data-side="right"
      data-instant={instant ? '' : undefined}
      {...(description ? {} : { 'aria-describedby': undefined })}
      onEscapeKeyDown={onEscapeKeyDown}
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
    >
      <div
        className="ui-sheet-handle"
        data-testid="sheet-handle"
        aria-hidden="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finish(event, false)}
        onPointerCancel={(event) => finish(event, true)}
      />
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
        {titleAction}
        <RadixDialog.Close className="ui-icon-button" aria-label={closeLabel}>
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </RadixDialog.Close>
      </div>
      <div className="ui-panel-body">{children}</div>
      {footer ? <div className="ui-panel-footer">{footer}</div> : null}
    </RadixDialog.Content>
  )
}
