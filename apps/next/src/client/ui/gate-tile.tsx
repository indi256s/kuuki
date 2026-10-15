import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import './gate-tile.css'

// Kuuki's own: a gate-sign link tile (label over a big value). Used by the profile's leaderboard ranks; `compact` is styled by the leaderboard page.

export function GateTile({
  label,
  value,
  ariaLabel,
  size = 'default',
  className,
  ...rest
}: Omit<ComponentProps<typeof Link>, 'children' | 'aria-label'> & {
  label: ReactNode
  value: ReactNode
  ariaLabel: string
  size?: 'default' | 'compact'
}) {
  return (
    <Link
      {...rest}
      className={className ? `gate-tile ${className}` : 'gate-tile'}
      data-size={size}
      aria-label={ariaLabel}
    >
      <span className="gate-tile-label" aria-hidden="true">
        {label}
      </span>
      <span className="gate-tile-value" aria-hidden="true">
        {value}
      </span>
    </Link>
  )
}
