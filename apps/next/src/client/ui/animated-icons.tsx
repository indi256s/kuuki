import {
  GridSquares,
  Plus as KeylinePlus,
  Stamp as KeylineStamp,
  type IconProps,
} from '@keyline-icons/react'
import './animated-icons.css'

export function Plus({ className = '', ...props }: IconProps) {
  return <KeylinePlus {...props} className={`animated-icon animated-icon-plus ${className}`} />
}

export function LayoutGrid({ className = '', ...props }: IconProps) {
  return <GridSquares {...props} className={`animated-icon animated-icon-grid ${className}`} />
}

export function Stamp({ className = '', ...props }: IconProps) {
  return <KeylineStamp {...props} className={`animated-icon animated-icon-stamp ${className}`} />
}
