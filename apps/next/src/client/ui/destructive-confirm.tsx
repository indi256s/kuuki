'use client'

import { CircleAlert } from '@keyline-icons/react'
import { useRef, useState, type ReactNode } from 'react'
import { Button } from './button'
import { Dialog } from './dialog'
import { Field } from './field'

export type DestructiveConfirmProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  consequence: ReactNode
  confirmLabel: string
  cancelLabel: string
  pendingLabel?: string
  onConfirm: () => void | Promise<void>
  errorMessage?: string
  confirmDisabledReason?: ReactNode
  typedConfirmation?: { phrase: string; label: string; mismatchReason: string }
  trigger?: ReactNode
  onCloseAutoFocus?: (event: Event) => void
}

export function DestructiveConfirm({
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  onConfirm,
  errorMessage,
  confirmDisabledReason,
  typedConfirmation,
  trigger,
  onCloseAutoFocus,
}: DestructiveConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [typed, setTyped] = useState('')
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setTyped('')
      setFailed(false)
    }
  }
  const needsPhrase = typedConfirmation ? typed.trim() !== typedConfirmation.phrase : false

  const confirm = async () => {
    setPending(true)
    setFailed(false)
    try {
      await onConfirm()
      setTyped('')
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          if (!next) {
            setFailed(false)
            setTyped('')
          }
          onOpenChange(next)
        }
      }}
      className="ui-confirm"
      title={title}
      trigger={trigger}
      closeButton={false}
      dismissible={!pending}
      initialFocusRef={cancelRef}
      onCloseAutoFocus={onCloseAutoFocus}
      footer={
        <>
          <Button
            ref={cancelRef}
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            loading={pending}
            loadingLabel={pendingLabel ?? confirmLabel}
            disabledReason={
              confirmDisabledReason ?? (needsPhrase ? typedConfirmation?.mismatchReason : undefined)
            }
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="ui-confirm-consequence">{consequence}</p>
      {typedConfirmation ? (
        <Field
          label={typedConfirmation.label}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
        />
      ) : null}
      {failed && errorMessage ? (
        <p className="ui-confirm-error" role="alert">
          <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
          <span>{errorMessage}</span>
        </p>
      ) : null}
    </Dialog>
  )
}
