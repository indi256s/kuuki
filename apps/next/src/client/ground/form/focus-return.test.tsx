// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CountriesFieldset } from './countries-fieldset'
import { PlacePicker } from './place-picker'

vi.mock('../api', () => ({ searchPlaces: vi.fn(async () => []), createManualPlace: vi.fn() }))
vi.mock('../../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../../ui/use-mobile', () => ({ useMobile: () => false }))

describe('focus return', () => {
  it('puts focus back in the place field, closed, when the manual form is cancelled', async () => {
    render(<PlacePicker label="From" locale="en" value={null} onChange={() => {}} />)
    const input = screen.getByRole('combobox', { name: 'From' })
    await userEvent.type(input, 'Zzzz')
    await userEvent.click(await screen.findByRole('button', { name: 'Add a place manually' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('puts focus back in the country search after a result is chosen', async () => {
    const onChange = vi.fn()
    render(
      <CountriesFieldset
        value={{ countries: [], noCountries: false }}
        onChange={onChange}
        routeCodes={[]}
        locale="en"
      />,
    )
    const search = screen.getByRole('searchbox', { name: 'Add another country' })
    await userEvent.type(search, 'Germany')
    await userEvent.click(screen.getByRole('button', { name: 'Germany' }))
    expect(onChange).toHaveBeenCalled()
    expect(search).toHaveFocus()
  })
})
