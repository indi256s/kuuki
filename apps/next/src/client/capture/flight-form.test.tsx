// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@kuuki/client/apiClient'
import { FlightForm } from './flight-form'
import { FlightDetailSheet } from './flight-panels'
import { clearCapturePreferences } from './capture-preferences'
import type { Locale } from '../../lib/format'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  duplicate: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  recent: vi.fn(),
  acknowledge: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
}))
vi.mock('./flight-writes', () => ({
  createFlight: mocks.create,
  updateFlight: mocks.update,
}))
vi.mock('@kuuki/client/flights', () => ({
  getFlight: mocks.get,
  checkDuplicateFlight: mocks.duplicate,
  deleteFlight: mocks.remove,
  getRecentFlights: mocks.recent,
}))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../write-feedback', () => ({
  useWriteFeedback: () => ({ acknowledge: mocks.acknowledge, status: 'ready' }),
}))
const flight = {
  id: 7,
  date: '2026-10-05',
  origin: 'TBS',
  destination: 'IST',
  airline_iata: 'TK',
  aircraft_icao: 'B738',
  flight_number: 'TK123',
  departure_time: '12:00',
  arrival_time: '14:00',
  lifecycle_state: 'awaiting',
}
const words = {
  en: {
    from: 'From',
    to: 'To',
    pickFrom: 'From airport',
    pickTo: 'To airport',
    other: /^Other/,
    date: 'Other date',
    save: 'Save flight',
    details: 'Optional details',
    swap: 'Swap airports',
    anyway: 'Save anyway',
    airline: 'Airline',
    aircraft: 'Aircraft',
  },
  ru: {
    from: 'Откуда',
    to: 'Куда',
    pickFrom: 'Аэропорт вылета',
    pickTo: 'Аэропорт прилёта',
    other: /^Другая/,
    date: 'Другая дата',
    save: 'Сохранить перелёт',
    details: 'Подробности',
    swap: 'Поменять аэропорты местами',
    anyway: 'Всё равно сохранить',
    airline: 'Авиакомпания',
    aircraft: 'Самолёт',
  },
}
/** The route row for one end, e.g. "From: Tbilisi, TBS" or "From: city or airport". */
const routeRow = (locale: Locale, end: 'from' | 'to') =>
  screen.getByRole('button', { name: new RegExp(`^${words[locale][end]}: `) })
/** Searches the open route picker and explicitly chooses the exact-code result. */
async function choose(label: string, code: string) {
  fireEvent.change(screen.getByRole('combobox', { name: label }), {
    target: { value: code },
  })
  await userEvent.click(screen.getAllByRole('option')[0])
}
async function fillRoute(locale: Locale, from = 'TBS', to = 'IST') {
  await userEvent.click(routeRow(locale, 'from'))
  await choose(words[locale].pickFrom, from)
  // Choosing From moves straight on to To.
  await choose(words[locale].pickTo, to)
}
async function typeDate(locale: Locale, value: string) {
  if (!screen.queryByLabelText(words[locale].date))
    await userEvent.click(screen.getByRole('radio', { name: words[locale].other }))
  fireEvent.change(screen.getByLabelText(words[locale].date), {
    target: { value },
  })
}
async function fill(locale: Locale) {
  await fillRoute(locale)
  await typeDate(locale, locale === 'ru' ? '05.10.2026' : '10/05/2026')
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  mocks.duplicate.mockResolvedValue(null)
  mocks.create.mockResolvedValue({ id: 8, derived_state: 'ready' })
  mocks.update.mockResolvedValue({ id: 7, derived_state: 'pending' })
  mocks.get.mockResolvedValue(flight)
  mocks.remove.mockResolvedValue({ derived_state: 'ready' })
  mocks.recent.mockResolvedValue([])
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 0
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

describe.each(['en', 'ru'] as const)('manual flight (%s)', (locale) => {
  it('focuses the first inline error and rejects impossible dates', async () => {
    render(<FlightForm ownerId="a" locale={locale} />)
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    await waitFor(() => expect(routeRow(locale, 'from')).toHaveFocus())
    await fill(locale)
    fireEvent.change(screen.getByLabelText(words[locale].date), {
      target: { value: '2026-02-30' },
    })
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    expect(mocks.create).not.toHaveBeenCalled()
    expect(screen.getByLabelText(words[locale].date)).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('manual flight', () => {
  const locale = 'en' as Locale
  it('creates with route/date only via keyboard and publishes the acknowledgement', async () => {
    const onSaved = vi.fn()
    render(<FlightForm ownerId="a" locale={locale} onSaved={onSaved} />)
    await fill(locale)
    fireEvent.keyDown(window, {
      key: 'Enter',
      ctrlKey: locale === 'en',
      metaKey: locale === 'ru',
    })
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      date: '2026-10-05',
      origin: 'TBS',
      destination: 'IST',
      airline_iata: null,
      aircraft_icao: null,
      user_id: 'a',
    })
    expect(mocks.acknowledge).toHaveBeenCalledWith({
      id: 8,
      derived_state: 'ready',
    })
    // onSaved runs from an effect after the saved render commits.
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith({ id: 8, derived_state: 'ready' }, 'ready'),
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      locale === 'ru' ? 'Итоги обновлены.' : 'Totals updated.',
    )
  })
  it('swaps the route and preserves selected optional values', async () => {
    render(<FlightForm ownerId="a" locale={locale} />)
    await fill(locale)
    await userEvent.click(screen.getByRole('button', { name: words[locale].swap }))
    expect(routeRow(locale, 'from')).toHaveAccessibleName(expect.stringMatching(/, IST$/))
    expect(routeRow(locale, 'to')).toHaveAccessibleName(expect.stringMatching(/, TBS$/))
    await userEvent.click(screen.getByRole('button', { name: words[locale].details }))
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].airline }), {
      target: { value: 'TK' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].aircraft }), {
      target: { value: 'B738' },
    })
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      origin: 'IST',
      destination: 'TBS',
      airline_iata: 'TK',
      aircraft_icao: 'B738',
    })
  })
  it('blocks duplicates until explicit override and still validates override fields', async () => {
    mocks.duplicate.mockResolvedValue(flight)
    render(<FlightForm ownerId="a" locale={locale} />)
    await fill(locale)
    // The background lookup may already show this duplicate before the member saves.
    const override = await screen.findByRole('button', {
      name: words[locale].anyway,
    })
    // The duplicate choice replaces Save, so a repeated tap there cannot save; the shortcut still checks.
    expect(screen.queryByRole('button', { name: words[locale].save })).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    expect(mocks.create).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(override.closest('[role=status]')))
    expect(
      screen.getByRole('link', {
        name: locale === 'ru' ? 'Открыть существующий' : 'Open existing',
      }),
    ).toHaveAttribute('href', '/journal/7/edit')
    // An invalid optional value must never escape through the duplicate action.
    await userEvent.click(screen.getByRole('button', { name: words[locale].details }))
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].airline }), {
      target: { value: 'X' },
    })
    fireEvent.click(override)
    await screen.findByRole('alert')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: words[locale].airline })).toHaveFocus()
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].airline }), {
      target: { value: '' },
    })
    await userEvent.click(override)
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
  })
  it('loads edit values, excludes the edited ID and clears optional values explicitly', async () => {
    render(<FlightDetailSheet ownerId="a" locale={locale} flightId={7} initialEditing />)
    await screen.findByRole('combobox', { name: words[locale].airline })
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].airline }), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].aircraft }), {
      target: { value: '' },
    })
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
    expect(mocks.duplicate).toHaveBeenCalledWith(
      'a',
      '2026-10-05',
      'TBS',
      'IST',
      7,
      expect.any(Object),
    )
    expect(mocks.update.mock.calls[0]).toEqual([
      7,
      expect.objectContaining({
        airline_iata: null,
        aircraft_icao: null,
        flight_number: 'TK123',
        departure_time: '12:00',
        arrival_time: '14:00',
      }),
    ])
    expect(mocks.acknowledge).toHaveBeenCalledWith({
      id: 7,
      derived_state: 'pending',
    })
  })
})

it('starts every fresh entry collapsed and clears per-account airport recents on identity reset', async () => {
  const view = render(<FlightForm ownerId="a" locale="en" />)
  await userEvent.click(screen.getByRole('button', { name: words.en.details }))
  await userEvent.click(routeRow('en', 'from'))
  fireEvent.change(screen.getByRole('combobox', { name: 'From airport' }), {
    target: { value: 'თბილისი' },
  })
  await userEvent.click(screen.getByRole('option', { name: /TBS/ }))
  view.unmount()
  localStorage.removeItem('kuuki:capture:a:unfinished')
  const second = render(<FlightForm ownerId="a" locale="en" />)
  // The previous entry's disclosure choice never decides a fresh entry's layout.
  expect(screen.getByRole('button', { name: words.en.details })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await userEvent.click(routeRow('en', 'from'))
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('TBS')
  second.unmount()
  const other = render(<FlightForm ownerId="b" locale="en" />)
  await userEvent.click(routeRow('en', 'from'))
  expect(screen.getAllByRole('option')[0]).not.toHaveTextContent('TBS')
  other.unmount()
  clearCapturePreferences()
  render(<FlightForm ownerId="a" locale="en" />)
  await userEvent.click(routeRow('en', 'from'))
  expect(screen.getAllByRole('option')[0]).not.toHaveTextContent('TBS')
})

it('offers named edit/delete actions in reusable Ticket detail and confirms deletion', async () => {
  render(<FlightDetailSheet ownerId="a" locale="ru" flightId={7} />)
  await screen.findByRole('article', { name: 'TBS — IST' })
  expect(screen.getByRole('button', { name: 'Изменить перелёт' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Удалить перелёт' }))
  const confirmation = await screen.findByRole('dialog', {
    name: /^Удалить перелёт TBS → IST, 5 окт\. 2026 г\.\?$/,
  })
  expect(within(confirmation).getByRole('button', { name: 'Отмена' })).toHaveFocus()
  await userEvent.click(within(confirmation).getByRole('button', { name: 'Удалить перелёт' }))
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(7))
  expect(mocks.push).toHaveBeenCalledWith('/journal')
})

it('keeps a failed duplicate lookup from silently admitting a save', async () => {
  mocks.duplicate.mockRejectedValue(new Error('Lookup unavailable'))
  render(<FlightForm ownerId="a" locale="en" />)
  await fill('en')
  await userEvent.click(screen.getByRole('button', { name: 'Save flight' }))
  const error = await screen.findByRole('alert')
  expect(error).toHaveTextContent('Could not save. Check your connection and try again.')
  expect(error).not.toHaveTextContent('Lookup unavailable')
  await waitFor(() => expect(document.activeElement).toBe(error))
  expect(mocks.create).not.toHaveBeenCalled()
})

it('closes an embedded edit via its owner callback, preserving the Journal navigation state', async () => {
  const close = vi.fn()
  render(
    <FlightDetailSheet ownerId="a" locale="en" flightId={7} initialEditing onOpenChange={close} />,
  )
  await screen.findByRole('button', { name: 'Save flight' })
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(close).toHaveBeenCalledWith(false)
  expect(mocks.push).not.toHaveBeenCalled()
})

it.each(['delete', 'open journal'] as const)(
  'returns embedded detail %s to its host without replacing Journal filters',
  async (action) => {
    const close = vi.fn()
    render(
      <FlightDetailSheet
        ownerId="a"
        locale="en"
        flightId={7}
        initialEditing={action === 'open journal'}
        onOpenChange={close}
      />,
    )
    if (action === 'delete') {
      await screen.findByRole('button', { name: 'Edit flight' })
      await userEvent.click(screen.getByRole('button', { name: 'Delete flight' }))
      const confirmation = await screen.findByRole('dialog', {
        name: 'Delete TBS → IST, Oct 5, 2026?',
      })
      await userEvent.click(within(confirmation).getByRole('button', { name: 'Delete flight' }))
      await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(7))
    } else {
      await screen.findByRole('button', { name: 'Save flight' })
      await userEvent.click(screen.getByRole('button', { name: 'Save flight' }))
      await screen.findByRole('heading', { name: 'Flight saved' })
      await userEvent.click(screen.getByRole('link', { name: 'Done' }))
    }
    await waitFor(() => expect(close).toHaveBeenCalledWith(false))
    expect(mocks.push).not.toHaveBeenCalled()
  },
)

describe.each(['ru'] as const)('offline, errors and focus (%s)', (locale) => {
  const say = (en: string, ru: string) => (locale === 'ru' ? ru : en)
  const setOnline = (value: boolean) =>
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => value,
    })
  afterEach(() => setOnline(true))

  it('keeps every field editable offline and blocks only save, with a visible reason', async () => {
    setOnline(false)
    render(<FlightForm ownerId="a" locale={locale} />)
    for (const end of ['from', 'to'] as const) expect(routeRow(locale, end)).toBeEnabled()
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: words[locale].details }))
    expect(screen.getByRole('combobox', { name: words[locale].airline })).toBeEnabled()
    await fill(locale)
    const save = screen.getByRole('button', { name: words[locale].save })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getByText(
        say('Offline. Connect to save.', 'Нет сети. Подключитесь, чтобы сохранить.'),
      ),
    ).toBeVisible()
    await userEvent.click(save)
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    expect(mocks.create).not.toHaveBeenCalled()
    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: words[locale].save })).not.toHaveAttribute(
        'aria-disabled',
      ),
    )
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
  })
  it('does not move focus out of a field when the connection drops while typing', async () => {
    render(<FlightForm ownerId="a" locale={locale} />)
    await userEvent.click(routeRow(locale, 'from'))
    const from = screen.getByRole('combobox', { name: words[locale].pickFrom })
    expect(from).toHaveFocus()
    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(from).toHaveFocus()
    expect(from).toBeEnabled()
  })
  it('blocks delete offline with its own reason', async () => {
    setOnline(false)
    render(<FlightDetailSheet ownerId="a" locale={locale} flightId={7} />)
    const trigger = await screen.findByRole('button', {
      name: say('Delete flight', 'Удалить перелёт'),
    })
    expect(trigger).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getByText(
        say('Offline. Connect to delete.', 'Нет сети. Подключитесь, чтобы удалить.'),
      ),
    ).toBeVisible()
  })
  it('carries a connection drop into an open delete confirmation: blocked with the reason, not closed, not deleted', async () => {
    render(<FlightDetailSheet ownerId="a" locale={locale} flightId={7} />)
    await userEvent.click(
      await screen.findByRole('button', {
        name: say('Delete flight', 'Удалить перелёт'),
      }),
    )
    const confirmation = await screen.findByRole('dialog', { name: /TBS/ })
    const reason = say('Offline. Connect to delete.', 'Нет сети. Подключитесь, чтобы удалить.')
    expect(within(confirmation).queryByText(reason)).not.toBeInTheDocument()
    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })
    const confirm = within(confirmation).getByRole('button', {
      name: say('Delete flight', 'Удалить перелёт'),
    })
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    expect(within(confirmation).getByText(reason)).toBeVisible()
    await userEvent.click(confirm)
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /TBS/ })).toBeInTheDocument()
    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(
      within(screen.getByRole('dialog', { name: /TBS/ })).getByRole('button', {
        name: say('Delete flight', 'Удалить перелёт'),
      }),
    ).not.toHaveAttribute('aria-disabled', 'true')
  })
  it('says what is wrong in each field instead of a generic message', async () => {
    render(<FlightForm ownerId="a" locale={locale} />)
    // Searching never sets an airport: only an explicit choice does.
    await userEvent.click(routeRow(locale, 'from'))
    fireEvent.change(screen.getByRole('combobox', { name: words[locale].pickFrom }), {
      target: { value: 'ZZZ' },
    })
    fireEvent.keyDown(screen.getByRole('combobox', { name: words[locale].pickFrom }), {
      key: 'Escape',
    })
    await typeDate(locale, locale === 'ru' ? '31.02.2026' : '02/30/2026')
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    expect(
      await screen.findByText(
        say(
          'This date does not exist. Check the day and month.',
          'Такой даты нет. Проверьте день и месяц.',
        ),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(say('Choose an airport from the list.', 'Выберите аэропорт из списка.')),
    ).toHaveLength(2)
    expect(screen.queryByText(/Check this field|Проверьте значение поля/)).not.toBeInTheDocument()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('accepts a leap day and rejects the same day in a common year', async () => {
    render(<FlightForm ownerId="a" locale={locale} />)
    await fill(locale)
    fireEvent.change(screen.getByLabelText(words[locale].date), {
      target: { value: locale === 'ru' ? '29.02.2025' : '02/29/2025' },
    })
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    expect(
      await screen.findByText(
        say(
          'This date does not exist. Check the day and month.',
          'Такой даты нет. Проверьте день и месяц.',
        ),
      ),
    ).toBeInTheDocument()
    expect(mocks.create).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(words[locale].date), {
      target: { value: locale === 'ru' ? '29.02.2024' : '02/29/2024' },
    })
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ date: '2024-02-29' })
  })
  it('shows localized copy for a structured server failure and for a failed load', async () => {
    mocks.create.mockRejectedValueOnce(
      new ApiError(400, 'origin airport does not exist', 'UNKNOWN_AIRPORT'),
    )
    render(<FlightForm ownerId="a" locale={locale} />)
    await fill(locale)
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    const alert = await screen.findByText(
      say('Choose an airport from the list.', 'Выберите аэропорт из списка.'),
    )
    expect(alert.closest('[role=alert]')).toBeInTheDocument()
    expect(screen.queryByText(/origin airport does not exist/)).not.toBeInTheDocument()
  })
  it('never prints the raw cause when a flight fails to load', async () => {
    mocks.get.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<FlightDetailSheet ownerId="a" locale={locale} flightId={7} />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      say(
        'Could not load the flight. Check your connection and try again.',
        'Не удалось загрузить перелёт. Проверьте соединение и повторите.',
      ),
    )
    expect(alert).not.toHaveTextContent(/TypeError|Failed to fetch/)
  })
  it('keeps field errors out of the field label so they are not announced twice', async () => {
    render(<FlightForm ownerId="a" locale={locale} />)
    await userEvent.click(screen.getByRole('button', { name: words[locale].details }))
    fireEvent.change(screen.getByLabelText(say('Departs', 'Вылет')), {
      target: { value: '25:00' },
    })
    await userEvent.click(screen.getByRole('button', { name: words[locale].save }))
    const departure = screen.getByLabelText(say('Departs', 'Вылет'))
    expect(departure.closest('label')).toBeNull()
    expect(document.querySelector(`label[for="${departure.id}"]`)).not.toHaveTextContent(
      /HH:MM|ЧЧ:ММ/,
    )
  })
  it('opens Optional details and focuses the aircraft field for a flight without aircraft', async () => {
    mocks.get.mockResolvedValue({
      ...flight,
      aircraft_icao: null,
      airline_iata: null,
      flight_number: null,
      departure_time: null,
      arrival_time: null,
    })
    localStorage.clear()
    render(
      <FlightDetailSheet
        ownerId="a"
        locale={locale}
        flightId={7}
        initialEditing
        focusField="aircraft"
      />,
    )
    const aircraft = await screen.findByRole('combobox', {
      name: words[locale].aircraft,
    })
    await waitFor(() => expect(aircraft).toHaveFocus())
    expect(screen.getByRole('button', { name: words[locale].details })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
  it('shows HH:MM in the detail view and focuses the saved heading after a save', async () => {
    mocks.get.mockResolvedValue({
      ...flight,
      departure_time: '12:05:00',
      arrival_time: '14:30:00',
    })
    render(<FlightDetailSheet ownerId="a" locale={locale} flightId={7} />)
    await screen.findByRole('article')
    expect(screen.getByText('12:05')).toBeInTheDocument()
    expect(screen.getByText('14:30')).toBeInTheDocument()
    expect(screen.queryByText(/12:05:00|14:30:00/)).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', {
        name: say('Edit flight', 'Изменить перелёт'),
      }),
    )
    await userEvent.click(await screen.findByRole('button', { name: words[locale].save }))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: say('Flight saved', 'Перелёт сохранён'),
        }),
      ).toHaveFocus(),
    )
  })
})

describe('manual entry redesign', () => {
  it('offers Today, Yesterday and Other with no default, each showing its actual date', () => {
    render(<FlightForm ownerId="a" locale="en" />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    for (const radio of radios) {
      expect(radio).not.toBeChecked()
      expect(radio).toBeRequired()
    }
    const day = (offset: number) =>
      new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + offset)
    const label = (date: Date) =>
      new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => part.value)
        .join(' ')
    expect(screen.getByRole('radio', { name: `Today ${label(day(0))}` })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: `Yesterday ${label(day(-1))}` })).toBeInTheDocument()
  })
  it('shows a date chosen under Other on the Other tile', async () => {
    render(<FlightForm ownerId="a" locale="ru" />)
    await typeDate('ru', '04.03.2025')
    expect(screen.getByRole('radio', { name: '4 мар вт 2025' })).toBeChecked()
    expect(screen.getByRole('radio', { name: /^Сегодня/ })).not.toBeChecked()
    expect(screen.queryByRole('radio', { name: words.ru.other })).not.toBeInTheDocument()
  })
  it('offers the swap only once both airports are set', async () => {
    render(<FlightForm ownerId="a" locale="en" />)
    expect(screen.queryByRole('button', { name: words.en.swap })).not.toBeInTheDocument()
    await userEvent.click(routeRow('en', 'from'))
    await choose(words.en.pickFrom, 'TBS')
    expect(routeRow('en', 'from')).toHaveAccessibleName('From: Tbilisi, TBS')
    expect(screen.queryByRole('button', { name: words.en.swap })).not.toBeInTheDocument()
    await choose(words.en.pickTo, 'IST')
    expect(screen.getByRole('button', { name: words.en.swap })).toBeInTheDocument()
  })
  it('puts each save notice in the footer directly above its actions', async () => {
    mocks.duplicate.mockResolvedValue(flight)
    const view = render(<FlightForm ownerId="a" locale="en" />)
    await fill('en')
    const override = await screen.findByRole('button', {
      name: words.en.anyway,
    })
    const block = override.closest('[role=status]') as HTMLElement
    expect(block.closest('footer')).not.toBeNull()
    expect(block.firstElementChild).toHaveTextContent(
      'A flight with this date and route already exists.',
    )
    expect(block.firstElementChild?.nextElementSibling).toContainElement(override)
    view.unmount()
    mocks.duplicate.mockResolvedValue(null)
    mocks.create.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<FlightForm ownerId="b" locale="en" />)
    await fill('en')
    await userEvent.click(screen.getByRole('button', { name: words.en.save }))
    const error = await screen.findByText('Could not save. Check your connection and try again.')
    const notice = error.closest('[role=alert]') as HTMLElement
    expect(notice.closest('footer')).not.toBeNull()
    expect(notice.nextElementSibling).toContainElement(
      screen.getByRole('button', { name: words.en.save }),
    )
  })
  it('marks a next-day arrival with +1, read as "next day", and shows the leg duration', async () => {
    render(<FlightForm ownerId="a" locale="en" />)
    await fill('en')
    await userEvent.click(screen.getByRole('button', { name: words.en.details }))
    fireEvent.change(screen.getByLabelText('Departs'), {
      target: { value: '12:00' },
    })
    fireEvent.change(screen.getByLabelText('Arrives'), {
      target: { value: '14:00' },
    })
    expect(screen.queryByText('+1')).not.toBeInTheDocument()
    // TBS (UTC+4) 23:40 → IST (UTC+3) 03:10 lands the next day after 4 h 30 min.
    fireEvent.change(screen.getByLabelText('Departs'), {
      target: { value: '23:40' },
    })
    fireEvent.change(screen.getByLabelText('Arrives'), {
      target: { value: '03:10' },
    })
    expect(screen.getByText('+1')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByLabelText('Arrives')).toHaveAccessibleDescription('next day')
    expect(screen.getByText(/^4\sh 30\smin flight$/)).toBeInTheDocument()
  })
  it('keeps an unfinished entry for the account until it is discarded or saved', async () => {
    const first = render(<FlightForm ownerId="a" locale="en" />)
    await fillRoute('en')
    first.unmount()
    const second = render(<FlightForm ownerId="a" locale="en" />)
    expect(screen.getByText('Unfinished entry restored')).toBeInTheDocument()
    expect(routeRow('en', 'from')).toHaveAccessibleName('From: Tbilisi, TBS')
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(routeRow('en', 'from')).toHaveAccessibleName('From: city or airport')
    second.unmount()
    render(<FlightForm ownerId="b" locale="en" />)
    expect(screen.queryByText('Unfinished entry restored')).not.toBeInTheDocument()
    cleanup()
    const created = vi.fn()
    render(<FlightForm ownerId="a" locale="en" onCreated={created} />)
    await fill('en')
    expect(localStorage.getItem('kuuki:capture:a:unfinished')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: words.en.save }))
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1))
    expect(created.mock.calls[0][1]).toEqual({
      date: '2026-10-05',
      origin: 'TBS',
      destination: 'IST',
    })
    expect(localStorage.getItem('kuuki:capture:a:unfinished')).toBeNull()
    expect(mocks.acknowledge).not.toHaveBeenCalled()
  })
  it('offers Return and Onward from the last completed flight without applying either', async () => {
    mocks.recent.mockResolvedValue([{ ...flight, date: '2026-01-11' }])
    render(<FlightForm ownerId="a" locale="en" />)
    const back = await screen.findByRole('button', {
      name: 'Return flight: Istanbul, IST → Tbilisi, TBS',
    })
    expect(back).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('From your last flight, 11 Jan')).toBeInTheDocument()
    expect(routeRow('en', 'from')).toHaveAccessibleName('From: city or airport')
    await userEvent.click(back)
    expect(back).toHaveAttribute('aria-pressed', 'true')
    expect(routeRow('en', 'from')).toHaveAccessibleName('From: Istanbul, IST')
    expect(routeRow('en', 'to')).toHaveAccessibleName('To: Tbilisi, TBS')
    // A manual endpoint edit releases the shortcut; the block stays in place.
    await userEvent.click(routeRow('en', 'from'))
    await choose(words.en.pickFrom, 'CDG')
    expect(back).toHaveAttribute('aria-pressed', 'false')
  })
})
