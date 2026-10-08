// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('shows disabledReason as visible text referenced by aria-describedby and blocks clicks', async () => {
    const onClick = vi.fn()
    render(<Button disabledReason="Add a destination first" onClick={onClick}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    const reason = screen.getByText('Add a destination first')
    expect(reason).toBeVisible()
    expect(button.getAttribute('aria-describedby')).toContain(reason.id)
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('sets aria-busy while loading, shows a static label and ignores clicks', async () => {
    const onClick = vi.fn()
    render(<Button loading loadingLabel="Saving…" onClick={onClick}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Saving…' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

it('keeps one focused text label through pending, failure and retry, while idle counts remain instant', async () => {
  const animate = vi.spyOn(Element.prototype, 'animate')
  const onClick = vi.fn()
  const { rerender } = render(<Button morphText loadingLabel="Saving…" onClick={onClick}>Save 2 aircraft</Button>)
  const button = screen.getByRole('button', { name: 'Save 2 aircraft' })
  button.focus()
  rerender(<Button morphText loadingLabel="Saving…" onClick={onClick}>Save 1 aircraft</Button>)
  expect(screen.getByRole('button', { name: 'Save 1 aircraft' })).toBe(button)
  expect(animate).not.toHaveBeenCalled()
  await userEvent.click(button)
  rerender(<Button morphText loading loadingLabel="Saving…" onClick={onClick}>Save 1 aircraft</Button>)
  expect(screen.getByRole('button', { name: 'Saving…' })).toBe(button)
  expect(button).toHaveFocus()
  expect(button).toHaveAttribute('aria-busy', 'true')
  await userEvent.click(button)
  expect(onClick).toHaveBeenCalledTimes(1)
  rerender(<Button morphText loadingLabel="Saving…" onClick={onClick}>Save 1 aircraft</Button>)
  expect(screen.getByRole('button', { name: 'Save 1 aircraft' })).toHaveFocus()
  await userEvent.click(button)
  expect(onClick).toHaveBeenCalledTimes(2)
  animate.mockRestore()
})
