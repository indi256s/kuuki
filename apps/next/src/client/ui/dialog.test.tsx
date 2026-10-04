// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Dialog } from './dialog'

function Harness() {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen} title="Edit flight" trigger={<button type="button">Open</button>} footer={<button type="button">Save</button>}><input aria-label="Notes" /></Dialog>
}

describe('Dialog', () => {
  it('focuses the title on open and restores focus to the trigger on close', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Edit flight' })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Edit flight' })).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('closes with the visible close button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
