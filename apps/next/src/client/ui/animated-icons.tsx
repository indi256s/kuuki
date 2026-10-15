import { Plus as KeylinePlus, type IconProps } from '@keyline-icons/react'
import './animated-icons.css'

export function Plus({ className = '', ...props }: IconProps) {
  return <KeylinePlus {...props} className={`animated-icon ${className}`} />
}
