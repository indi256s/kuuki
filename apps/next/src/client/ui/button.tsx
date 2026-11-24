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
  dense?: boolean
  loading?: boolean
  loadingLabel?: ReactNode
  morphText?: boolean
  textAlternatives?: readonly string[]
  instantText?: boolean
  icon?: ReactNode
  disabledReason?: ReactNode
  static?: boolean
  children: ReactNode
}

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
    icon,
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
      data-icon-instant={keyboardText ? 'true' : undefined}
      aria-busy={loading ? true : undefined}
      aria-disabled={blocked ? true : undefined}
      aria-describedby={describedById}
      onClick={handleClick}
    >
      {icon ? <span className="ui-button-icon">{icon}</span> : null}
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
