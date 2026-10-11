'use client'

import clsx from 'clsx'
import { Check, Minus } from '@keyline-icons/react'
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import './checkbox.css'

// Adapted from Arc "checkbox" (uiarc.dev, MIT, see ARC-LICENSE.txt): the 18px square with the Keyline check that crossfades into the dash, the label and the description beside it.
// Dropped: Radix Checkbox and `motion`. The control is a native `<input type="checkbox">` (form value, label, keyboard and `:indeterminate` for free); the square is drawn beside it and the state comes from CSS.
// Added: a 44px hit area on coarse pointers, `--control-border` and an accent fill, and a visible `:focus-visible` ring. Arc's checkbox has a hard-coded English fallback name; this one needs a label or an `aria-label`.

type CheckboxBase = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  description?: ReactNode
  /** The mixed state of a "select all". It is cleared by the browser on click, so the caller owns it with `checked`. */
  indeterminate?: boolean
}

/** A visible label, or an accessible name for a checkbox that has none (a row selector). */
export type CheckboxProps = CheckboxBase &
  ({ label: ReactNode } | { label?: undefined; 'aria-label': string })

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    description,
    indeterminate = false,
    id,
    className,
    'aria-describedby': describedBy,
    ...input
  },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  const descriptionId = `${inputId}-description`
  const inner = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => inner.current as HTMLInputElement)
  // No dependency list: a click clears the DOM flag, so it is set again after every render the caller made.
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate
  })
  const describedIds =
    [describedBy, description ? descriptionId : null].filter(Boolean).join(' ') || undefined
  return (
    <span className={clsx('ui-checkbox', className)}>
      <span className="ui-checkbox-box">
        <input
          {...input}
          ref={inner}
          id={inputId}
          type="checkbox"
          className="ui-checkbox-input"
          aria-describedby={describedIds}
        />
        <span className="ui-checkbox-mark" aria-hidden="true">
          <Check size={18} strokeWidth={1.75} className="ui-checkbox-check" />
          <Minus size={18} strokeWidth={1.75} className="ui-checkbox-dash" />
        </span>
      </span>
      {label != null || description ? (
        <span className="ui-checkbox-copy">
          {label != null ? (
            <label className="ui-checkbox-label" htmlFor={inputId}>
              {label}
            </label>
          ) : null}
          {description ? (
            <span id={descriptionId} className="ui-checkbox-description">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  )
})
