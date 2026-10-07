// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { expect, it, vi } from 'vitest'
import { FeedbackText } from './feedback-text'

it('shows real current plural text immediately and stops motion during a rapid found-count burst', async () => {
  vi.useFakeTimers()
  const animate = vi.spyOn(Element.prototype, 'animate')
  const { rerender, unmount } = render(<h3><FeedbackText numbers>Найден 1 перелёт</FeedbackText></h3>)
  expect(screen.getByRole('heading')).toHaveAccessibleName('Найден 1 перелёт')
  expect(animate).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(250))
  rerender(<h3><FeedbackText numbers>Найдено 2 перелёта</FeedbackText></h3>)
  expect(screen.getByRole('heading')).toHaveAccessibleName('Найдено 2 перелёта')
  await act(() => vi.advanceTimersByTimeAsync(20))
  animate.mockClear()
  rerender(<h3><FeedbackText numbers>Найден 21 перелёт</FeedbackText></h3>)
  expect(screen.getByRole('heading')).toHaveAccessibleName('Найден 21 перелёт')
  expect(animate).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(1))
  animate.mockClear()
  rerender(<h3><FeedbackText numbers>Найдено 25 перелётов</FeedbackText></h3>)
  expect(screen.getByRole('heading')).toHaveAccessibleName('Найдено 25 перелётов')
  expect(animate).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(250))
  rerender(<h3><FeedbackText numbers>Найдено 26 перелётов</FeedbackText></h3>)
  expect(screen.getByRole('heading')).toHaveAccessibleName('Найдено 26 перелётов')
  expect(animate).toHaveBeenCalled()
  unmount(); animate.mockRestore(); vi.useRealTimers()
})

it('reattaches after Strict Mode effect replay and updates the accessible label', () => {
  const { rerender } = render(<StrictMode><h3><FeedbackText>Copy link</FeedbackText></h3></StrictMode>)
  rerender(<StrictMode><h3><FeedbackText>Copied</FeedbackText></h3></StrictMode>)
  expect(screen.getByRole('heading')).toHaveAccessibleName('Copied')
})
