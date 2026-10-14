// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rubberBand } from './bottom-sheet'
import { Sheet, shouldDismiss } from './sheet'
import { Menu, MenuItem } from './menu'

function Harness({ onChange }: { onChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet
      side="right"
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        onChange?.(next)
      }}
      title="Country"
      trigger={<button type="button">Open sheet</button>}
      footer={<button type="button">Done</button>}
    >
      <p>Body text</p>
    </Sheet>
  )
}

function pointer(
  target: Element,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  clientY: number,
  timeStamp: number,
) {
  const event = createEvent[type](target, { clientY, clientX: clientY, pointerId: 1, button: 0 })
  Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  fireEvent(target, event)
}

describe('shouldDismiss', () => {
  it('dismisses past 35% of the height', () => {
    expect(shouldDismiss({ distance: 180, height: 500, velocity: 0 })).toBe(true)
  })
  it('dismisses on a fast flick even when short', () => {
    expect(shouldDismiss({ distance: 20, height: 500, velocity: 0.2 })).toBe(true)
  })
  it('snaps back on a slow short drag', () => {
    expect(shouldDismiss({ distance: 100, height: 500, velocity: 0.05 })).toBe(false)
  })
  it('never dismisses when dragged against the open direction', () => {
    expect(shouldDismiss({ distance: -300, height: 500, velocity: -1 })).toBe(false)
  })
  it('damps overshoot below the limit', () => {
    expect(rubberBand(1000)).toBeLessThan(80)
    expect(rubberBand(50)).toBeLessThan(50)
  })
})

describe('Sheet', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 500,
      top: 0,
      left: 0,
      right: 400,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

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

  it('stays mounted, closed, while its exit animation plays', async () => {
    // Presence reads the Content node's animation; a dropped ref made the sheet vanish before its exit could play.
    const style = document.createElement('style')
    style.textContent =
      ".ui-sheet[data-state='open'] { animation-name: ui-sheet-in-r } .ui-sheet[data-state='closed'] { animation-name: ui-sheet-out-r }"
    document.head.appendChild(style)
    try {
      const user = userEvent.setup()
      render(<Harness />)
      await user.click(screen.getByRole('button', { name: 'Open sheet' }))
      const dialog = await screen.findByRole('dialog', { name: 'Country' })
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveAttribute('data-state', 'closed')
    } finally {
      style.remove()
    }
  })

  it('has a visible close button as the keyboard alternative', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps keyboard focus in a portalled menu until selection returns it to the sheet', async () => {
    const user = userEvent.setup()
    const selected = vi.fn()
    render(
      <Sheet open onOpenChange={() => {}} title="Rankings">
        <Menu trigger={<button type="button">Section options</button>}>
          <MenuItem>Move up</MenuItem>
          <MenuItem onSelect={selected}>Hide</MenuItem>
        </Menu>
      </Sheet>,
    )
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Rankings' })).toHaveFocus())
    await user.tab()
    await user.tab()
    await user.tab()
    const trigger = screen.getByRole('button', { name: 'Section options' })
    expect(trigger).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Move up' })).toHaveFocus())
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Hide' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(selected).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('dialog', { name: 'Rankings' })).toBeInTheDocument()
  })

  it('an outside press closes only the menu, and the next one closes the sheet', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <Sheet open onOpenChange={onOpenChange} title="Rankings">
        <Menu trigger={<button type="button">Section options</button>}>
          <MenuItem>Move up</MenuItem>
        </Menu>
      </Sheet>,
    )
    screen.getByRole('button', { name: 'Section options' }).focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('menu')
    // Radix starts listening for outside presses a task after the menu mounts.
    await new Promise((resolve) => setTimeout(resolve))
    const shield = document.querySelector('.ui-menu-shield')!
    fireEvent.pointerDown(shield)
    fireEvent.pointerUp(shield)
    fireEvent.click(shield)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(onOpenChange).not.toHaveBeenCalled()
    await user.click(document.querySelector('.ui-overlay')!)
    expect(onOpenChange).toHaveBeenCalledWith(false)
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

  it('drops the dragged offset when reopened during a drag-dismiss exit', async () => {
    const style = document.createElement('style')
    style.textContent =
      ".ui-sheet[data-state='open'] { animation-name: ui-sheet-in-r } .ui-sheet[data-state='closed'] { animation-name: ui-sheet-out-r }"
    document.head.appendChild(style)
    try {
      render(<Harness />)
      const trigger = screen.getByRole('button', { name: 'Open sheet' })
      await userEvent.click(trigger)
      const dialog = await screen.findByRole('dialog', { name: 'Country' })
      const handle = screen.getByTestId('sheet-handle')
      pointer(handle, 'pointerDown', 100, 1000)
      pointer(handle, 'pointerMove', 130, 1050)
      pointer(handle, 'pointerUp', 160, 1100)
      expect(dialog).toHaveAttribute('data-state', 'closed')
      expect(dialog.style.transform).toBe('translateX(30px)')
      fireEvent.click(trigger)
      await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'open'))
      expect(dialog.style.transform).toBe('')
    } finally {
      style.remove()
    }
  })

  it('snaps back after a slow short drag', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open sheet' }))
    const handle = await screen.findByTestId('sheet-handle')
    const sheet = screen.getByRole('dialog')
    pointer(handle, 'pointerDown', 100, 1000)
    pointer(handle, 'pointerMove', 130, 2000)
    expect(sheet.style.transform).toBe('translateX(30px)')
    pointer(handle, 'pointerUp', 140, 3000) // 40px of 500, ~0.01 px/ms
    expect(onChange).not.toHaveBeenCalledWith(false)
    expect(sheet.style.transform).toBe('translateX(0px)')
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
    expect(sheet.style.transform).toBe('')
    expect(onChange).not.toHaveBeenCalledWith(false)
  })
})
