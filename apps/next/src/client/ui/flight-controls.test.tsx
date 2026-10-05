// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
