// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { MultiSelect } from './multi-select'

const options = [
  { value: 'SU', label: 'Aeroflot', detail: 'Russia', count: 12, mono: true },
  { value: 'S7', label: 'S7 Airlines', count: 4 },
  { value: 'U6', label: 'Ural Airlines' },
]

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})

function Harness({ onValueChange }: { onValueChange: (value: string[]) => void }) {
  const [value, setValue] = useState<string[]>([])
  return (
    <MultiSelect
      label="Airline"
      locale="en"
      options={options}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValueChange(next)
      }}
    />
  )
}

it('toggles options with Space and Enter from the list and reports each change', async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Harness onValueChange={onValueChange} />)
  await user.click(screen.getByRole('button', { name: /Airline/ }))
  const search = screen.getByRole('searchbox', { name: 'Search' })
  await waitFor(() => expect(search).toHaveFocus())
  expect(screen.getByRole('status')).toHaveTextContent('3 found')
  await user.keyboard('{ArrowDown}')
  const list = screen.getByRole('listbox', { name: 'Airline' })
  expect(list).toHaveAttribute('aria-multiselectable', 'true')
  expect(list).toHaveFocus()
  await user.keyboard(' ')
  expect(onValueChange).toHaveBeenLastCalledWith(['SU'])
  expect(screen.getByRole('option', { name: /Aeroflot/ })).toHaveAttribute('aria-selected', 'true')
  await user.keyboard('{ArrowDown}{Enter}')
  expect(onValueChange).toHaveBeenLastCalledWith(['SU', 'S7'])
  await user.keyboard('{ArrowUp} ')
  expect(onValueChange).toHaveBeenLastCalledWith(['S7'])
})

it('filters by folded text, says when nothing matches and closes on Escape', async () => {
  const user = userEvent.setup()
  render(<Harness onValueChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: /Airline/ }))
  await user.keyboard('ural')
  expect(screen.getAllByRole('option')).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveTextContent('1 found')
  await user.keyboard('zzz')
  expect(screen.queryAllByRole('option')).toHaveLength(0)
  expect(screen.getByRole('status')).toHaveTextContent('No matches')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
})
