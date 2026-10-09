'use client'

import clsx from 'clsx'
import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { FeedbackText } from './feedback-text'
import './ui.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: ButtonVariant
  /** 32px visual; the hit area extends to 40px (44px on coarse pointers). Keep neighbours >= 8px apart. */
  dense?: boolean
  /** Shows `loadingLabel` as static text (no spinner), keeps the width, sets aria-busy and ignores clicks. */
  loading?: boolean
  loadingLabel?: ReactNode
  /** Opt-in short text feedback; element-bearing labels keep the ordinary rendering path. */
  morphText?: boolean
  /** Reserve both localized copy states, including the idle label after a copy succeeds. */
  textAlternatives?: readonly string[]
  instantText?: boolean
  /** Visible helper text under a disabled button, linked with aria-describedby. Implies disabled. */
  disabledReason?: ReactNode
  /** Rows and cards: no press scale. */
  static?: boolean
  children: ReactNode
}

// Blocked buttons use aria-disabled instead of `disabled` so they stay focusable and their reason is announced.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    dense,
    loading,
    loadingLabel,
    disabledReason,
    static: isStatic,
    morphText,
    textAlternatives,
    instantText,
    className,
    children,
    onClick,
    type = 'button',
    disabled,
    'aria-describedby': describedBy,
    ...rest
  },
  ref,
) {
  const reasonId = useId()
  const [keyboardText, setKeyboardText] = useState(false)
  const label = loading && loadingLabel != null ? loadingLabel : children
  const textOnly =
    morphText &&
    (typeof children === 'string' || typeof children === 'number') &&
    (typeof label === 'string' || typeof label === 'number')
  const [previous, setPrevious] = useState({ label, loading, animate: true })
  if (textOnly && (previous.label !== label || previous.loading !== loading)) {
    // Idle selection counts swap instantly; entry/exit from pending still morphs.
    setPrevious({
      label,
      loading,
      animate: textAlternatives != null || previous.loading !== loading,
    })
  }
  const hasReason = disabledReason != null && disabledReason !== false
  const blocked = Boolean(loading || hasReason || disabled)
  const describedById =
    [describedBy, hasReason ? reasonId : null].filter(Boolean).join(' ') || undefined
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (blocked) {
      event.preventDefault()
      return
    }
    if (morphText) setKeyboardText(event.detail === 0)
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
      {textOnly ? (
        <>
          <span className="ui-button-hidden" aria-hidden="true">
            {children}
          </span>
          <span className="ui-button-hidden" aria-hidden="true">
            {loadingLabel}
          </span>
          {textAlternatives?.map((text) => (
            <span className="ui-button-hidden" aria-hidden="true" key={text}>
              {text}
            </span>
          ))}
          <span>
            <FeedbackText disabled={instantText || keyboardText || !previous.animate}>
              {label}
            </FeedbackText>
          </span>
        </>
      ) : loading && loadingLabel != null ? (
        <>
          <span className="ui-button-hidden" aria-hidden="true">
            {children}
          </span>
          <span>{loadingLabel}</span>
        </>
      ) : (
        <span>{children}</span>
      )}
    </button>
  )
  if (!hasReason) return button
  return (
    <span className="ui-button-wrap">
      {button}
      <span id={reasonId} className="ui-button-reason">
        {disabledReason}
      </span>
    </span>
  )
})
