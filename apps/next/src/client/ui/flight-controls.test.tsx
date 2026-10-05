// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Calendar } from './calendar'
import { Combobox } from './combobox'
import { airportChoices } from '../capture/reference-choices'
import type { Locale } from '../../lib/format'

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
})
function DateHarness({ locale }: { locale: Locale }) {
  const [value, setValue] = useState('2026-10-05')
  return <><Calendar label="Flight date" locale={locale} value={value} onChange={setValue} /><output>{value}</output></>
}
function SearchHarness({ locale }: { locale: Locale }) {
  const [value, setValue] = useState('')
  return <><Combobox label="Airport" locale={locale} choices={airportChoices(locale)} value={value} onChange={setValue} /><output>{value}</output></>
}
describe.each(['en', 'ru'] as const)('flight controls (%s)', locale => {
  it.each(['SVO', 'Sheremetyevo', 'Шереметьево', 'Москва'])('matches a catalog airport by %s and selects by keyboard', async query => {
    render(<SearchHarness locale={locale} />)
    const input = screen.getByRole('combobox', { name: 'Airport' })
    await userEvent.click(input)
    fireEvent.change(input, { target: { value: query } })
    expect(screen.getByRole('option', { name: /SVO/ })).toBeInTheDocument()
    if (query === 'Москва') fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('status')).toHaveTextContent(/^(SVO|VKO)$/)
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })
  it('matches native script and identifies untranslated reference names honestly', async () => {
    render(<SearchHarness locale={locale} />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    fireEvent.change(input, { target: { value: 'თბილისი' } })
    expect(screen.getByRole('option', { name: /TBS/ })).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'JFK' } })
    const option = screen.getByRole('option', { name: /JFK/ })
    if (locale === 'ru') expect(option).toHaveTextContent('Название на английском')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })
  it('types a localized date and picks a keyboard-accessible calendar day without shifting the label', async () => {
    render(<DateHarness locale={locale} />)
    const input = screen.getByLabelText('Flight date')
    fireEvent.change(input, { target: { value: locale === 'ru' ? '29.03.2026' : '03/29/2026' } })
    expect(screen.getByRole('status')).toHaveTextContent('2026-03-29')
    await userEvent.click(screen.getByRole('button', { name: locale === 'ru' ? 'Календарь' : 'Calendar' }))
    expect(screen.getByText(locale === 'ru' ? 'март 2026 г.' : 'March 2026')).toBeInTheDocument()
    expect(screen.getByText(locale === 'ru' ? 'пн' : 'Sun')).toBeInTheDocument()
    const selected = screen.getByRole('button', { name: locale === 'ru' ? '29 марта 2026 г.' : 'March 29, 2026' })
    selected.focus()
    fireEvent.keyDown(selected, { key: 'ArrowRight' })
    const next = screen.getByRole('button', { name: locale === 'ru' ? '30 марта 2026 г.' : 'March 30, 2026' })
    await waitFor(() => expect(next).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('2026-03-30')
    expect(input).toHaveFocus()
  })
})
it.each([[1, 'Найден 1 вариант'], [2, 'Найдено 2 варианта'], [5, 'Найдено 5 вариантов'], [21, 'Найден 21 вариант']])('announces the Russian plural for %i matches', async (count, text) => {
  render(<Combobox label="Airport" locale="ru" choices={Array.from({ length: Number(count) }, (_, index) => ({ code: `A${index}`, label: 'Airport' }))} value="" onChange={() => {}} />)
  await userEvent.click(screen.getByRole('combobox'))
  expect(screen.getByRole('status')).toHaveTextContent(String(text))
})

it.each([false, true])('scrolls the active option into view (mobile=%s)', async mobile => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  try {
    render(<SearchHarness locale="en" />)
    await userEvent.click(screen.getByRole('combobox'))
    const input = mobile ? screen.getByRole('dialog').querySelector('input')! : screen.getByRole('combobox')
    await waitFor(() => expect(input).toHaveFocus())
    scroll.mockClear()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'nearest' }))
    const active = document.getElementById(input.getAttribute('aria-activedescendant')!)!
    expect(scroll.mock.instances.at(-1)).toBe(active)
  } finally {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  }
})

it.each(['en', 'ru'] as const)('returns mobile search focus after selection and Escape (%s)', async locale => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  render(<SearchHarness locale={locale} />)
  const origin = screen.getByRole('combobox', { name: 'Airport' })
  await userEvent.click(origin)
  const search = await screen.findByRole('dialog')
  fireEvent.change(search.querySelector('input')!, { target: { value: 'JFK' } })
  await userEvent.click(screen.getByRole('option', { name: /JFK/ }))
  await waitFor(() => expect(document.activeElement).toBe(origin))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(origin)
  const reopened = await screen.findByRole('dialog')
  await waitFor(() => expect(reopened.querySelector('input')).toHaveFocus())
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(document.activeElement).toBe(origin))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it.each(['en', 'ru'] as const)('returns calendar Escape focus to the date input (%s)', async locale => {
  render(<DateHarness locale={locale} />)
  await userEvent.click(screen.getByRole('button', { name: locale === 'ru' ? 'Календарь' : 'Calendar' }))
  const day = screen.getByRole('button', { name: locale === 'ru' ? '5 октября 2026 г.' : 'October 5, 2026' })
  day.focus()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('group')).not.toBeInTheDocument()
  expect(document.activeElement).toBe(screen.getByLabelText('Flight date'))
})

function Probe({ locale, initial = '' }: { locale: Locale; initial?: string }) {
  const [value, setValue] = useState(initial)
  return <><Combobox label="Airport" locale={locale} choices={airportChoices(locale)} value={value} onChange={setValue} /><output>{value}</output></>
}
describe('combobox free text', () => {
  it('shows the query as typed and settles on the single match when focus leaves', async () => {
    render(<Probe locale="en" />)
    const input = screen.getByRole('combobox', { name: 'Airport' })
    await userEvent.click(input)
    fireEvent.change(input, { target: { value: 'Tbilisi' } })
    expect(input).toHaveValue('Tbilisi')
    fireEvent.blur(input)
    expect(screen.getByRole('status')).toHaveTextContent('TBS')
    expect(input).toHaveValue('TBS')
  })
  it('settles on an exact code, in any case', async () => {
    render(<Probe locale="en" />)
    const input = screen.getByRole('combobox', { name: 'Airport' })
    await userEvent.click(input)
    fireEvent.change(input, { target: { value: 'ist' } })
    expect(input).toHaveValue('ist')
    fireEvent.blur(input)
    expect(input).toHaveValue('IST')
  })
  it.each(['en', 'ru'] as const)('reverts to the last committed code when the text is ambiguous or on Escape (%s)', async locale => {
    render(<Probe locale={locale} initial="JFK" />)
    const input = screen.getByRole('combobox', { name: 'Airport' })
    await userEvent.click(input)
    fireEvent.change(input, { target: { value: locale === 'ru' ? 'Москва' : 'Moscow' } })
    fireEvent.blur(input)
    expect(input).toHaveValue('JFK')
    expect(screen.getByRole('status')).toHaveTextContent('JFK')
    await userEvent.click(input)
    fireEvent.change(input, { target: { value: 'zzz' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveValue('JFK')
    expect(screen.getByRole('status')).toHaveTextContent('JFK')
  })
  it('reverts when the mobile search sheet closes without a choice', async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
    render(<Probe locale="en" initial="JFK" />)
    const origin = screen.getByRole('combobox', { name: 'Airport' })
    await userEvent.click(origin)
    const search = await screen.findByRole('dialog')
    fireEvent.change(search.querySelector('input')!, { target: { value: 'Moscow' } })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(origin).toHaveValue('JFK')
  })
  it('opens on the first option when ArrowDown reopens a closed list', async () => {
    render(<Probe locale="en" />)
    const input = screen.getByRole('combobox', { name: 'Airport' })
    await userEvent.click(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-option-0$/)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-option-1$/)
  })
})

describe.each(['en', 'ru'] as const)('calendar keyboard and semantics (%s)', locale => {
  const name = (day: number, month = locale === 'ru' ? 'марта' : 'March') => locale === 'ru' ? `${day} ${month} 2026 г.` : `${month} ${day}, 2026`
  async function open() {
    render(<DateHarness locale={locale} />)
    const input = screen.getByLabelText('Flight date')
    fireEvent.change(input, { target: { value: '2026-03-29' } })
    await userEvent.click(screen.getByRole('button', { name: locale === 'ru' ? 'Календарь' : 'Calendar' }))
    const day = screen.getByRole('button', { name: name(29) })
    day.focus()
    return day
  }
  it('moves by week start/end and by month with Home, End, PageUp and PageDown', async () => {
    const day = await open()
    fireEvent.keyDown(day, { key: 'Home' })
    await waitFor(() => expect(screen.getByRole('button', { name: name(locale === 'ru' ? 23 : 29) })).toHaveFocus())
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    await waitFor(() => expect(screen.getByRole('button', { name: name(locale === 'ru' ? 29 : 4, locale === 'ru' ? 'марта' : 'April') })).toHaveFocus())
    fireEvent.keyDown(document.activeElement!, { key: 'PageDown' })
    await waitFor(() => expect(screen.getByRole('button', { name: locale === 'ru' ? '29 апреля 2026 г.' : 'May 4, 2026' })).toHaveFocus())
    fireEvent.keyDown(document.activeElement!, { key: 'PageUp' })
    await waitFor(() => expect(screen.getByRole('button', { name: locale === 'ru' ? '29 марта 2026 г.' : 'April 4, 2026' })).toHaveFocus())
    fireEvent.keyDown(document.activeElement!, { key: 'PageDown', shiftKey: true })
    await waitFor(() => expect(screen.getByRole('button', { name: locale === 'ru' ? '29 марта 2027 г.' : 'April 4, 2027' })).toHaveFocus())
  })
  it('clamps month moves to the last day of a shorter month', async () => {
    render(<DateHarness locale={locale} />)
    fireEvent.change(screen.getByLabelText('Flight date'), { target: { value: '2026-01-31' } })
    await userEvent.click(screen.getByRole('button', { name: locale === 'ru' ? 'Календарь' : 'Calendar' }))
    const day = screen.getByRole('button', { name: locale === 'ru' ? '31 января 2026 г.' : 'January 31, 2026' })
    day.focus()
    fireEvent.keyDown(day, { key: 'PageDown' })
    await waitFor(() => expect(screen.getByRole('button', { name: locale === 'ru' ? '28 февраля 2026 г.' : 'February 28, 2026' })).toHaveFocus())
  })
  it('exposes a labelled grid with selected cells, marks today and uses icon month buttons', async () => {
    await open()
    const grid = screen.getByRole('grid')
    expect(grid).toHaveAccessibleName(locale === 'ru' ? 'март 2026 г.' : 'March 2026')
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7)
    const selected = within(grid).getAllByRole('gridcell', { selected: true })
    expect(selected).toHaveLength(1)
    expect(within(selected[0]).getByRole('button')).toHaveTextContent('29')
    expect(within(grid).queryByRole('button', { pressed: true })).toBeNull()
    for (const button of screen.getAllByRole('button', { name: locale === 'ru' ? /месяц/ : /month/ })) {
      expect(button.textContent).toBe('')
      expect(button.querySelector('svg')).not.toBeNull()
    }
  })
  it('marks today with aria-current', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-12T12:00:00Z'))
    try {
      await open()
      expect(screen.getByRole('button', { name: name(12) })).toHaveAttribute('aria-current', 'date')
    } finally { vi.useRealTimers() }
  })
})

describe.each([['en', '02/29/2024', '2024-02-29'], ['ru', '29.02.2024', '2024-02-29'], ['en', '02/29/2025', '2025-02-29'], ['ru', '29.02.2025', '2025-02-29']] as const)('typed date (%s %s)', (locale, typed, expected) => {
  it('is normalized to ISO; impossible calendar days stay invalid text', () => {
    render(<DateHarness locale={locale} />)
    fireEvent.change(screen.getByLabelText('Flight date'), { target: { value: typed } })
    expect(screen.getByRole('status')).toHaveTextContent(expected)
    expect(screen.getByLabelText('Flight date')).toHaveValue(expected.startsWith('2024') ? (locale === 'ru' ? '29.02.2024' : '02/29/2024') : expected)
  })
})
it.each([['en', '29/02/2024'], ['en', '13/45/2026'], ['ru', '02/29/2024'], ['ru', '31.02.2026']] as const)('keeps a wrong-format date (%s %s) visible instead of dropping it', (locale, typed) => {
  render(<DateHarness locale={locale} />)
  fireEvent.change(screen.getByLabelText('Flight date'), { target: { value: typed } })
  const text = screen.getByRole('status').textContent!
  expect(text).not.toBe('')
  expect(screen.getByLabelText('Flight date')).toHaveValue(text)
})
