import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FlyingPlanes } from './FlyingPlanes'
import fs from 'fs'
import path from 'path'

describe('FlyingPlanes', () => {
  it('renders 20 planes', () => {
    render(<FlyingPlanes />)

    // lucide-react Plane renders as SVG with aria-hidden, query directly
    const container = document.querySelector('.absolute.inset-0')
    const svgPlanes = container?.querySelectorAll('svg.lucide-plane')

    expect(svgPlanes?.length).toBe(20)
  })

  it('assigns orbital animation classes to all planes', () => {
    render(<FlyingPlanes />)

    const container = document.querySelector('.absolute.inset-0')
    const planes = container?.querySelectorAll('svg')

    planes?.forEach((plane) => {
      const hasOrbitClass =
        plane.classList.contains('animate-orbit-close') ||
        plane.classList.contains('animate-orbit-medium') ||
        plane.classList.contains('animate-orbit-wide') ||
        plane.classList.contains('animate-orbit-far')

      expect(hasOrbitClass).toBe(true)
    })
  })
})

describe('Orbital CSS Keyframes', () => {
  // Read the CSS file to verify animation starting positions
  const cssPath = path.resolve(__dirname, '../../index.css')
  const cssContent = fs.readFileSync(cssPath, 'utf-8')

  const orbitKeyframes = ['orbit-close', 'orbit-medium', 'orbit-wide', 'orbit-far']

  orbitKeyframes.forEach((orbitName) => {
    it(`${orbitName} animation starts from bottom (700px Y position)`, () => {
      // Extract the keyframe definition
      const keyframeRegex = new RegExp(
        `@keyframes\\s+${orbitName}\\s*\\{[^}]*0%\\s*\\{([^}]+)\\}`,
        's'
      )
      const match = cssContent.match(keyframeRegex)

      expect(match).not.toBeNull()

      const initialFrame = match![1]
      // Should contain translateY(700px) or translate(Xpx, 700px)
      expect(initialFrame).toMatch(/translate\([^,]+,\s*700px\)/)
    })

    it(`${orbitName} animation does not start at top (Y should not be 0 or negative at 0%)`, () => {
      const keyframeRegex = new RegExp(
        `@keyframes\\s+${orbitName}\\s*\\{[^}]*0%\\s*\\{([^}]+)\\}`,
        's'
      )
      const match = cssContent.match(keyframeRegex)

      expect(match).not.toBeNull()

      const initialFrame = match![1]
      // Should NOT have Y position of 0 or negative at start
      expect(initialFrame).not.toMatch(/translate\([^,]+,\s*0px\)/)
      expect(initialFrame).not.toMatch(/translate\([^,]+,\s*-\d+px\)/)
    })
  })
})
