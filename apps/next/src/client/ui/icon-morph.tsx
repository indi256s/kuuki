import type { ReactNode, SVGProps } from 'react'
import './icon-morph.css'

// Adapted from Arc icon-morph (uiarc.dev, MIT; see ARC-LICENSE.txt). CSS replaces Motion springs with Kuuki's timing tokens.
type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref' | 'children'> & {
  state?: boolean
  size?: number
}

function Frame({
  state = false,
  size = 24,
  strokeWidth = 1.75,
  className = '',
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`icon-morph ${className}`}
      data-on={state ? 'true' : 'false'}
    >
      {children}
    </svg>
  )
}

export function ChevronIcon({ className = '', ...props }: IconProps) {
  return (
    <Frame {...props} className={`icon-morph-chevron ${className}`}>
      <path d="M6 9 L12 15 L18 9" />
    </Frame>
  )
}

export function PlayPauseIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <rect
        width="24"
        height="24"
        fill="currentColor"
        stroke="none"
        className="icon-morph-play-left"
      />
      <rect
        width="24"
        height="24"
        fill="currentColor"
        stroke="none"
        className="icon-morph-play-right"
      />
    </Frame>
  )
}

export function CopyCheckIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path
        className="icon-morph-copy-back"
        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
      />
      <rect className="icon-morph-copy-front" x="8" y="8" width="14" height="14" rx="2" />
      <path className="icon-morph-copy-check" d="M5 12.5 L9.5 17 L19 7.5" pathLength="1" />
    </Frame>
  )
}
