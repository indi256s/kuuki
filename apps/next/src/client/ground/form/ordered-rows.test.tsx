// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { announceShellNotice } from '../../shell-notices'
import { moved, OrderedRows, restored, RowDetails, RowFields } from './ordered-rows'

vi.mock('../../shell-notices', () => ({ announceShellNotice: vi.fn() }))

type Row = { id: string; name: string }
const rows: Row[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
]

function Harness() {
  const [items, setItems] = useState(rows)
  return (
    <OrderedRows
      items={items}
      ownerId="owner"
      locale="en"
      label="Rows"
      title={(item) => item.name}
      name={(item) => item.name}
      onMove={(from, to) => setItems((list) => moved(list, from, to))}
      onRemove={(id) => setItems((list) => list.filter((item) => item.id !== id))}
      onRestore={setItems}
    >
      {(item) => <span>{item.name} fields</span>}
    </OrderedRows>
  )
}

const names = () => screen.getAllByRole('listitem').map((node) => node.textContent?.trim())

beforeEach(() => vi.mocked(announceShellNotice).mockClear())

describe('OrderedRows remove', () => {
  it('removes at once and offers a six-second Undo that puts the same row back at its index', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Beta' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove' }))
    expect(screen.getByRole('button', { name: 'Actions for Gamma' })).toHaveFocus()
    expect(names()).toHaveLength(2)
    const toast = vi.mocked(announceShellNotice).mock.calls[0]![1]
    expect(toast).toMatchObject({ message: 'Beta removed', actionLabel: 'Undo', duration: 6000 })
    act(() => toast.onAction?.())
    expect(screen.getAllByRole('listitem').map((node) => node.getAttribute('data-row-id'))).toEqual(
      ['a', 'b', 'c'],
    )
  })

  it('does not duplicate a row that is already back', () => {
    expect(restored(rows, rows[1]!, 1)).toEqual(rows)
    expect(restored([rows[0]!, rows[2]!], rows[1]!, 1)).toEqual(rows)
  })
})

it('moves a row from its keyboard menu and returns focus to its actions at the new position', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  screen.getByRole('button', { name: 'Actions for Beta' }).focus()
  await user.keyboard('{Enter}')
  await user.keyboard('{Enter}')
  expect(screen.getAllByRole('listitem').map((node) => node.getAttribute('data-row-id'))).toEqual([
    'b',
    'a',
    'c',
  ])
  expect(screen.getByRole('button', { name: 'Actions for Beta' })).toHaveFocus()
})

it('keeps required inputs available without an Edit control until the row is complete', async () => {
  const { rerender } = render(
    <RowFields locale="en" summary="Tbilisi" complete={false} hasError={false} fresh={false}>
      <input aria-label="City" />
    </RowFields>,
  )
  const input = screen.getByRole('textbox', { name: 'City' })
  input.focus()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  rerender(
    <RowFields locale="en" summary="Tbilisi" complete hasError={false} fresh={false}>
      <input aria-label="City" />
    </RowFields>,
  )
  expect(input).toHaveFocus()
  await userEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(screen.queryByRole('textbox', { name: 'City' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
  expect(screen.getByRole('textbox', { name: 'City' })).toBeVisible()
})

it('exposes optional validation errors inside completed rows even after Details was closed', () => {
  const renderRow = (hasError: boolean) => (
    <RowFields locale="en" summary="Tbilisi" complete hasError={hasError} fresh={false}>
      <RowDetails locale="en" hasError={hasError}>
        <input aria-label="Nights" aria-invalid={hasError} />
      </RowDetails>
    </RowFields>
  )
  const { rerender } = render(renderRow(false))
  expect(screen.queryByRole('textbox', { name: 'Nights' })).not.toBeInTheDocument()
  rerender(renderRow(true))
  const input = screen.getByRole('textbox', { name: 'Nights' })
  input.focus()
  rerender(renderRow(false))
  expect(screen.getByRole('textbox', { name: 'Nights' })).toBeVisible()
  expect(input).toHaveFocus()
})
