import { describe, expect, it } from 'vitest'
import { swipeTarget } from './chapter-motion'

describe('swipeTarget', () => {
  it('projects the release: a quick flick or a long drag commits, a short slow drag or a flick back settles', () => {
    expect(swipeTarget({ offset: -220, velocity: 0, width: 390 })).toBe(1)
    expect(swipeTarget({ offset: -40, velocity: -0.5, width: 390 })).toBe(1)
    expect(swipeTarget({ offset: 60, velocity: 0.4, width: 390 })).toBe(-1)
    expect(swipeTarget({ offset: -100, velocity: 0, width: 390 })).toBe(0)
    expect(swipeTarget({ offset: -150, velocity: 0.3, width: 390 })).toBe(0)
  })
})
