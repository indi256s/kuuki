// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { SpringIntegrator } from '@ssgoi/react'
import type { PrepareArgs } from '@ssgoi/react'
import { ROUTE_SPRINGS, SPRING_REST, keepVisibleStamps } from './route-motion'

const FRAME = 1000 / 60

/**
 * Steps ssgoi's own integrator at 60fps and ends where @ssgoi/core 7.4.0 ends a timeline: after 50ms inside the rest
 * thresholds. Returns the end time, the first time the spring reaches `mark`, and the furthest point it travels.
 */
function run(spring: { stiffness: number; damping: number }, mark = 1) {
  const integrator = new SpringIntegrator({ ...spring, ...SPRING_REST })
  let state = { position: 0, velocity: 0 }, held = 0, reached = Infinity, peak = 0
  for (let frame = 0; frame < 600; frame++) {
    if (reached === Infinity && state.position >= mark) reached = frame * FRAME
    state = integrator.step(state, 1, FRAME / 1000)
    peak = Math.max(peak, state.position)
    held = integrator.isSettled(state, 1) ? held + FRAME : 0
    if (held >= 50) return { end: (frame + 1) * FRAME, reached, peak }
  }
  throw new Error('the spring never settles')
}

describe('route transition springs (DESIGN.md "Motion")', () => {
  it('are critically damped and never overshoot', () => {
    for (const spring of Object.values(ROUTE_SPRINGS)) {
      expect(spring.damping).toBeGreaterThanOrEqual(2 * Math.sqrt(spring.stiffness))
      expect(run(spring).peak).toBeLessThanOrEqual(1)
    }
  })

  it('settle pages within 300ms and the stamp hero within 450ms', () => {
    expect(run(ROUTE_SPRINGS.page).end).toBeGreaterThanOrEqual(200)
    expect(run(ROUTE_SPRINGS.page).end).toBeLessThanOrEqual(300)
    expect(run(ROUTE_SPRINGS.hero).end).toBeLessThanOrEqual(450)
  })

})

describe('Passport stamps in the hero', () => {
  /** A Passport page whose stamps sit at these document offsets, in a 390×844 window scrolled to `scrollTop`. */
  function passport(stamps: Record<string, { top: number; left?: number }>, scrollTop = 0) {
    const page = document.createElement('div')
    for (const [code, { top, left = 16 }] of Object.entries(stamps)) {
      const stamp = page.appendChild(document.createElement('button'))
      stamp.dataset.heroEnterKey = code
      stamp.getBoundingClientRect = () => ({ top: top - scrollTop, left, right: left + 160, bottom: top - scrollTop + 200, height: 200, width: 160 }) as DOMRect
    }
    const root = document.documentElement
    for (const [key, value] of Object.entries({ clientHeight: 844, clientWidth: 390, scrollTop })) Object.defineProperty(root, key, { value, configurable: true })
    return page
  }
  const keys = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('[data-hero-enter-key]')].map(stamp => stamp.dataset.heroEnterKey)
  const prepare = async (page: HTMLElement, settledScroll: number) => {
    keepVisibleStamps({ to: Promise.resolve(page), context: { scrollingElement: document.documentElement, to: { scroll: { x: 0, y: settledScroll } } } } as unknown as PrepareArgs)
    await Promise.resolve()
  }

  it('keeps every stamp that will be fully on screen, so several stamps travel at once', async () => {
    const page = passport({ US: { top: 120 }, JP: { top: 120, left: 200 }, FR: { top: 340 } })
    await prepare(page, 0)
    expect(keys(page)).toEqual(['US', 'JP', 'FR'])
  })

  it('takes out a stamp below the fold, cut by the fold or off the side, so it appears in place', async () => {
    const page = passport({ US: { top: 120 }, CUT: { top: 700 }, BELOW: { top: 1200 }, SIDE: { top: 120, left: 300 } })
    await prepare(page, 0)
    expect(keys(page)).toEqual(['US'])
  })

  it('measures against the scroll Passport settles at, not the scroll it starts from', async () => {
    const page = passport({ ABOVE: { top: 120 }, US: { top: 900 } }, 0)
    await prepare(page, 800)
    expect(keys(page)).toEqual(['US'])
  })
})
