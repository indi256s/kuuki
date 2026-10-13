// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Sheet } from './sheet'
import { BottomSheet } from './bottom-sheet'

const settings = vi.hoisted(() => ({ reduced: true }))

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => settings.reduced,
}))

beforeEach(() => {
  settings.reduced = true
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(860)
})
afterEach(() => {
  vi.restoreAllMocks()
  document.documentElement.lang = 'en'
})

function pointer(
  target: Element,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel',
  y: number,
  time: number,
  primary = true,
) {
  const event = createEvent[type](target)
  Object.defineProperties(event, {
    clientY: { value: y },
    button: { value: 0 },
    buttons: { value: 1 },
    isPrimary: { value: primary },
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    timeStamp: { value: time },
  })
  fireEvent(target, event)
}

it('upgrades shared bottom sheets with sorted detents, keyboard access and announcements', async () => {
  const changed = vi.fn()
  render(
    <Sheet
      open
      onOpenChange={() => {}}
      title="Filters"
      detents={[0.9, 0.4, 0.7]}
      onDetentChange={changed}
    >
      Filters
    </Sheet>,
  )
  expect(screen.getByRole('dialog')).toHaveFocus()
  const grabber = screen.getByRole('button', { name: 'Expand sheet' })
  grabber.focus()
  fireEvent.keyDown(grabber, { key: 'ArrowUp' })
  expect(changed).toHaveBeenLastCalledWith(1)
  fireEvent.keyDown(grabber, { key: 'Home' })
  expect(grabber).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('status')).toHaveTextContent('Sheet expanded')
  fireEvent.keyDown(grabber, { key: 'End' })
  expect(changed).toHaveBeenLastCalledWith(0)
  await userEvent.click(grabber)
  expect(changed).toHaveBeenLastCalledWith(2)
})

it('expands before reading keys or wheel scrolling, without stealing input keys', () => {
  render(
    <Sheet open onOpenChange={() => {}} title="Filters">
      <input aria-label="Search" />
    </Sheet>,
  )
  const grabber = screen.getByRole('button', { name: 'Expand sheet' })
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowDown' })
  expect(grabber).toHaveAttribute('aria-expanded', 'false')
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'PageDown' })
  expect(grabber).toHaveAttribute('aria-expanded', 'true')
  fireEvent.keyDown(grabber, { key: 'End' })
  fireEvent.wheel(screen.getByRole('textbox'), { deltaY: 20 })
  expect(grabber).toHaveAttribute('aria-expanded', 'true')
})

it('snaps an upward flick to full height and cancels a downward drag without dismissing', () => {
  const changed = vi.fn()
  const opened = vi.fn()
  render(
    <Sheet open onOpenChange={opened} title="Trip" onDetentChange={changed}>
      Details
    </Sheet>,
  )
  const grabber = screen.getByRole('button', { name: 'Expand sheet' })
  pointer(grabber, 'pointerDown', 400, 1000)
  pointer(grabber, 'pointerMove', 340, 1050)
  pointer(grabber, 'pointerUp', 340, 1060)
  expect(changed).toHaveBeenLastCalledWith(1)
  pointer(grabber, 'pointerDown', 100, 2000)
  pointer(grabber, 'pointerMove', 600, 2050)
  pointer(grabber, 'pointerCancel', 600, 2060)
  expect(opened).not.toHaveBeenCalled()
  expect(grabber).toHaveAttribute('aria-expanded', 'true')
})

it('touches expand the content but leave horizontal chapter gestures native', () => {
  render(
    <Sheet open onOpenChange={() => {}} title="Chapters">
      <p>Chapter</p>
    </Sheet>,
  )
  const body = screen.getByText('Chapter')
  const grabber = screen.getByRole('button', { name: 'Expand sheet' })
  fireEvent.touchStart(body, {
    changedTouches: [{ clientX: 100, clientY: 400 }],
    touches: [{ clientX: 100, clientY: 400 }],
  })
  const horizontal = createEvent.touchMove(body, {
    changedTouches: [{ clientX: 100, clientY: 400 }],
    touches: [{ clientX: 200, clientY: 402 }],
    cancelable: true,
  })
  fireEvent(body, horizontal)
  fireEvent.touchEnd(body)
  expect(horizontal.defaultPrevented).toBe(false)
  expect(grabber).toHaveAttribute('aria-expanded', 'false')
  fireEvent.touchStart(body, {
    changedTouches: [{ clientX: 100, clientY: 400 }],
    touches: [{ clientX: 100, clientY: 400 }],
  })
  fireEvent.touchMove(body, {
    changedTouches: [{ clientX: 100, clientY: 400 }],
    touches: [{ clientX: 100, clientY: 390 }],
  })
  fireEvent.touchMove(body, {
    changedTouches: [{ clientX: 100, clientY: 400 }],
    touches: [{ clientX: 100, clientY: 0 }],
  })
  fireEvent.touchEnd(body)
  expect(grabber).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(grabber, { detail: 0 })
  expect(grabber).toHaveAttribute('aria-expanded', 'false')
})

it('supports uncontrolled opening, localized controls and focus return', async () => {
  document.documentElement.lang = 'ru'
  render(
    <BottomSheet title="Поездка" trigger={<button>Открыть</button>}>
      Детали
    </BottomSheet>,
  )
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'Открыть' })
  await user.click(trigger)
  expect(screen.getByRole('button', { name: 'Развернуть панель' })).toBeInTheDocument()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(trigger).toHaveFocus()
})

it('closing during a header drag removes the sheet even if the pointer releases afterward', async () => {
  settings.reduced = false
  const { rerender } = render(
    <Sheet open onOpenChange={() => {}} title="Trip">
      Details
    </Sheet>,
  )
  const grabber = screen.getByRole('button', { name: 'Expand sheet' })
  pointer(grabber, 'pointerDown', 400, 1000)
  pointer(grabber, 'pointerMove', 300, 1050)
  rerender(
    <Sheet open={false} onOpenChange={() => {}} title="Trip">
      Details
    </Sheet>,
  )
  pointer(grabber, 'pointerUp', 300, 1100)
  await waitFor(() => expect(document.querySelector('.ui-bottom-sheet')).toBeNull(), {
    timeout: 2000,
  })
})

it('secondary header pointers cannot settle the primary drag', () => {
  const changed = vi.fn()
  render(
    <Sheet open onOpenChange={() => {}} title="Trip" onDetentChange={changed}>
      Details
    </Sheet>,
  )
  const grabber = screen.getByRole('button', { name: 'Expand sheet' })
  pointer(grabber, 'pointerDown', 400, 1000)
  pointer(grabber, 'pointerMove', 340, 1050)
  pointer(grabber, 'pointerUp', 340, 1060, false)
  expect(changed).not.toHaveBeenCalled()
  pointer(grabber, 'pointerUp', 340, 1060)
  expect(changed).toHaveBeenLastCalledWith(1)
})

it('expands when focus reaches content below the peek footer', () => {
  render(
    <Sheet open onOpenChange={() => {}} title="Filters" footer={<button>Apply</button>}>
      <input aria-label="Last filter" />
    </Sheet>,
  )
  const input = screen.getByRole('textbox', { name: 'Last filter' })
  const body = input.parentElement!
  const footer = screen.getByRole('button', { name: 'Apply' }).parentElement!
  const rect = (top: number, bottom: number) => ({
    x: 0,
    y: top,
    left: 0,
    right: 390,
    top,
    bottom,
    width: 390,
    height: bottom - top,
    toJSON: () => ({}),
  })
  vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect(400, 1100))
  vi.spyOn(footer, 'getBoundingClientRect').mockReturnValue(rect(700, 760))
  vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(rect(730, 750))
  fireEvent.focus(input)
  expect(screen.getByRole('button', { name: 'Collapse sheet' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
})

it('settles a body drag after the caller rerenders with a new open-change callback', () => {
  const { rerender } = render(
    <Sheet open onOpenChange={() => {}} title="Trip">
      <p>Details</p>
    </Sheet>,
  )
  const body = screen.getByText('Details')
  const touch = (clientY: number) => ({
    touches: [{ clientX: 100, clientY }],
    changedTouches: [{ clientX: 100, clientY }],
  })
  fireEvent.touchStart(body, touch(400))
  fireEvent.touchMove(body, touch(390))
  fireEvent.touchMove(body, touch(0))
  rerender(
    <Sheet open onOpenChange={() => {}} title="Trip">
      <p>Details</p>
    </Sheet>,
  )
  fireEvent.touchEnd(body, { touches: [], changedTouches: [{ clientX: 100, clientY: 0 }] })
  expect(screen.getByRole('button', { name: 'Collapse sheet' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
})

it('keeps a titleAction beside the heading, outside its accessible name', () => {
  render(
    <Sheet
      open
      onOpenChange={() => {}}
      title="Rankings"
      titleAction={<button>Rankings options</button>}
    >
      <p>Details</p>
    </Sheet>,
  )
  const heading = screen.getByRole('heading', { name: 'Rankings' })
  expect(heading).not.toContainElement(screen.getByRole('button', { name: 'Rankings options' }))
})
