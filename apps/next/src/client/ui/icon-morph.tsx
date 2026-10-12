import {
  Check,
  ChevronDown,
  Copy,
  Pause,
  Play,
  type IconProps as KeylineIconProps,
} from '@keyline-icons/react'
import './icon-morph.css'

type IconProps = KeylineIconProps & { state?: boolean }

export function ChevronIcon({
  state = false,
  strokeWidth = 1.75,
  className = '',
  ...props
}: IconProps) {
  return (
    <ChevronDown
      {...props}
      strokeWidth={strokeWidth}
      className={`icon-morph icon-morph-chevron ${className}`}
      data-on={state ? 'true' : 'false'}
    />
  )
}

export function PlayPauseIcon({
  state = false,
  size = 24,
  strokeWidth = 1.75,
  className = '',
  ...props
}: IconProps) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`icon-morph ${className}`}
      data-on={state ? 'true' : 'false'}
    >
      <Play size={24} strokeWidth={strokeWidth} className="icon-morph-off" />
      <Pause size={24} strokeWidth={strokeWidth} className="icon-morph-on" />
    </svg>
  )
}

export function CopyCheckIcon({
  state = false,
  size = 24,
  strokeWidth = 1.75,
  className = '',
  ...props
}: IconProps) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`icon-morph ${className}`}
      data-on={state ? 'true' : 'false'}
    >
      <Copy size={24} strokeWidth={strokeWidth} className="icon-morph-off" />
      <Check size={24} strokeWidth={strokeWidth} className="icon-morph-on" />
    </svg>
  )
}
