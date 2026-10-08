'use client'

import clsx from 'clsx'
import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react'
import '../ui/ui.css'

export type ImportTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'aria-invalid'> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

/**
 * Multi-line twin of Field, adapted from Arc's Textarea: label, hint and error are wired to the control by id.
 * Arc's word-swap and height springs are left out; Field's classes keep it identical to the other inputs.
 */
export const ImportTextarea = forwardRef<HTMLTextAreaElement, ImportTextareaProps>(function ImportTextarea(
  { label, hint, error, id, className, 'aria-describedby': describedBy, ...textarea },
  ref,
) {
  const generated = useId()
  const controlId = id ?? generated
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const hasError = error != null && error !== false && error !== ''
  const describedIds = [describedBy, hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(' ') || undefined
  return <div className="ui-field">
    <label className="ui-field-label" htmlFor={controlId}>{label}</label>
    {hint ? <p id={hintId} className="ui-field-hint">{hint}</p> : null}
    <textarea {...textarea} ref={ref} id={controlId} className={clsx('ui-field-input import-textarea', className)} aria-invalid={hasError ? true : undefined} aria-describedby={describedIds} />
    {hasError ? <p id={errorId} className="ui-field-error" role="alert">{error}</p> : null}
  </div>
})
