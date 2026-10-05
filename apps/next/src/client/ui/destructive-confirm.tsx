'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Button } from './button'
import { Dialog } from './dialog'
import { Field } from './field'

export type DestructiveConfirmProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names the object: «Удалить рейс JFK → BOS, 3 янв 2026?» */
  title: ReactNode
  /** What will happen, in plain words. */
  consequence: ReactNode
  /** Verb plus object: «Удалить рейс». */
  confirmLabel: string
  cancelLabel: string
  /** Static text shown while pending (no spinner). */
  pendingLabel?: string
  closeLabel?: string
  /** Rejecting keeps the dialog open and shows `errorMessage`. */
  onConfirm: () => void | Promise<void>
  errorMessage?: string
  /** Optional typed confirmation for irreversible actions (the user must type this exactly). */
  typedConfirmation?: { phrase: string; label: string; mismatchReason: string }
  trigger?: ReactNode
  /** Runs when focus is about to return to where it was; `preventDefault()` lets the caller place focus instead. */
  onCloseAutoFocus?: (event: Event) => void
}

/** Dialog composition: Cancel has initial focus, the danger button never doubles as an icon, and closing is blocked while pending. */
export function DestructiveConfirm({ open, onOpenChange, title, consequence, confirmLabel, cancelLabel, pendingLabel, closeLabel, onConfirm, errorMessage, typedConfirmation, trigger, onCloseAutoFocus }: DestructiveConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [typed, setTyped] = useState('')
  // Reset whenever the dialog closes, whichever path closed it (adjusting state during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) { setWasOpen(open); if (!open) { setTyped(''); setFailed(false) } }
  const needsPhrase = typedConfirmation ? typed.trim() !== typedConfirmation.phrase : false

  const confirm = async () => {
    setPending(true)
    setFailed(false)
    try { await onConfirm(); setTyped('') } catch { setFailed(true) } finally { setPending(false) }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => { if (!pending) { if (!next) { setFailed(false); setTyped('') } onOpenChange(next) } }}
      title={title}
      trigger={trigger}
      closeLabel={closeLabel}
      dismissible={!pending}
      initialFocusRef={cancelRef}
      onCloseAutoFocus={onCloseAutoFocus}
      footer={<>
        <Button ref={cancelRef} variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
        <Button variant="danger" loading={pending} loadingLabel={pendingLabel ?? confirmLabel} disabledReason={needsPhrase ? typedConfirmation?.mismatchReason : undefined} onClick={() => void confirm()}>{confirmLabel}</Button>
      </>}
    >
      <p className="ui-confirm-consequence">{consequence}</p>
      {typedConfirmation ? <Field label={typedConfirmation.label} value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" /> : null}
      {failed && errorMessage ? <p className="ui-confirm-error" role="alert">{errorMessage}</p> : null}
    </Dialog>
  )
}
