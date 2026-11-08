// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { YearDrum, dragPosition, project, snapIndex, yearValues, type YearValue } from './year-drum'

it('lists no year first, then the current year down to 1930', () => {
  const values = yearValues(2026)
  expect(values.slice(0, 3)).toEqual([null, 2026, 2025])
  expect(values.at(-1)).toBe(1930)
})

it('snaps a release to the row nearest the projected rest, clamped at both ends', () => {
  // 10 rows per second coasts about five rows further: from row 3 it rests near row 8.
  expect(snapIndex(project(3, 10), 98)).toBe(8)
  expect(snapIndex(project(3, -10), 98)).toBe(0)
  expect(snapIndex(project(90, 100), 98)).toBe(97)
  // A slow release stays on the nearest row.
  expect(snapIndex(project(3.4, 0.2), 98)).toBe(3)
})

it('drags 1:1 inside the list and rubber-bands past either end, alike at both, never past the window', () => {
  expect(dragPosition(5.5, 97)).toBe(5.5)
  const pulled = dragPosition(-2, 97)
  expect(pulled).toBeGreaterThan(-2)
  expect(pulled).toBeLessThan(0)
  expect(dragPosition(99, 97) - 97).toBeCloseTo(-pulled)
  expect(dragPosition(-1000, 97)).toBeGreaterThan(-3)
})

function open(value: YearValue = null) {
  const onClose = vi.fn()
  render(<YearDrum value={value} locale="en" onClose={onClose} instant />)
  const drum = screen.getByRole('spinbutton', { name: 'Year of visit' })
  return { onClose, drum }
}
const year = new Date().getFullYear()

it('steps with the arrows, pages by ten, and Enter commits once', () => {
  const { onClose, drum } = open()
  expect(drum).toHaveAttribute('aria-valuetext', 'no year')
  fireEvent.keyDown(drum, { key: 'ArrowDown' })
  expect(drum).toHaveAttribute('aria-valuetext', String(year))
  fireEvent.keyDown(drum, { key: 'PageDown' })
  expect(drum).toHaveAttribute('aria-valuetext', String(year - 10))
  fireEvent.keyDown(drum, { key: 'ArrowUp' })
  expect(drum).toHaveAttribute('aria-valuetext', String(year - 9))
  fireEvent.keyDown(drum, { key: 'End' })
  expect(drum).toHaveAttribute('aria-valuetext', '1930')
  fireEvent.keyDown(drum, { key: 'Home' })
  expect(drum).toHaveAttribute('aria-valuetext', 'no year')
  fireEvent.keyDown(drum, { key: 'PageDown' })
  fireEvent.keyDown(drum, { key: 'Enter' })
  fireEvent.keyDown(drum, { key: 'Enter' })
  expect(onClose).toHaveBeenCalledExactlyOnceWith({
    year: year - 9,
    changed: true,
    refocus: true,
  })
})

it('Escape restores the year it opened on and commits nothing', () => {
  const { onClose, drum } = open(2019)
  fireEvent.keyDown(drum, { key: 'PageUp' })
  fireEvent.keyDown(drum, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledExactlyOnceWith({ year: 2019, changed: false, refocus: true })
})

it('an untouched drum closes unchanged, even on a year outside its range', () => {
  const { onClose, drum } = open(1900)
  fireEvent.keyDown(drum, { key: 'Enter' })
  expect(onClose).toHaveBeenCalledExactlyOnceWith({ year: 1900, changed: false, refocus: true })
})

it('a press outside commits the year on the drum', () => {
  const { onClose, drum } = open()
  fireEvent.keyDown(drum, { key: 'ArrowDown' })
  fireEvent.pointerDown(document.body)
  expect(onClose).toHaveBeenCalledExactlyOnceWith({ year, changed: true, refocus: false })
})

it('a press on the control that opened it closes the drum, and that click does not reopen it', () => {
  const reopen = vi.fn()
  const onClose = vi.fn()
  const trigger = document.createElement('button')
  trigger.addEventListener('click', reopen)
  document.body.appendChild(trigger)
  render(<YearDrum value={null} locale="en" onClose={onClose} instant trigger={() => trigger} />)
  fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowDown' })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
  expect(onClose).toHaveBeenCalledExactlyOnceWith({ year, changed: true, refocus: true })
  expect(reopen).not.toHaveBeenCalled()
  trigger.remove()
})
