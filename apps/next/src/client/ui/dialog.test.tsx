// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './dialog'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Edit flight"
      trigger={<button type="button">Open</button>}
      footer={<button type="button">Save</button>}
    >
      <input aria-label="Notes" />
    </Dialog>
  )
}

function ProgrammaticHarness({ redirectFocus = false }: { redirectFocus?: boolean }) {
  const [open, setOpen] = useState(false)
  const destination = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        First opener
      </button>
      <button ref={destination} type="button" onClick={() => setOpen(true)}>
        Second opener
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Confirm change"
        onCloseAutoFocus={
          redirectFocus
            ? (event) => {
                event.preventDefault()
                destination.current?.focus()
              }
            : undefined
        }
        footer={
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        }
      >
        <input aria-label="Notes" autoFocus />
      </Dialog>
    </>
  )
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

  it('retains the dialog until its closing animation finishes', async () => {
    const computedStyle = window.getComputedStyle.bind(window)
    const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = computedStyle(element)
      if (element.classList.contains('ui-dialog'))
        Object.defineProperties(style, {
          animationName: {
            get: () => (element.getAttribute('data-state') === 'open' ? 'dialog-in' : 'dialog-out'),
          },
          display: { value: 'block' },
        })
      return style
    })
    try {
      const user = userEvent.setup()
      render(<Harness />)
      await user.click(screen.getByRole('button', { name: 'Open' }))
      const dialog = await screen.findByRole('dialog', { name: 'Edit flight' })
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveAttribute('data-state', 'closed')
      const end = new Event('animationend', { bubbles: true })
      Object.defineProperty(end, 'animationName', { value: 'dialog-out' })
      fireEvent(dialog, end)
      await waitFor(() => expect(dialog).not.toBeInTheDocument())
    } finally {
      spy.mockRestore()
    }
  })

  it('closes with the visible close button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('returns focus to the current opener after a triggerless dialog is cancelled', async () => {
    const user = userEvent.setup()
    render(<ProgrammaticHarness />)
    for (const name of ['First opener', 'Second opener']) {
      const opener = screen.getByRole('button', { name })
      await user.click(opener)
      await user.click(await screen.findByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(opener).toHaveFocus())
    }
  })

  it('preserves a caller override of triggerless close focus', async () => {
    const user = userEvent.setup()
    render(<ProgrammaticHarness redirectFocus />)
    await user.click(screen.getByRole('button', { name: 'First opener' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Second opener' })).toHaveFocus())
  })
})

it('restores in-dialog focus when reopened before its pointer exit finishes', async () => {
  const onOpenChange = vi.fn()
  const view = (open: boolean) => (
    <Dialog open={open} onOpenChange={onOpenChange} title="Edit flight">
      <input aria-label="Notes" />
    </Dialog>
  )
  const { rerender } = render(view(true))
  const dialog = screen.getByRole('dialog')
  let finish!: () => void
  const finished = new Promise<void>((resolve) => {
    finish = resolve
  })
  Object.defineProperty(dialog, 'getAnimations', { value: () => [{ finished }] })
  const notes = screen.getByRole('textbox', { name: 'Notes' })
  notes.focus()
  rerender(view(false))
  // In a browser, making the closing content inert removes focus from it.
  notes.blur()
  rerender(view(true))
  expect(screen.getByRole('dialog')).toBe(dialog)
  expect(notes).toHaveFocus()
  await act(async () => finish())
  expect(notes).toHaveFocus()
})
