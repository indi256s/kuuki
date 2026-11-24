import type {} from '@testing-library/jest-dom/vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect } from 'vitest'

expect.extend(matchers)

afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
})

beforeEach(() => {
  if (typeof Element === 'undefined') return
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []
  if (!Element.prototype.animate)
    Element.prototype.animate = () =>
      ({ cancel() {}, currentTime: 0, onfinish: null }) as unknown as Animation
  if (!window.ResizeObserver)
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  if (!window.matchMedia)
    window.matchMedia = (() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia
})
