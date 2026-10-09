// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { SwipeActionsRow } from './swipe-actions'

function setup() {
  const onDelete = vi.fn()
  const onFlew = vi.fn()
  render(<SwipeActionsRow leading={[{ label: 'I flew', icon: null, tone: 'accent', onSelect: onFlew }]} trailing={[{ label: 'Delete flight', icon: null, tone: 'danger', onSelect: onDelete }]}>
    <p>SVO to LED</p>
  </SwipeActionsRow>)
  return { onDelete, onFlew, content: screen.getByText('SVO to LED').parentElement as HTMLElement }
}
const touch = { pointerId: 1, isPrimary: true, pointerType: 'touch', button: 0, clientY: 10 }

it('commits the outermost trailing action past the threshold and ignores a short pull', () => {
  const { onDelete, content } = setup()
  fireEvent.pointerDown(content, { ...touch, clientX: 300 })
  fireEvent.pointerMove(content, { ...touch, clientX: 280 })
  fireEvent.pointerMove(content, { ...touch, clientX: 260 })
  fireEvent.pointerUp(content, { ...touch, clientX: 260 })
  expect(onDelete).not.toHaveBeenCalled()
  fireEvent.pointerDown(content, { ...touch, clientX: 300 })
  fireEvent.pointerMove(content, { ...touch, clientX: 280 })
  fireEvent.pointerMove(content, { ...touch, clientX: 60 })
  fireEvent.pointerUp(content, { ...touch, clientX: 60 })
  expect(onDelete).toHaveBeenCalledTimes(1)
})

it('exposes each revealed action as a named button that commits on tap', async () => {
  const { onDelete, onFlew } = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Delete flight' }))
  expect(onDelete).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('button', { name: 'I flew' }))
  expect(onFlew).toHaveBeenCalledTimes(1)
})
