import type { AnchorHTMLAttributes, ReactNode } from 'react'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  replace?: boolean
  scroll?: boolean
  onNavigate?: (event: { preventDefault: () => void }) => void
  children?: ReactNode
}

export function linkStandIn(
  navigate: (href: string, options: { replace: boolean; scroll: boolean }) => void,
) {
  return function Link({
    href,
    replace = false,
    scroll = true,
    onNavigate,
    onClick,
    children,
    ...rest
  }: Props) {
    return (
      <a
        href={href}
        {...rest}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented) return
          const anchor = event.currentTarget
          const target = anchor.getAttribute('target')
          if (
            (target && target !== '_self') ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button === 1 ||
            anchor.hasAttribute('download')
          )
            return
          if (new URL(href, window.location.href).origin !== window.location.origin) return
          event.preventDefault()
          let cancelled = false
          onNavigate?.({
            preventDefault: () => {
              cancelled = true
            },
          })
          if (!cancelled) navigate(href, { replace, scroll })
        }}
      >
        {children}
      </a>
    )
  }
}
