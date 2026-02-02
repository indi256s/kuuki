import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FlyingPlanes } from './FlyingPlanes'

describe('FlyingPlanes', () => {
  it('renders 20 planes', () => {
    render(<FlyingPlanes />)

    // lucide-react Plane renders as SVG with aria-hidden, query directly
    const container = document.querySelector('.absolute.inset-0')
    const svgPlanes = container?.querySelectorAll('svg.lucide-plane')

    expect(svgPlanes?.length).toBe(20)
  })

  it('assigns plane-ascend animation class to all planes', () => {
    render(<FlyingPlanes />)

    const container = document.querySelector('.absolute.inset-0')
    const planes = container?.querySelectorAll('svg')

    planes?.forEach((plane) => {
      expect(plane.classList.contains('animate-plane-ascend')).toBe(true)
    })
  })

  it('sets CSS custom properties for animation timing', () => {
    render(<FlyingPlanes />)

    const container = document.querySelector('.absolute.inset-0')
    const plane = container?.querySelector('svg')

    // Check that CSS custom properties are set
    const style = plane?.getAttribute('style')
    expect(style).toContain('--plane-duration')
    expect(style).toContain('--plane-delay')
    expect(style).toContain('--plane-opacity')
  })

  it('distributes planes across different horizontal positions', () => {
    render(<FlyingPlanes />)

    const container = document.querySelector('.absolute.inset-0')
    const planes = container?.querySelectorAll('svg')

    const leftPositions = new Set<string>()
    planes?.forEach((plane) => {
      const style = plane.getAttribute('style')
      const leftMatch = style?.match(/left:\s*(\d+%)/)
      if (leftMatch) {
        leftPositions.add(leftMatch[1])
      }
    })

    // Should have multiple different left positions (distributed)
    expect(leftPositions.size).toBeGreaterThan(5)
  })
})
