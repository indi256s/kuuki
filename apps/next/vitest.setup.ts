import type {} from '@testing-library/jest-dom/vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect } from 'vitest'

expect.extend(matchers)

// Component tests opt into jsdom with a docblock; node-environment tests have no document to clean.
afterEach(() => { if (typeof document !== 'undefined') cleanup() })

// jsdom has no Web Animations API. Browser suites own motion and layout assertions.
beforeEach(() => {
  if (typeof Element === 'undefined') return
  if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []
  if (!Element.prototype.animate) Element.prototype.animate = () => ({ cancel() {}, currentTime: 0, onfinish: null }) as unknown as Animation
  if (!window.matchMedia) window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})
