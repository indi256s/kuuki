// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FlightForm } from './flight-form'
import { FlightCaptureDialog, FlightDetailSheet } from './flight-panels'
import { clearCapturePreferences } from './capture-preferences'
import type { Locale } from '../../lib/format'

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), duplicate: vi.fn(), get: vi.fn(), remove: vi.fn(), acknowledge: vi.fn(), refresh: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }))
vi.mock('./flight-writes', () => ({ createFlight: mocks.create, updateFlight: mocks.update }))
vi.mock('../../../../web/src/lib/flights', () => ({ getFlight: mocks.get, checkDuplicateFlight: mocks.duplicate, deleteFlight: mocks.remove }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../write-feedback', () => ({ useWriteFeedback: () => ({ acknowledge: mocks.acknowledge, status: 'ready' }) }))
const flight = { id: 7, date: '2026-10-05', origin: 'TBS', destination: 'IST', airline_iata: 'TK', aircraft_icao: 'B738', flight_number: 'TK123', departure_time: '12:00', arrival_time: '14:00', lifecycle_state: 'awaiting' }
const words = { en: { from: 'From', to: 'To', date: 'Date', save: 'Save flight', details: '＋ Optional details', swap: 'Swap route', anyway: 'Save anyway', airline: 'Airline (optional)', aircraft: 'Aircraft (optional)' }, ru: { from: 'Откуда', to: 'Куда', date: 'Дата', save: 'Сохранить перелёт', details: '＋ Подробности', swap: 'Поменять местами', anyway: 'Всё равно сохранить', airline: 'Авиакомпания (необязательно)', aircraft: 'Самолёт (необязательно)' } }
async function fill(locale: Locale) {
  const w = words[locale]
  fireEvent.change(screen.getByRole('combobox', { name: w.from }), { target: { value: 'TBS' } })
  fireEvent.change(screen.getByRole('combobox', { name: w.to }), { target: { value: 'IST' } })
  fireEvent.change(screen.getByLabelText(w.date), { target: { value: locale === 'ru' ? '05.10.2026' : '10/05/2026' } })
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  mocks.duplicate.mockResolvedValue(null); mocks.create.mockResolvedValue({ id: 8, derived_state: 'ready' }); mocks.update.mockResolvedValue({ id: 7, derived_state: 'pending' }); mocks.get.mockResolvedValue(flight); mocks.remove.mockResolvedValue({ derived_state: 'ready' })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
})

describe.each(['en', 'ru'] as const)('manual flight (%s)', locale => {
  it('creates with route/date only via keyboard and publishes the acknowledgement', async () => {
    render(<FlightForm ownerId="a" locale={locale} />)
    await fill(locale)
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: locale === 'en', metaKey: locale === 'ru' })
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ date: '2026-10-05', origin: 'TBS', destination: 'IST', airline_iata: null, aircraft_icao: null, user_id: 'a' })
    expect(mocks.acknowledge).toHaveBeenCalledWith({ id: 8, derived_state: 'ready' })
    expect(screen.getByRole('status')).toHaveTextContent(locale === 'ru' ? 'Итоги обновлены.' : 'Totals updated.')
  })
  it('swaps the route and preserves selected optional values', async () => {
    render(<FlightForm ownerId="a" locale={locale} />)
    await fill(locale)
    await userEvent.click(screen.getByRole('button', { name: words[locale].swap }))
    expect(screen.getByRole('combobox', { name: words[locale].from })).toHaveValue('IST')
    expect(screen.getByRole('combobox', { name: words[locale].to })).toHaveValue('TBS')
    await userEvent.click(screen.getByRole('button', { name: words[locale].details }))
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].airline }), { target: { value: 'TK' } })
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].aircraft }), { target: { value: 'B738' } })
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ origin: 'IST', destination: 'TBS', airline_iata: 'TK', aircraft_icao: 'B738' })
  })
  it('blocks duplicates until explicit override and still validates override fields', async () => {
    mocks.duplicate.mockResolvedValue(flight)
    render(<FlightForm ownerId="a" locale={locale} />)
    await fill(locale)
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    const override = await screen.findByRole('button', { name: words[locale].anyway })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: locale === 'ru' ? 'Открыть существующий' : 'Open existing' })).toHaveAttribute('href', '/journal/7/edit')
    // An invalid optional value must never escape through the duplicate action.
    await userEvent.click(screen.getByRole('button', { name: words[locale].details }))
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].airline }), { target: { value: 'X' } })
    await userEvent.click(override)
    await screen.findByRole('alert')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: words[locale].airline })).toHaveFocus()
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].airline }), { target: { value: '' } })
    await userEvent.click(override)
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
  })
  it('focuses the first inline error and rejects impossible dates', async () => {
    render(<FlightForm ownerId="a" locale={locale} />)
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    await waitFor(() => expect(screen.getByLabelText(words[locale].date)).toHaveFocus())
    await fill(locale)
    fireEvent.change(screen.getByLabelText(words[locale].date), { target: { value: '2026-02-30' } })
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    expect(mocks.create).not.toHaveBeenCalled()
    expect(screen.getByLabelText(words[locale].date)).toHaveAttribute('aria-invalid', 'true')
  })
  it('loads edit values, excludes the edited ID and clears optional values explicitly', async () => {
    render(<FlightDetailSheet ownerId="a" locale={locale} flightId={7} initialEditing />)
    await screen.findByRole('combobox', { name: words[locale].airline })
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].airline }), { target: { value: '' } })
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].aircraft }), { target: { value: '' } })
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
    expect(mocks.duplicate).toHaveBeenCalledWith('a', '2026-10-05', 'TBS', 'IST', 7, expect.any(Object))
    expect(mocks.update.mock.calls[0]).toEqual([7, expect.objectContaining({ airline_iata: null, aircraft_icao: null, flight_number: 'TK123', departure_time: '12:00', arrival_time: '14:00' })])
    expect(mocks.acknowledge).toHaveBeenCalledWith({ id: 7, derived_state: 'pending' })
  })
})

it('remembers details per account and clears capture recents on identity reset', async () => {
  const view = render(<FlightForm ownerId="a" locale="en" />)
  await userEvent.click(screen.getByRole('button', { name: words.en.details }))
  await userEvent.click(screen.getByRole('combobox', { name: 'From' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'From' }), { target: { value: 'თბილისი' } })
  await userEvent.click(screen.getByRole('option', { name: /TBS/ }))
  view.unmount()
  const second = render(<FlightForm ownerId="a" locale="en" />)
  expect(screen.getByRole('button', { name: words.en.details })).toHaveAttribute('aria-expanded', 'true')
  await userEvent.click(screen.getByRole('combobox', { name: 'From' }))
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('TBS')
  second.unmount()
  const other = render(<FlightForm ownerId="b" locale="en" />)
  expect(screen.getByRole('button', { name: words.en.details })).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(screen.getByRole('combobox', { name: 'From' }))
  expect(screen.getAllByRole('option')[0]).not.toHaveTextContent('TBS')
  other.unmount()
  clearCapturePreferences()
  render(<FlightForm ownerId="a" locale="en" />)
  await userEvent.click(screen.getByRole('combobox', { name: 'From' }))
  expect(screen.getAllByRole('option')[0]).not.toHaveTextContent('TBS')
})

it('offers named edit/delete actions in reusable Ticket detail and confirms deletion', async () => {
  render(<FlightDetailSheet ownerId="a" locale="ru" flightId={7} />)
  await screen.findByRole('article', { name: 'TBS — IST' })
  expect(screen.getByRole('button', { name: 'Изменить перелёт' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Удалить перелёт' }))
  const confirmation = await screen.findByRole('dialog', { name: 'Удалить перелёт?' })
  await userEvent.click(within(confirmation).getByRole('button', { name: 'Удалить перелёт' }))
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(7))
  expect(mocks.push).toHaveBeenCalledWith('/journal')
})

it('pins mobile search input and adjusts the save panel above the keyboard', async () => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  const viewport = new EventTarget()
  Object.assign(viewport, { height: 500, offsetTop: 0, scale: 1 })
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  render(<FlightCaptureDialog ownerId="a" locale="en" />)
  const panel = await screen.findByRole('dialog', { name: 'Add a flight' })
  expect(panel.style.getPropertyValue('--sheet-kb')).toBe(`${window.innerHeight - 500}px`)
  await userEvent.click(screen.getByRole('combobox', { name: 'From' }))
  const search = await screen.findByRole('dialog', { name: 'From' })
  const input = within(search).getByRole('combobox', { name: 'From' })
  await waitFor(() => expect(input).toHaveFocus())
  fireEvent.change(input, { target: { value: 'Tbilisi' } })
  await userEvent.click(within(search).getByRole('option', { name: /TBS/ }))
  expect(screen.getByRole('combobox', { name: 'From' })).toHaveValue('TBS')
  Object.assign(viewport, { height: 450 })
  act(() => { viewport.dispatchEvent(new Event('resize')) })
  expect(panel.style.getPropertyValue('--sheet-kb')).toBe(`${window.innerHeight - 450}px`)
})

it('keeps a failed duplicate lookup from silently admitting a save', async () => {
  mocks.duplicate.mockRejectedValue(new Error('Lookup unavailable'))
  render(<FlightForm ownerId="a" locale="en" />)
  await fill('en')
  await userEvent.click(screen.getByRole('button', { name: 'Save flight' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Lookup unavailable')
  expect(mocks.create).not.toHaveBeenCalled()
})

it('closes an embedded edit via its owner callback, preserving the Journal navigation state', async () => {
  const close = vi.fn()
  render(<FlightDetailSheet ownerId="a" locale="en" flightId={7} initialEditing onOpenChange={close} />)
  await screen.findByRole('button', { name: 'Save flight' })
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(close).toHaveBeenCalledWith(false)
  expect(mocks.push).not.toHaveBeenCalled()
})
