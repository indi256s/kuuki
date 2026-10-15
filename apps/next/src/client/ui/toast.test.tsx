// @vitest-environment jsdom
import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { Sheet } from './sheet'
import { ToastProvider, ToastSlot, useToast } from './toast'
import { setLocale } from '../appearance'

function Trigger({ kind }: { kind?: 'error' }) {
  const { show } = useToast()
  return (
    <button type="button" onClick={() => show({ message: 'Link copied', kind })}>
      Show
    </button>
  )
}

function pointer(
  target: Element,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel',
  x: number,
  time: number,
) {
  const event = createEvent[type](target)
  Object.defineProperties(event, {
    clientX: { value: x },
    button: { value: 0 },
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    isPrimary: { value: true },
    timeStamp: { value: time },
  })
  fireEvent(target, event)
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

  it('translates a visible notice without restarting its dismissal timer', () => {
    vi.useFakeTimers()
    document.documentElement.lang = 'en'
    function LocalizedTrigger() {
      const { show } = useToast()
      return (
        <button
          onClick={() =>
            show({
              message: { en: 'Flight saved', ru: 'Перелёт сохранён' },
              description: { en: 'Totals updated.', ru: 'Итоги обновлены.' },
            })
          }
        >
          Show translated
        </button>
      )
    }
    render(
      <ToastProvider>
        <LocalizedTrigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show translated' }))
    const toast = screen.getByText('Flight saved').closest('.ui-toast')!
    act(() => vi.advanceTimersByTime(4000))
    act(() => setLocale('ru'))
    expect(screen.getByText('Перелёт сохранён').closest('.ui-toast')).toBe(toast)
    expect(screen.getByText('Итоги обновлены.')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1000))
    expect(toast).toHaveAttribute('data-state', 'closed')
    act(() => vi.advanceTimersByTime(250))
    expect(screen.queryByText('Перелёт сохранён')).not.toBeInTheDocument()
    document.documentElement.lang = 'en'
    delete document.documentElement.dataset.locale
    document.cookie = 'kuuki_locale=; Max-Age=0; Path=/'
    localStorage.removeItem('kuuki-language')
  })

  it('holds its current entry and settle pose when caught, then follows the new pointer delta', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    const toast = screen.getByText('Link copied').closest('.ui-toast') as HTMLElement
    const offset = (axis: 'X' | 'Y') =>
      Number(
        toast.style.transform.match(new RegExp(`translate${axis}\\(([-.0-9]+)px\\)`))?.[1] ?? 0,
      )
    await waitFor(() => {
      expect(offset('Y')).toBeGreaterThan(0)
      expect(offset('Y')).toBeLessThan(16)
    })
    pointer(toast, 'pointerDown', 0, 0)
    // Let a scheduled render finish; the held pose must then remain fixed beyond entry's duration.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    const caught = toast.style.transform
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320))
    })
    expect(toast.style.transform).toBe(caught)
    pointer(toast, 'pointerMove', 40, 1000)
    await waitFor(() => expect(offset('X')).toBe(40))
    pointer(toast, 'pointerUp', 40, 1000)
    await waitFor(() => {
      expect(offset('X')).toBeGreaterThan(0)
      expect(offset('X')).toBeLessThan(40)
    })
    pointer(toast, 'pointerDown', 100, 2000)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    const caughtX = offset('X')
    pointer(toast, 'pointerMove', 105, 3000)
    await waitFor(() => expect(offset('X')).toBeCloseTo(caughtX + 5, 4))
    pointer(toast, 'pointerCancel', 105, 3000)
    await waitFor(() => expect(offset('X')).toBe(0))
    expect(toast).toHaveAttribute('data-state', 'open')
  })

  it('keeps its timeout paused while a captured drag leaves the toast', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    const toast = screen.getByText('Link copied').closest('.ui-toast') as HTMLElement
    act(() => vi.advanceTimersByTime(4000))
    pointer(toast, 'pointerDown', 0, 0)
    fireEvent.pointerLeave(toast)
    act(() => vi.advanceTimersByTime(6000))
    expect(toast).toBeInTheDocument()
    expect(toast).toHaveAttribute('data-state', 'open')
    pointer(toast, 'pointerCancel', 0, 1000)
    act(() => vi.advanceTimersByTime(1000))
    expect(toast).toHaveAttribute('data-state', 'closed')
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
      pointer(toast, 'pointerDown', 0, 0)
      pointer(toast, 'pointerMove', to, 1000)
      pointer(toast, 'pointerUp', to, 1000)
    }
    swipe(40)
    expect(toast).toHaveAttribute('data-state', 'open')
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
