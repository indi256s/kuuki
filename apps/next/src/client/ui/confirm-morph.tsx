'use client'

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from './button'
import './arc-interactions.css'

// Adapted from Arc "confirm-morph" (uiarc.dev, MIT, see ARC-LICENSE.txt): the destructive action asks in place instead of in a dialog, with Cancel and
// Confirm side by side. Arc's own pending, done and countdown faces are not used. The caller's deferred delete is the only timer and owns Undo,
// so this component only asks, and a confirmed answer hands the work to it.

export type ConfirmMorphProps = {
  open: boolean
  /** Names the object: "Delete TBS to IST, April 3, 2025?" */
  prompt: ReactNode
  /** What will happen, in plain words. */
  consequence: ReactNode
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** Blocks Confirm with a visible reason (offline, another deletion pending). */
  disabledReason?: ReactNode
  className?: string
}

/** Cancel takes focus when the question opens, Escape cancels, and Confirm is never the default action. */
export function ConfirmMorph({
  open,
  prompt,
  consequence,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  disabledReason,
  className,
}: ConfirmMorphProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const promptId = useId()
  const consequenceId = useId()
  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])
  if (!open) return null
  const keydown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
  }
  return (
    <div
      className={['arc-confirm', className].filter(Boolean).join(' ')}
      role="group"
      aria-labelledby={promptId}
      aria-describedby={consequenceId}
      onKeyDown={keydown}
    >
      <p id={promptId} className="arc-confirm-prompt">
        {prompt}
      </p>
      <p id={consequenceId} className="arc-confirm-consequence">
        {consequence}
      </p>
      <div className="arc-confirm-actions">
        <Button ref={cancelRef} dense onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button dense variant="danger" disabledReason={disabledReason} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
