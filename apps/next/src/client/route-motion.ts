import type { PrepareArgs } from '@ssgoi/react'

/**
 * Critically damped (damping at least 2√stiffness), so nothing overshoots. ssgoi ends a spring once it has held inside
 * the rest thresholds for 50ms; counted that way, pages finish in about 0.28s and the stamp hero in about 0.38s.
 */
export type Spring = { stiffness: number; damping: number }
export const ROUTE_SPRINGS = {
  page: { stiffness: 800, damping: 57 },
  hero: { stiffness: 380, damping: 39 },
}
export const SPRING_REST = { restDelta: 0.02, restSpeed: 0.5 }

/** A Passport stamp that will not be fully on screen once the page settles has no partner; it appears in place. */
export function keepVisibleStamps({ to, context }: PrepareArgs) {
  void to.then((page) => {
    const scroller = context.scrollingElement
    const origin = scroller === document.documentElement ? 0 : scroller.getBoundingClientRect().top
    const top = context.to.scroll.y
    for (const stamp of page.querySelectorAll<HTMLElement>('[data-hero-enter-key]')) {
      const rect = stamp.getBoundingClientRect()
      const offset = rect.top - origin + scroller.scrollTop
      if (
        offset < top ||
        offset + rect.height > top + scroller.clientHeight ||
        rect.left < 0 ||
        rect.right > scroller.clientWidth
      )
        stamp.removeAttribute('data-hero-enter-key')
    }
  })
}
