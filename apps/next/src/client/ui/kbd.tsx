import clsx from 'clsx'
import type { HTMLAttributes } from 'react'
import './kbd.css'

export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <kbd {...rest} className={clsx('ui-kbd', className)} />
}
