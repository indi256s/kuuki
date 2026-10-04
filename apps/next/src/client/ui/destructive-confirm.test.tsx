// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DestructiveConfirm } from './destructive-confirm'

function Harness({ onConfirm, onChange }: { onConfirm: () => void | Promise<void>; onChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open</button>
    <DestructiveConfirm open={open} onOpenChange={next => { setOpen(next); onChange?.(next) }} title="Delete account?" consequence="Everything is removed." confirmLabel="Delete account" cancelLabel="Cancel" pendingLabel="Deleting…" onConfirm={onConfirm}
      typedConfirmation={{ phrase: 'DELETE', label: 'Type DELETE', mismatchReason: 'Type DELETE to continue.' }} />
  </>
}

describe('DestructiveConfirm', () => {
  it('focuses Cancel first and clears the typed phrase after Cancel and reopen', async () => {
    const user = userEvent.setup()
    render(<Harness onConfirm={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.type(screen.getByLabelText('Type DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByLabelText('Type DELETE')).toHaveValue('')
  })

  it('keeps the confirm blocked with a visible reason until the phrase matches', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(await screen.findByRole('button', { name: 'Delete account' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Type DELETE to continue.')).toBeVisible()
    await user.type(screen.getByLabelText('Type DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('blocks closing while pending (Escape, no close button) and allows it afterwards', async () => {
    const user = userEvent.setup()
    let finish = () => {}
    const onChange = vi.fn()
    render(<Harness onChange={onChange} onConfirm={() => new Promise<void>(resolve => { finish = resolve })} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.type(await screen.findByLabelText('Type DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    const busy = await screen.findByRole('button', { name: 'Deleting…' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    finish()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Deleting…' })).not.toBeInTheDocument())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false))
  })
})
