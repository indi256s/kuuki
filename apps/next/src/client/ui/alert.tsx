'use client'

import clsx from 'clsx'
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import './alert.css'

// Adapted from Arc "alert" (uiarc.dev, MIT, see ARC-LICENSE.txt): the four tones (named `variant` here, like Button), the icon beside a title and an optional description.
// Dropped: `motion` (presence collapse, text swaps, height spring) and the dismiss button; an alert here is in the layout or it is not rendered. Added: an action slot under the copy.
// Arc gives only `danger` role="alert". Here every alert is a polite `status` unless the caller says it is `urgent`.

export type AlertVariant = 'info' | 'warning' | 'danger' | 'success'

export type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'> & {
  variant?: AlertVariant
  title: ReactNode
  /** The detail under the title. */
  children?: ReactNode
  /** A control under the copy, e.g. a dense Button ("Try again"). */
  action?: ReactNode
  /** Announces assertively (`role="alert"`). Leave it off for anything the member did not just trigger. */
  urgent?: boolean
}

const icons = { info: Info, warning: TriangleAlert, danger: CircleX, success: CircleCheck }

export function Alert({
  variant = 'info',
  title,
  children,
  action,
  urgent = false,
  className,
  ...rest
}: AlertProps) {
  const Icon = icons[variant]
  return (
    <div
      {...rest}
      className={clsx('ui-alert', className)}
      data-variant={variant}
      role={urgent ? 'alert' : 'status'}
    >
      <Icon className="ui-alert-icon" size={18} strokeWidth={1.75} aria-hidden="true" />
      <div className="ui-alert-copy">
        <p className="ui-alert-title">{title}</p>
        {children ? <p className="ui-alert-description">{children}</p> : null}
        {action ? <div className="ui-alert-action">{action}</div> : null}
      </div>
    </div>
  )
}
