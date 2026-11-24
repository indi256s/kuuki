'use client'

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { CircleAlert, Eye, EyeOff } from '@keyline-icons/react'
import type { Locale } from '../../lib/format'
import './auth-card.css'

export type CardFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'aria-invalid' | 'type'
> & {
  label: string
  aside?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  type?: 'email' | 'text' | 'password'
  locale?: Locale
}

export const CardField = forwardRef<HTMLInputElement, CardFieldProps>(function CardField(
  {
    label,
    aside,
    hint,
    error,
    type = 'text',
    locale = 'en',
    id,
    'aria-describedby': describedBy,
    ...input
  },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  const hasError = error != null && error !== false && error !== ''
  const [shown, setShown] = useState(false)
  const password = type === 'password'
  return (
    <div className="auth-field">
      <div className="auth-field-label-row">
        <label className="auth-field-label" htmlFor={inputId}>
          {label}
        </label>
        {aside}
      </div>
      <div className="auth-field-control" data-reveal={password ? 'true' : undefined}>
        <input
          {...input}
          ref={ref}
          id={inputId}
          type={password && shown ? 'text' : type}
          className="auth-input"
          aria-invalid={hasError ? true : undefined}
          aria-describedby={
            [describedBy, hint ? hintId : null, hasError ? errorId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
        />
        {password ? (
          <button
            type="button"
            className="auth-card-reveal"
            aria-label={locale === 'ru' ? 'Показать пароль' : 'Show password'}
            aria-pressed={shown}
            onClick={() => setShown((value) => !value)}
          >
            {shown ? (
              <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="auth-field-hint">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} className="auth-field-error" role="alert">
          <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
})
