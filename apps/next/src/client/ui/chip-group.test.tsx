// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ChipGroup, FacetChip } from './chip-group'

it('shows two values then +N and removes the facet through a named button', async () => {
  const onRemove = vi.fn()
  render(
    <ChipGroup label="Active filters">
      <FacetChip
        facet="Airline"
        values={['Aeroflot', 'S7', 'Ural']}
        removeLabel="Remove Airline filter"
        onRemove={onRemove}
        onOpen={() => {}}
      />
    </ChipGroup>,
  )
  expect(screen.getByRole('group', { name: 'Active filters' })).toHaveTextContent(
    'Airline Aeroflot, S7 +1',
  )
  expect(
    screen.getByRole('button', { name: /^Airline Aeroflot, S7, and 1 more$/ }),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Remove Airline filter' }))
  expect(onRemove).toHaveBeenCalledTimes(1)
})
