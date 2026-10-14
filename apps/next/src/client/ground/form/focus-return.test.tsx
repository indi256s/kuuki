// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CountriesFieldset } from './countries-fieldset'
import { PlacePicker } from './place-picker'
import { createManualPlace } from '../api'

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

it('retries the same manual place after a lost answer and prevents overlapping submissions', async () => {
  let reject!: (reason: Error) => void
  vi.mocked(createManualPlace)
    .mockImplementationOnce(() => new Promise((_, fail) => (reject = fail)))
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
  render(<PlacePicker label="From" locale="en" value={null} onChange={() => {}} />)
  await userEvent.type(screen.getByRole('combobox', { name: 'From' }), 'Zzzz')
  await userEvent.click(await screen.findByRole('button', { name: 'Add a place manually' }))
  const name = screen.getByLabelText('Place name')
  await userEvent.selectOptions(screen.getByLabelText('Country'), 'GE')
  await userEvent.click(screen.getByRole('button', { name: 'Add place' }))
  fireEvent.keyDown(name, { key: 'Enter' })
  expect(createManualPlace).toHaveBeenCalledTimes(1)
  await act(async () => reject(new TypeError('Failed to fetch')))
  await screen.findByRole('alert')
  expect(name).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Add place' }))
  await waitFor(() => expect(createManualPlace).toHaveBeenCalledTimes(2))
  expect(vi.mocked(createManualPlace).mock.calls[1]![0]).toEqual(
    vi.mocked(createManualPlace).mock.calls[0]![0],
  )
})
