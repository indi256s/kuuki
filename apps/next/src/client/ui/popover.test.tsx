// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useCallback, useState, type ComponentProps } from 'react'
import { expect, it, vi } from 'vitest'
import { Chip } from './chip'
import { PopoverContent, PopoverRoot, PopoverTrigger } from './popover'

function Example() {
  return (
    <PopoverRoot>
      <PopoverTrigger>Filter</PopoverTrigger>
      <PopoverContent aria-label="Filters">
        <button type="button">Year</button>
      </PopoverContent>
    </PopoverRoot>
  )
}

it('escape closes and restores focus', async () => {
  const user = userEvent.setup()
  render(<Example />)
  const trigger = screen.getByRole('button', { name: 'Filter' })
  await user.click(trigger)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Year' })).toHaveFocus())
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(trigger).toHaveFocus())
})

function ChipExample({
  initialFocus = 'ordinary',
  ...contentProps
}: {
  initialFocus?: 'ordinary' | 'autoFocus' | 'ref'
} & ComponentProps<typeof PopoverContent>) {
  const [open, setOpen] = useState(false)
  const focusOnAttach = useCallback((node: HTMLInputElement | null) => node?.focus(), [])
  return (
    <>
      <div>Blank outside</div>
      <button type="button">Outside</button>
      <Chip
        label="Period"
        onOpen={() => setOpen(true)}
        onRemove={() => {}}
        removeLabel="Remove period"
      />
      <PopoverRoot open={open} onOpenChange={setOpen}>
        <PopoverTrigger>Edit filter</PopoverTrigger>
        <PopoverContent {...contentProps}>
          {initialFocus === 'ordinary' ? (
            <button type="button">Year</button>
          ) : (
            <input
              aria-label="Year"
              autoFocus={initialFocus === 'autoFocus'}
              ref={initialFocus === 'ref' ? focusOnAttach : undefined}
            />
          )}
        </PopoverContent>
      </PopoverRoot>
    </>
  )
}

it.each(['ordinary', 'autoFocus', 'ref'] as const)(
  'preserves actual openers and outside focus with %s child focus',
  async (initialFocus) => {
    const user = userEvent.setup()
    const onCloseAutoFocus = vi.fn()
    const onOpenAutoFocus = vi.fn()
    const ref = createRef<HTMLDivElement>()
    render(
      <ChipExample
        initialFocus={initialFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={onOpenAutoFocus}
        ref={ref}
      />,
    )
    const chip = screen.getByRole('button', { name: 'Period' })
    const trigger = screen.getByRole('button', { name: 'Edit filter' })
    const outside = screen.getByRole('button', { name: 'Outside' })
    // Reopening from a different control must refresh the return target.
    for (const [index, opener] of [chip, trigger, chip].entries()) {
      await user.click(opener)
      await waitFor(() =>
        expect(
          screen.getByRole(initialFocus === 'ordinary' ? 'button' : 'textbox', { name: 'Year' }),
        ).toHaveFocus(),
      )
      expect(ref.current).toBe(screen.getByRole('dialog'))
      if (index === 0) await user.keyboard('{Escape}')
      else if (index === 1) await user.click(screen.getByText('Blank outside'))
      else await user.click(outside)
      await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledTimes(index + 1))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(ref.current).toBeNull()
      expect(index === 2 ? outside : opener).toHaveFocus()
    }
    expect(onOpenAutoFocus).toHaveBeenCalledTimes(initialFocus === 'ordinary' ? 3 : 0)
  },
)

it.each(['ordinary', 'autoFocus', 'ref'] as const)(
  'restores the Chip after blank dismissal with %s child focus',
  async (initialFocus) => {
    const user = userEvent.setup()
    const onCloseAutoFocus = vi.fn()
    render(<ChipExample initialFocus={initialFocus} onCloseAutoFocus={onCloseAutoFocus} />)
    const opener = screen.getByRole('button', { name: 'Period' })
    await user.click(opener)
    await waitFor(() =>
      expect(
        screen.getByRole(initialFocus === 'ordinary' ? 'button' : 'textbox', { name: 'Year' }),
      ).toHaveFocus(),
    )
    await user.click(screen.getByText('Blank outside'))
    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  },
)

it('keeps registered-trigger fallback when opened without a meaningful focused opener', async () => {
  const user = userEvent.setup()
  const onCloseAutoFocus = vi.fn()
  render(
    <PopoverRoot defaultOpen>
      <PopoverTrigger>Filter</PopoverTrigger>
      <PopoverContent onCloseAutoFocus={onCloseAutoFocus}>
        <input aria-label="Year" autoFocus />
      </PopoverContent>
    </PopoverRoot>,
  )
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Year' })).toHaveFocus())
  await user.keyboard('{Escape}')
  await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: 'Filter' })).toHaveFocus()
})

it('honors close cancellation after early child focus and clears the forwarded callback ref', async () => {
  const user = userEvent.setup()
  const ref = vi.fn()
  const onCloseAutoFocus = vi.fn((event: Event) => {
    event.preventDefault()
    screen.getByRole('button', { name: 'Outside' }).focus()
  })
  render(<ChipExample initialFocus="autoFocus" onCloseAutoFocus={onCloseAutoFocus} ref={ref} />)
  await user.click(screen.getByRole('button', { name: 'Period' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Year' })).toHaveFocus())
  expect(ref).toHaveBeenLastCalledWith(screen.getByRole('dialog'))
  await user.keyboard('{Escape}')
  await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus()
  expect(ref).toHaveBeenLastCalledWith(null)
})

it('honors caller autofocus cancellation on open and close', async () => {
  const user = userEvent.setup()
  const onOpenAutoFocus = vi.fn((event: Event) => event.preventDefault())
  const onCloseAutoFocus = vi.fn((event: Event) => {
    event.preventDefault()
    screen.getByRole('button', { name: 'Outside' }).focus()
  })
  render(
    <>
      <button type="button">Outside</button>
      <PopoverRoot>
        <PopoverTrigger>Filter</PopoverTrigger>
        <PopoverContent onOpenAutoFocus={onOpenAutoFocus} onCloseAutoFocus={onCloseAutoFocus}>
          <button type="button">Year</button>
        </PopoverContent>
      </PopoverRoot>
    </>,
  )
  const trigger = screen.getByRole('button', { name: 'Filter' })
  await user.click(trigger)
  expect(onOpenAutoFocus).toHaveBeenCalledTimes(1)
  expect(trigger).toHaveFocus()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus()
})

it.each(['Escape', 'blank'] as const)(
  'rapid keyboard reopening restores the new Chip opener (%s dismissal)',
  async (dismissal) => {
    const user = userEvent.setup()
    const onCloseAutoFocus = vi.fn()
    render(<ChipExample onCloseAutoFocus={onCloseAutoFocus} />)
    const trigger = screen.getByRole('button', { name: 'Edit filter' })
    const chip = screen.getByRole('button', { name: 'Period' })
    await user.click(trigger)
    const firstDialog = screen.getByRole('dialog')
    await user.keyboard('{Escape}')
    // Do not finish an exit animation or wait for close autofocus before reopening.
    const removedOnDismissal = !firstDialog.isConnected
    await user.click(chip)
    await user.click(screen.getByRole('button', { name: 'Year' }))
    expect(screen.getByRole('button', { name: 'Year' })).toHaveFocus()
    if (dismissal === 'Escape') await user.keyboard('{Escape}')
    else await user.click(screen.getByText('Blank outside'))
    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(chip).toHaveFocus())
    expect(removedOnDismissal).toBe(true)
    expect(onCloseAutoFocus).toHaveBeenCalledTimes(2)
  },
)

it('retains a pointer exit, cancels its removal on reopen, and releases focus after the next exit', async () => {
  const user = userEvent.setup()
  const onCloseAutoFocus = vi.fn()
  render(<ChipExample onCloseAutoFocus={onCloseAutoFocus} />)
  await user.click(screen.getByRole('button', { name: 'Edit filter' }))
  const dialog = screen.getByRole('dialog')
  let finishFirst!: () => void
  let finishSecond!: () => void
  const first = new Promise<void>((resolve) => {
    finishFirst = resolve
  })
  const second = new Promise<void>((resolve) => {
    finishSecond = resolve
  })
  const getAnimations = vi
    .fn()
    .mockReturnValueOnce([{ finished: first }])
    .mockReturnValueOnce([{ finished: second }])
  Object.defineProperty(dialog, 'getAnimations', { value: getAnimations })
  await user.click(screen.getByText('Blank outside'))
  expect(dialog).toBeInTheDocument()
  expect(dialog).toHaveAttribute('data-state', 'closed')
  expect(onCloseAutoFocus).not.toHaveBeenCalled()
  const chip = screen.getByRole('button', { name: 'Period' })
  await user.click(chip)
  expect(screen.getByRole('dialog')).toBe(dialog)
  await act(async () => finishFirst())
  expect(dialog).toHaveAttribute('data-state', 'open')
  await user.click(screen.getByText('Blank outside'))
  expect(dialog).toBeInTheDocument()
  await act(async () => finishSecond())
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
  await waitFor(() => expect(chip).toHaveFocus())
  expect(onCloseAutoFocus).toHaveBeenCalledTimes(1)
})
