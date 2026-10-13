// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { Sheet } from './sheet'
import { ToastProvider, ToastSlot, useToast } from './toast'

function Trigger({ kind }: { kind?: 'error' }) {
  const { show } = useToast()
  return (
    <button type="button" onClick={() => show({ message: 'Link copied', kind })}>
      Show
    </button>
  )
}

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('announces the message in a polite live region', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('Link copied')
  })

  it('announces errors assertively', async () => {
    render(
      <ToastProvider>
        <Trigger kind="error" />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Link copied')
  })

  it('auto-dismisses, pausing while hovered', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    act(() => {
      screen.getByRole('button', { name: 'Show' }).click()
    })
    const toast = screen.getByText('Link copied').closest('.ui-toast') as HTMLElement
    fireEvent.pointerEnter(toast)
    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(screen.getByText('Link copied')).toBeInTheDocument() // held while hovered
    fireEvent.pointerLeave(toast)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(toast).toHaveAttribute('data-state', 'closed') // exit animation running
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(screen.queryByText('Link copied')).not.toBeInTheDocument()
  })

  it('springs back from a short swipe and dismisses on a long one', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    act(() => {
      screen.getByRole('button', { name: 'Show' }).click()
    })
    const toast = screen.getByText('Link copied').closest('.ui-toast') as HTMLElement
    const swipe = (to: number) => {
      fireEvent.pointerDown(toast, { pointerId: 1, clientX: 0, timeStamp: 0 })
      fireEvent.pointerMove(toast, { pointerId: 1, clientX: to, timeStamp: 1000 })
      fireEvent.pointerUp(toast, { pointerId: 1, clientX: to, timeStamp: 1000 })
    }
    swipe(40)
    expect(toast).toHaveAttribute('data-state', 'open')
    expect(toast.style.translate).toBe('')
    swipe(120)
    expect(toast).toHaveAttribute('data-thrown', 'true')
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(screen.queryByText('Link copied')).not.toBeInTheDocument()
  })
})

it('keeps announcements exposed while a Radix modal sheet is open', async () => {
  function Modal() {
    const [open, setOpen] = useState(false)
    return (
      <Sheet
        title="Review"
        open={open}
        onOpenChange={setOpen}
        trigger={<button>Open review</button>}
      >
        <Trigger />
      </Sheet>
    )
  }
  render(
    <ToastProvider>
      <Modal />
    </ToastProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Open review' }))
  await userEvent.click(screen.getByRole('button', { name: 'Show' }))
  const announcement = screen
    .getAllByRole('status')
    .find((region) => region.textContent?.includes('Link copied'))!
  expect(announcement).toHaveTextContent('Link copied')
  expect(announcement.closest('[aria-hidden="true"]')).toBeNull()
})

describe('ToastSlot', () => {
  it('renders a caller-owned notice inline when no provider is mounted', () => {
    const { container } = render(
      <section>
        <ToastSlot>
          <p aria-live="polite" role="status">
            Pending
          </p>
        </ToastSlot>
      </section>,
    )
    expect(container.querySelector('section')).toContainElement(screen.getByText('Pending'))
  })

  it('renders it in the provider region, outside both live regions, and keeps it exposed under a Radix modal', async () => {
    function Notice() {
      const [open, setOpen] = useState(false)
      return (
        <section data-testid="owner">
          <Sheet
            title="Review"
            open={open}
            onOpenChange={setOpen}
            trigger={<button>Open review</button>}
          >
            <p>Body</p>
          </Sheet>
          <ToastSlot>
            <p aria-live="polite" role="status">
              Pending
            </p>
          </ToastSlot>
        </section>
      )
    }
    render(
      <ToastProvider>
        <Notice />
      </ToastProvider>,
    )
    const pending = screen.getByText('Pending')
    expect(screen.getByTestId('owner')).not.toContainElement(pending)
    expect(pending.closest('.ui-toast-region')).not.toBeNull()
    expect(pending.closest('.ui-toast-live')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open review' }))
    expect(screen.getAllByRole('status').map((region) => region.textContent)).toContain('Pending')
    expect(pending.closest('[aria-hidden="true"]')).toBeNull()
  })
})
