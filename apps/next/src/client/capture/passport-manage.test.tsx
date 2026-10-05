// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PassportManage } from './passport-manage'

const mocks = vi.hoisted(() => ({ list: vi.fn(), accept: vi.fn(), acknowledge: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../../../../web/src/lib/flights', () => ({ getAllFlights: mocks.list }))
vi.mock('../import/import-api', () => ({ acceptAircraftBatch: mocks.accept }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../write-feedback', () => ({ useWriteFeedback: () => ({ acknowledge: mocks.acknowledge, status: 'ready' }) }))

const flight = (id: number, aircraft_icao: string | null = null) => ({ id, date: `2026-03-0${id}`, origin: 'JFK', destination: 'BOS', flight_number: `AA${id}`, aircraft_icao })
const label = (id: number) => `2026-03-0${id} · JFK → BOS · AA${id}`

async function load(user: ReturnType<typeof userEvent.setup>, locale: 'en' | 'ru' = 'en') {
  render(<PassportManage ownerId="a" locale={locale} />)
  await user.click(screen.getByRole('button', { name: locale === 'ru' ? 'Загрузить перелёты' : 'Load flights' }))
  await screen.findByRole('group', { name: locale === 'ru' ? 'Перелёты' : 'Flights' })
}

beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue([flight(1), flight(2), flight(3)]) })

describe('PassportManage aircraft outcomes', () => {
  it('has no duplicate section heading under the page title', async () => {
    await load(userEvent.setup())
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByText(/select up to 20 of your flights/i)).toBeInTheDocument()
  })

  it('shows saved, failed and uncertain rows separately and reloads the list', async () => {
    const user = userEvent.setup()
    // Flight 3 is missing from the answer: the server said nothing about it, so it may or may not have been written.
    mocks.accept.mockResolvedValueOnce({ results: [
      { id: 1, status: 'accepted', flight: { id: 1, aircraft_icao: 'A320' } },
      { id: 2, status: 'error', http_status: 400, code: 'UNKNOWN_AIRCRAFT', error: 'no' },
    ], derived_state: 'pending', revision: 3 })
    await load(user)
    for (const checkbox of screen.getAllByRole('checkbox')) await user.click(checkbox)
    await user.selectOptions(screen.getByLabelText('Aircraft type'), 'A320')
    mocks.list.mockResolvedValue([flight(1, 'A320'), flight(2), flight(3)])
    await user.click(screen.getByRole('button', { name: 'Apply to selected' }))

    const result = await screen.findByRole('list', { name: 'Result' })
    const rows = within(result).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows.map(row => row.getAttribute('data-state'))).toEqual(['saved', 'failed', 'uncertain'])
    expect(within(rows[0]).getByText(label(1), { exact: false })).toBeInTheDocument()
    expect(within(rows[0]).getByText('Saved')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Not saved · UNKNOWN_AIRCRAFT')).toBeInTheDocument()
    expect(within(rows[2]).getByText('May not be saved')).toBeInTheDocument()
    expect(within(rows[2]).getByText(/trying again is safe/i)).toBeInTheDocument()
    expect(mocks.accept).toHaveBeenCalledWith([{ id: 1, aircraft_icao: 'A320' }, { id: 2, aircraft_icao: 'A320' }, { id: 3, aircraft_icao: 'A320' }])
    expect(mocks.acknowledge).toHaveBeenCalledWith({ derived_state: 'pending', revision: 3 })
    // The saved flight left the eligible set; the failed and uncertain ones stay selected for another attempt.
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
    const fieldset = screen.getByRole('group', { name: 'Flights' })
    await waitFor(() => expect(within(fieldset).getAllByRole('checkbox')).toHaveLength(2))
    expect(within(fieldset).getAllByRole('checkbox').every(box => (box as HTMLInputElement).checked)).toBe(true)
  })

  it('marks a lost answer uncertain, keeps the rows selected and retries the same items safely', async () => {
    const user = userEvent.setup()
    mocks.accept.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await load(user)
    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getAllByRole('checkbox')[1])
    await user.selectOptions(screen.getByLabelText('Aircraft type'), 'A320')
    await user.click(screen.getByRole('button', { name: 'Apply to selected' }))
    await waitFor(() => expect(screen.getAllByText('May not be saved')).toHaveLength(2))
    expect(mocks.acknowledge).not.toHaveBeenCalled()
    expect(mocks.list).toHaveBeenCalledTimes(2)
    const fieldset = screen.getByRole('group', { name: 'Flights' })
    expect(within(fieldset).getAllByRole('checkbox').filter(box => (box as HTMLInputElement).checked)).toHaveLength(2)

    // The type picker may have changed since; the retry still resends what was sent.
    await user.selectOptions(screen.getByLabelText('Aircraft type'), 'B738')
    mocks.accept.mockResolvedValueOnce({ results: [
      { id: 1, status: 'accepted', flight: { id: 1, aircraft_icao: 'A320' } },
      { id: 2, status: 'accepted', flight: { id: 2, aircraft_icao: 'A320' } },
    ], derived_state: 'ready', revision: 2 })
    mocks.list.mockResolvedValue([flight(1, 'A320'), flight(2, 'A320'), flight(3)])
    await user.click(screen.getByRole('button', { name: 'Try again for the rest' }))
    await waitFor(() => expect(screen.getAllByText('Saved')).toHaveLength(2))
    expect(mocks.accept).toHaveBeenLastCalledWith([{ id: 1, aircraft_icao: 'A320' }, { id: 2, aircraft_icao: 'A320' }])
    expect(screen.queryByRole('button', { name: 'Try again for the rest' })).not.toBeInTheDocument()
    expect(mocks.acknowledge).toHaveBeenCalledWith({ derived_state: 'ready', revision: 2 })
  })

  it('keeps the 20-item limit', async () => {
    const user = userEvent.setup()
    mocks.list.mockResolvedValue(Array.from({ length: 22 }, (_, index) => flight(index + 1)))
    await load(user)
    for (const checkbox of screen.getAllByRole('checkbox').slice(0, 20)) await user.click(checkbox)
    expect(screen.getAllByRole('checkbox').filter(box => (box as HTMLInputElement).disabled)).toHaveLength(2)
  })
})
