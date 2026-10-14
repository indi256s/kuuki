// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { announceShellNotice } from '../../shell-notices'
import { OrderedRows, restored } from './ordered-rows'

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
      onMove={() => {}}
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
    await userEvent.click(screen.getByRole('button', { name: 'Remove Beta' }))
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
