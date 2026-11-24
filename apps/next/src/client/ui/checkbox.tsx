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

type CheckboxBase = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  description?: ReactNode
  indeterminate?: boolean
}

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
