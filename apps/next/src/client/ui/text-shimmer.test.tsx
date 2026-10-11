// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TextShimmer } from './text-shimmer'

afterEach(cleanup)

describe('TextShimmer', () => {
  it('pauses the sweep while the tab is hidden', () => {
    const { container } = render(<TextShimmer>Reading boarding.pdf</TextShimmer>)
    const shimmer = container.firstElementChild!
    expect(shimmer).toHaveAttribute('aria-busy', 'true')
    expect(shimmer).not.toHaveAttribute('data-paused')
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(shimmer).toHaveAttribute('data-paused', 'true')
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })
})
