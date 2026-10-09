import clsx from 'clsx'
import type { HTMLAttributes } from 'react'
import './kbd.css'

// Kuuki's own: a keycap for shortcut hints. Arc's `kbd` is not part of this adaptation, so there is no upstream source behind this file.

export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <kbd {...rest} className={clsx('ui-kbd', className)} />
}
