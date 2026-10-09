// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { SlotText } from './slot-text'

const format = (value: number) => value.toLocaleString('en-US')

it('shows the final text at once, static on first render and rolling only the characters that changed', () => {
  const { container, rerender } = render(<SlotText value={1204} format={format} />)
  expect(screen.getByText('1,204')).toBeInTheDocument()
  expect(container.querySelector('[data-roll]')).toBeNull()

  rerender(<SlotText value={1205} format={format} />)
  expect(screen.getByText('1,205')).toBeInTheDocument()
  expect(screen.queryByText('1,204')).not.toBeInTheDocument()
  const rolling = container.querySelectorAll('.ui-slot-in[data-roll]')
  expect(rolling).toHaveLength(1)
  expect(rolling[0]).toHaveTextContent('5')
  expect(rolling[0]).toHaveAttribute('data-roll', 'up')
  expect(container.querySelector('.ui-slot-out')).toHaveTextContent('4')
  expect(container.querySelector('.ui-slot-out')?.closest('[aria-hidden=true]')).not.toBeNull()

  rerender(<SlotText value={1199} format={format} />)
  expect(screen.getByText('1,199')).toBeInTheDocument()
  expect(container.querySelector('.ui-slot-in[data-roll=down]')).not.toBeNull()
})
