// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { DeleteUndo } from './delete-undo'

it('keeps one always-mounted polite status whose sentence does not change while the countdown runs', () => {
  const { rerender, container } = render(<DeleteUndo locale="en" pending={null} submitting={false} onUndo={() => {}} />)
  const status = screen.getByRole('status')
  expect(status).toBeEmptyDOMElement()
  rerender(<DeleteUndo locale="en" pending={{ ids: [1, 2, 3], seconds: 6 }} submitting={false} onUndo={() => {}} />)
  expect(screen.getByRole('status')).toBe(status)
  expect(status).toHaveTextContent('3 flights are being deleted.')
  rerender(<DeleteUndo locale="en" pending={{ ids: [1, 2, 3], seconds: 2 }} submitting={false} onUndo={() => {}} />)
  expect(status).toHaveTextContent(/^3 flights are being deleted\.$/)
  const seconds = container.querySelector('.journal-undo-seconds')!
  expect(seconds).toHaveAttribute('aria-hidden', 'true')
  expect(seconds).toHaveTextContent('2 s')
  expect(status).not.toContainElement(seconds as HTMLElement)
})

it('drops Undo once the request starts and clears the sentence afterwards', () => {
  const { rerender } = render(<DeleteUndo locale="ru" pending={{ ids: [1, 2], seconds: 1 }} submitting={false} onUndo={() => {}} />)
  expect(screen.getByRole('button', { name: 'Отменить' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('2 перелёта будут удалены.')
  rerender(<DeleteUndo locale="ru" pending={{ ids: [1, 2], seconds: 1 }} submitting onUndo={() => {}} />)
  expect(screen.queryByRole('button', { name: 'Отменить' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('2 перелёта будут удалены.')
  rerender(<DeleteUndo locale="ru" pending={null} submitting={false} onUndo={() => {}} />)
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it.each([[1, '1 перелёт будет удалён.'], [2, '2 перелёта будут удалены.'], [5, '5 перелётов будут удалены.'], [21, '21 перелёт будет удалён.']])('uses the Russian plural form for %i', (count, sentence) => {
  render(<DeleteUndo locale="ru" pending={{ ids: Array.from({ length: count }, (_, index) => index), seconds: 6 }} submitting={false} onUndo={() => {}} />)
  expect(screen.getByRole('status')).toHaveTextContent(sentence)
})
