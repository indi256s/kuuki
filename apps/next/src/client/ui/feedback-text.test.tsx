// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FeedbackText } from './feedback-text'

afterEach(() => vi.restoreAllMocks())

it('morphs a changed label without animating its layout dimensions', () => {
  // jsdom has no layout; give the real morph driver nonzero text measurements.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 80,
    bottom: 20,
    width: 80,
    height: 20,
    toJSON: () => ({}),
  })
  const animate = vi.spyOn(Element.prototype, 'animate')
  const { rerender } = render(<FeedbackText>Saving</FeedbackText>)
  animate.mockClear()
  rerender(<FeedbackText>Saved</FeedbackText>)
  expect(screen.getByText('Saved')).toBeInTheDocument()
  expect(animate).toHaveBeenCalled()
  for (const [keyframes] of animate.mock.calls) {
    for (const frame of Array.isArray(keyframes) ? keyframes : [keyframes]) {
      expect(frame).not.toHaveProperty('width')
      expect(frame).not.toHaveProperty('height')
    }
  }
})
