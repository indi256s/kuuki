// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sheet, rubberBand, shouldDismiss } from './sheet'

function Harness({ onChange }: { onChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false)
  return <Sheet open={open} onOpenChange={next => { setOpen(next); onChange?.(next) }} title="Country" trigger={<button type="button">Open sheet</button>} footer={<button type="button">Done</button>}><p>Body text</p></Sheet>
}

function pointer(target: Element, type: 'pointerDown' | 'pointerMove' | 'pointerUp', clientY: number, timeStamp: number) {
  const event = createEvent[type](target, { clientY, clientX: 0, pointerId: 1, button: 0 })
  Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  fireEvent(target, event)
}

describe('shouldDismiss', () => {
  it('dismisses past 35% of the height', () => { expect(shouldDismiss({ distance: 180, height: 500, velocity: 0 })).toBe(true) })
  it('dismisses on a fast flick even when short', () => { expect(shouldDismiss({ distance: 20, height: 500, velocity: 0.2 })).toBe(true) })
  it('snaps back on a slow short drag', () => { expect(shouldDismiss({ distance: 100, height: 500, velocity: 0.05 })).toBe(false) })
  it('never dismisses when dragged against the open direction', () => { expect(shouldDismiss({ distance: -300, height: 500, velocity: -1 })).toBe(false) })
  it('damps overshoot below the limit', () => { expect(rubberBand(1000)).toBeLessThan(80); expect(rubberBand(50)).toBeLessThan(50) })
})

describe('Sheet', () => {
  beforeEach(() => { vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 400, height: 500, top: 0, left: 0, right: 400, bottom: 500, x: 0, y: 0, toJSON: () => ({}) }) })
  afterEach(() => { vi.restoreAllMocks() })

  it('Escape closes and focus returns to the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open sheet' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Country' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('has a visible close button as the keyboard alternative', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('dismisses on a fast drag of the handle', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open sheet' }))
    const handle = await screen.findByTestId('sheet-handle')
    pointer(handle, 'pointerDown', 100, 1000)
    pointer(handle, 'pointerMove', 130, 1050)
    pointer(handle, 'pointerUp', 160, 1100) // 60px in 100ms = 0.6 px/ms
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('snaps back after a slow short drag', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open sheet' }))
    const handle = await screen.findByTestId('sheet-handle')
    const sheet = screen.getByRole('dialog')
    pointer(handle, 'pointerDown', 100, 1000)
    pointer(handle, 'pointerMove', 130, 2000)
    expect(sheet.style.getPropertyValue('--sheet-drag')).toBe('30px')
    pointer(handle, 'pointerUp', 140, 3000) // 40px of 500, ~0.01 px/ms
    expect(onChange).not.toHaveBeenCalledWith(false)
    expect(sheet.style.getPropertyValue('--sheet-drag')).toBe('0px')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not move when the body is dragged', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open sheet' }))
    const body = await screen.findByText('Body text')
    const sheet = screen.getByRole('dialog')
    pointer(body, 'pointerDown', 100, 1000)
    pointer(body, 'pointerMove', 400, 1010)
    pointer(body, 'pointerUp', 500, 1020)
    expect(sheet.style.getPropertyValue('--sheet-drag')).toBe('')
    expect(onChange).not.toHaveBeenCalledWith(false)
  })
})
