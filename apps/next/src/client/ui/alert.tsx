'use client'

import clsx from 'clsx'
import { CircleCheck, CircleX, Info, TriangleAlert } from '@keyline-icons/react'
import type { HTMLAttributes, ReactNode } from 'react'
import './alert.css'

export type AlertVariant = 'info' | 'warning' | 'danger' | 'success'

export type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'> & {
  variant?: AlertVariant
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
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
