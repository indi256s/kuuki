// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './toast'

function Trigger({ kind }: { kind?: 'error' }) {
  const { show } = useToast()
  return <button type="button" onClick={() => show({ message: 'Link copied', kind })}>Show</button>
}

describe('Toast', () => {
  afterEach(() => { vi.useRealTimers() })

  it('announces the message in a polite live region', async () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('Link copied')
  })

  it('announces errors assertively', async () => {
    render(<ToastProvider><Trigger kind="error" /></ToastProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Link copied')
  })

  it('auto-dismisses, pausing while hovered', () => {
    vi.useFakeTimers()
    render(<ToastProvider><Trigger /></ToastProvider>)
    act(() => { screen.getByRole('button', { name: 'Show' }).click() })
    const toast = screen.getByText('Link copied').closest('.ui-toast') as HTMLElement
    fireEvent.pointerEnter(toast)
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.getByText('Link copied')).toBeInTheDocument() // held while hovered
    fireEvent.pointerLeave(toast)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(toast).toHaveAttribute('data-state', 'closed') // exit animation running
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText('Link copied')).not.toBeInTheDocument()
  })
})
