import type { SVGProps } from 'react'
import './animated-icons.css'

// Adapted from pqoqubbw/icons; source revision and MIT notice: LUCIDE-ANIMATED-LICENSE.txt.
type IconProps = SVGProps<SVGSVGElement> & { size?: number }
const svg = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
} as const

export function Plus({ size = 24, className = '', ...props }: IconProps) {
  return (
    <svg
      {...svg}
      width={size}
      height={size}
      {...props}
      className={`animated-icon animated-icon-plus ${className}`}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

export function LayoutGrid({ size = 24, className = '', ...props }: IconProps) {
  return (
    <svg
      {...svg}
      width={size}
      height={size}
      {...props}
      className={`animated-icon animated-icon-grid ${className}`}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

export function Stamp({ size = 24, className = '', ...props }: IconProps) {
  return (
    <svg
      {...svg}
      width={size}
      height={size}
      {...props}
      className={`animated-icon animated-icon-stamp ${className}`}
    >
      <g>
        <path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13" />
        <path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z" />
      </g>
      <path d="M5 22h14" />
    </svg>
  )
}
