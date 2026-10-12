import type { Integrator, PrepareArgs } from '@ssgoi/react'

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

/** CSS `cubic-bezier(x1, y1, x2, y2)` as a function of linear progress; the curve's x is solved by bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    let t = x
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2
      if (at(x1, x2, t) < x) lo = t
      else hi = t
    }
    return at(y1, y2, t)
  }
}

/**
 * Moves progress at a constant rate, so a track ends after `ms`. ssgoi's LinearIntegrator scales its speed by the
 * distance left, which approaches the target exponentially: a 200ms one held the page for about 0.9s.
 */
export function clock(ms: number): Integrator {
  const rate = 1000 / ms
  return {
    step({ position }, target, dt) {
      const direction = Math.sign(target - position)
      const next = position + direction * rate * dt
      return direction === 0 || (direction > 0 ? next >= target : next <= target)
        ? { position: target, velocity: 0 }
        : { position: next, velocity: direction * rate }
    },
    isSettled: ({ position }, target) => position === target,
  }
}

/** The tab fade-in: `--dur-base` on `--ease-out`; under reduced motion `--dur-fast`, linear (DESIGN.md "Reduced motion"). */
export const TAB_FADE = {
  motion: { ms: 200, ease: cubicBezier(0.23, 1, 0.32, 1) },
  reduced: { ms: 150, ease: (t: number) => t },
}

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
