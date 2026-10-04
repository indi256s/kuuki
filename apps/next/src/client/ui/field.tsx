'use client'

import clsx from 'clsx'
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import './ui.css'

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-invalid'> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** Marks optional fields instead of starring required ones, e.g. «необязательно». */
  optionalLabel?: ReactNode
}

// forwardRef + prop pass-through, so `<Field {...register('name')} />` works with react-hook-form.
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, optionalLabel, id, className, 'aria-describedby': describedBy, ...input },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const hasError = error != null && error !== false && error !== ''
  const describedIds = [describedBy, hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={clsx('ui-field', className)}>
      <label className="ui-field-label" htmlFor={inputId}>
        {label}{optionalLabel ? <span className="ui-field-optional">{optionalLabel}</span> : null}
      </label>
      {hint ? <p id={hintId} className="ui-field-hint">{hint}</p> : null}
      <input {...input} ref={ref} id={inputId} className="ui-field-input" aria-invalid={hasError ? true : undefined} aria-describedby={describedIds} />
      {/* The line is always rendered so an error appearing does not move anything below it. */}
      <p id={errorId} className="ui-field-error" role={hasError ? 'alert' : undefined}>{hasError ? error : null}</p>
    </div>
  )
})
