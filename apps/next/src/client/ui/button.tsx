'use client'

import clsx from 'clsx'
import { forwardRef, useId, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import './ui.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: ButtonVariant
  /** 32px visual; the hit area extends to 40px (44px on coarse pointers). Keep neighbours >= 8px apart. */
  dense?: boolean
  /** Shows `loadingLabel` as static text (no spinner), keeps the width, sets aria-busy and ignores clicks. */
  loading?: boolean
  loadingLabel?: ReactNode
  /** Visible helper text under a disabled button, linked with aria-describedby. Implies disabled. */
  disabledReason?: ReactNode
  /** Rows and cards: no press scale. */
  static?: boolean
  children: ReactNode
}

// Blocked buttons use aria-disabled instead of `disabled` so they stay focusable and their reason is announced.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', dense, loading, loadingLabel, disabledReason, static: isStatic, className, children, onClick, type = 'button', disabled, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const reasonId = useId()
  const hasReason = disabledReason != null && disabledReason !== false
  const blocked = Boolean(loading || hasReason || disabled)
  const describedById = [describedBy, hasReason ? reasonId : null].filter(Boolean).join(' ') || undefined
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (blocked) { event.preventDefault(); return }
    onClick?.(event)
  }
  const button = (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={clsx('ui-button', className)}
      data-variant={variant}
      data-dense={dense ? 'true' : undefined}
      data-static={isStatic ? 'true' : undefined}
      aria-busy={loading ? true : undefined}
      aria-disabled={blocked ? true : undefined}
      aria-describedby={describedById}
      onClick={handleClick}
    >
      {loading && loadingLabel != null ? (
        <>
          <span className="ui-button-hidden" aria-hidden="true">{children}</span>
          <span>{loadingLabel}</span>
        </>
      ) : <span>{children}</span>}
    </button>
  )
  if (!hasReason) return button
  return <span className="ui-button-wrap">{button}<span id={reasonId} className="ui-button-reason">{disabledReason}</span></span>
})
