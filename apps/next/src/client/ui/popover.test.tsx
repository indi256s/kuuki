// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState, type ComponentProps } from 'react'
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
              ref={
                initialFocus === 'ref'
                  ? (node) => {
                      node?.focus()
                    }
                  : undefined
              }
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

// Vitest ignores imported CSS and jsdom does not run animations. Supply only
// live animation names from the actual stylesheet; Radix still owns Presence.
function bridgePopoverAnimations(reducedMotion: boolean) {
  const css = readFileSync('src/client/ui/ui.css', 'utf8')
  const reducedStart = css.indexOf('@media(prefers-reduced-motion:reduce){.ui-popover')
  const rules = css.slice(0, reducedStart) + (reducedMotion ? css.slice(reducedStart) : '')
  const names = new Map(
    [...rules.matchAll(/\.ui-popover\[data-state=(open|closed)\]\{animation:([^ ;]+)/g)].map(
      (match) => [match[1], match[2]],
    ),
  )
  const getStyle = window.getComputedStyle.bind(window)
  return vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const style = getStyle(element, pseudo)
    if (!element.classList.contains('ui-popover')) return style
    return new Proxy(style, {
      get(target, key) {
        if (key === 'animationName')
          return names.get(element.getAttribute('data-state') ?? '') ?? 'none'
        return Reflect.get(target, key)
      },
    })
  })
}

it.each([
  [false, 'Escape'],
  [false, 'blank'],
  [true, 'Escape'],
  [true, 'blank'],
] as const)(
  'rapid reopening restores the new Chip opener (reduced motion %s, %s dismissal)',
  async (reducedMotion, dismissal) => {
    const animationStyles = bridgePopoverAnimations(reducedMotion)
    try {
      const user = userEvent.setup()
      const onCloseAutoFocus = vi.fn()
      render(<ChipExample onCloseAutoFocus={onCloseAutoFocus} />)
      const trigger = screen.getByRole('button', { name: 'Edit filter' })
      const chip = screen.getByRole('button', { name: 'Period' })
      await user.click(trigger)
      const firstDialog = screen.getByRole('dialog')
      fireEvent.animationStart(firstDialog)
      await user.keyboard('{Escape}')
      // Do not finish an exit animation or wait for close autofocus before reopening.
      const removedOnDismissal = !firstDialog.isConnected
      await user.click(chip)
      const reopenedDialog = screen.getByRole('dialog')
      fireEvent.animationStart(reopenedDialog)
      await user.click(screen.getByRole('button', { name: 'Year' }))
      expect(screen.getByRole('button', { name: 'Year' })).toHaveFocus()
      if (dismissal === 'Escape') await user.keyboard('{Escape}')
      else await user.click(screen.getByText('Blank outside'))
      // Let a regressed animated exit complete so the final focus assertion also
      // observes the real delayed FocusScope callback, rather than just removal.
      if (reopenedDialog.isConnected) {
        fireEvent(
          reopenedDialog,
          Object.assign(new Event('animationend', { bubbles: true }), {
            animationName: getComputedStyle(reopenedDialog).animationName,
          }),
        )
      }
      await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalled())
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      await waitFor(() => expect(chip).toHaveFocus())
      expect(removedOnDismissal).toBe(true)
      expect(onCloseAutoFocus).toHaveBeenCalledTimes(2)
    } finally {
      animationStyles.mockRestore()
    }
  },
)
