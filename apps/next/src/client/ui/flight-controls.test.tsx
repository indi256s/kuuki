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
  it.each(['SVO', 'Sheremetyevo', 'Шереметьево', 'Москва'])('finds a verified reference identity by %s and selects by keyboard', async query => {
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
