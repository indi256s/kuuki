import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const MAX_WIDTH_CLASSES = {
  wide: 'max-w-7xl 3xl:max-w-[1800px]',
  import: 'max-w-5xl',
  settings: 'max-w-2xl',
  profile: 'max-w-3xl',
  narrow: 'max-w-md',
  none: '',
} as const

export type AppPageShellMaxWidth = keyof typeof MAX_WIDTH_CLASSES

export interface AppPageShellProps {
  children: ReactNode
  maxWidth?: AppPageShellMaxWidth
  /** Additional classes merged onto `<main>` (padding, layout, etc.) */
  className?: string
  /** Classes for the outer shell wrapper; omitted when `mainOnly` is true */
  shellClassName?: string
  mobileHeader?: ReactNode
  appHeader?: ReactNode
  mobileTabBar?: ReactNode
  /** Rendered after headers but before `<main>` (e.g. mini-header, watermark) */
  beforeMain?: ReactNode
  /** Rendered after `<main>` but inside the shell (e.g. modals) */
  afterMain?: ReactNode
  /** Render only `<main id="main-content">` without the outer shell or header slots */
  mainOnly?: boolean
}

export function AppPageShell({
  children,
  maxWidth = 'wide',
  className,
  shellClassName,
  mobileHeader,
  appHeader,
  mobileTabBar,
  beforeMain,
  afterMain,
  mainOnly = false,
}: AppPageShellProps) {
  const main = (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(MAX_WIDTH_CLASSES[maxWidth], className)}
    >
      {children}
    </main>
  )

  if (mainOnly) {
    return main
  }

  return (
    <div className={shellClassName}>
      {mobileHeader}
      {appHeader}
      {beforeMain}
      {main}
      {afterMain}
      {mobileTabBar}
    </div>
  )
}
