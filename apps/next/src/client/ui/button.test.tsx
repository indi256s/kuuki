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

  it('calls onClick when enabled', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
