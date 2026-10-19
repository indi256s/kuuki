// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import type { JournalSummary } from './filter'
import { JournalHeader, type JournalHeaderProps } from './header'
import type { JournalFlight, JournalRefs } from './model'
import { NextUp } from './next-up'

const summary = (overrides: Partial<JournalSummary> = {}): JournalSummary => ({
  flights: 74,
  distanceKm: 141204,
  durationMinutes: 9 * 24 * 60 + 4 * 60,
  durationEstimated: false,
  distanceMissing: 0,
  durationMissing: 0,
  ...overrides,
})

function setup(overrides: Partial<JournalHeaderProps> = {}) {
  const props: JournalHeaderProps = {
    locale: 'en',
    summary: summary(),
    awaitingCount: 3,
    importReviewCount: 0,
    onReview: vi.fn(),
    importHref: '/import',
    ...overrides,
  }
  return { props, ...render(<JournalHeader {...props} />) }
}

// SlotText keeps the real value in a hidden span; the rolling columns are aria-hidden decoration.
const values = (container: HTMLElement) =>
  [...container.querySelectorAll('.ui-slot-text-value')].map((node) => node.textContent)

it('shows the Journal heading with its section, the section switch and labeled summary metrics', () => {
  const { container } = setup()
  expect(screen.getByRole('heading', { level: 1, name: 'Journal · Flights' })).toHaveTextContent(
    /^Journal/,
  )
  const sections = within(screen.getByRole('navigation', { name: 'Journal sections' }))
  expect(sections.getByRole('link', { name: 'Flights' })).toHaveAttribute('aria-current', 'page')
  expect(sections.getByRole('link', { name: 'Ground' })).toHaveAttribute('href', '/ground-travel')
  expect(sections.getByRole('link', { name: 'Ground' })).not.toHaveAttribute('aria-current')
  expect(window.sessionStorage.getItem('kuuki:journal-section')).toBe('flights')
  expect(values(container)).toEqual(['74', '141,204 km', '9 d 4 h'])
  const line = container.querySelector('.journal-summary')!
  expect(line).toHaveTextContent('flights')
  expect(line).toHaveTextContent('Distance')
  expect(line).toHaveTextContent('In the air')
  expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()
})

it.each([
  ['en', 1, 'flight'],
  ['en', 74, 'flights'],
  ['ru', 1, 'перелёт'],
  ['ru', 2, 'перелёта'],
  ['ru', 5, 'перелётов'],
  ['ru', 21, 'перелёт'],
  ['ru', 11, 'перелётов'],
] as const)('pluralizes the flight count in %s for %i', (locale, flights, noun) => {
  setup({ locale, summary: summary({ flights }) })
  expect(screen.getByText(noun, { selector: 'dt' })).toBeInTheDocument()
})

it.each([
  ['en', 1, 'Confirm 1'],
  ['en', 3, 'Confirm 3'],
  ['ru', 1, 'Подтвердить 1'],
  ['ru', 3, 'Подтвердить 3'],
  ['ru', 5, 'Подтвердить 5'],
] as const)('words the review pill in %s for %i', async (locale, awaitingCount, label) => {
  const user = userEvent.setup()
  const { props } = setup({ locale, awaitingCount })
  await user.click(screen.getByRole('button', { name: label }))
  expect(props.onReview).toHaveBeenCalledTimes(1)
})

it('hides the review pill at zero', () => {
  setup({ awaitingCount: 0 })
  expect(screen.queryByRole('button', { name: /^Confirm/ })).not.toBeInTheDocument()
})

it('preserves the incomplete-distance marker alongside estimated time', () => {
  const { container } = setup({
    summary: {
      ...summary({ distanceMissing: 1 }),
      durationEstimated: true,
    },
  })
  const totals = container.querySelector('.journal-summary')!
  expect(totals).toHaveTextContent('≥')
  expect(values(container)).toEqual(['74', '≥ 141,204 km', '9 d 4 h'])
})

it.each([
  ['en', 1, '1 import to review'],
  ['en', 2, '2 imports to review'],
  ['ru', 1, '1 импорт ждёт проверки'],
  ['ru', 2, '2 импорта ждут проверки'],
  ['ru', 5, '5 импортов ждут проверки'],
] as const)('links to the import review in %s for %i', (locale, importReviewCount, label) => {
  setup({ locale, importReviewCount, awaitingCount: 0 })
  expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', '/import')
})

it('leaves out the import link at zero', () => {
  setup({ importReviewCount: 0 })
  expect(screen.queryByRole('link', { name: /import/ })).not.toBeInTheDocument()
})

afterEach(() => vi.useRealTimers())

const refs: JournalRefs = {
  airports: { TBS: { city: 'Tbilisi', name: 'Tbilisi International', country: 'GE' } },
  airlines: {},
  aircraft: {},
}
const upcoming = {
  id: 7,
  date: '2026-10-21',
  origin: 'TBS',
  destination: 'IST',
  airline_iata: 'TK',
  flight_number: 'TK381',
  lifecycle_state: 'upcoming',
} as JournalFlight

it('counts down to the next flights and opens one', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 9, 12))
  const onOpen = vi.fn()
  const later = [
    { ...upcoming, id: 8, date: '2026-10-10', origin: 'IST', destination: 'JFK' },
    { ...upcoming, id: 9, date: '2027-01-02', origin: 'JFK', destination: 'TBS' },
  ] as JournalFlight[]
  const { container, unmount } = render(
    <NextUp flights={[upcoming, ...later]} refs={refs} locale="en" onOpen={onOpen} />,
  )
  expect(screen.getByRole('heading', { level: 2, name: 'Next up' })).toBeInTheDocument()
  // The lead's split-flap count is settled on first render; the departure time is shown only when recorded.
  const digits = [...container.querySelectorAll('.split-flap-digit')]
  expect(digits.map((node) => node.textContent)).toEqual(['1', '2'])
  expect(digits.some((node) => node.hasAttribute('data-flip'))).toBe(false)
  expect(screen.getByText('days')).toBeInTheDocument()
  expect(screen.getByText('Tbilisi → IST')).toBeInTheDocument()
  expect(screen.getByText('Wed, Oct 21')).toBeInTheDocument()
  expect(screen.getByText('TK381')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: /Tbilisi \(TBS\) to IST, Oct 21, 2026, TK381, in 12 days/ }),
  ).toBeInTheDocument()
  // Later flights: quieter, one named button each; tomorrow is a word, a next-year date carries its year.
  expect(screen.getByText('Tomorrow')).toBeInTheDocument()
  expect(screen.getByText('JFK → Tbilisi')).toBeInTheDocument()
  expect(screen.getByText(/Sat, Jan 2, 2027/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /IST to JFK.*tomorrow/ })).toBeInTheDocument()
  screen.getByRole('button', { name: /^Tbilisi \(TBS\)/ }).click()
  expect(onOpen).toHaveBeenCalledWith(7)
  unmount()

  render(
    <NextUp
      flights={[{ ...upcoming, departure_time: '05:30:00' }, later[1]]}
      refs={refs}
      locale="ru"
      onOpen={onOpen}
    />,
  )
  expect(screen.getByRole('heading', { level: 2, name: 'Скоро' })).toBeInTheDocument()
  expect(screen.getByText('дней')).toBeInTheDocument()
  expect(screen.getByText(/ · 05:30$/)).toBeInTheDocument()
  expect(screen.getByText('85 дней')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /через 12 дней/ })).toBeInTheDocument()
})

it('flips the count only when the day changes while open', () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date(2026, 9, 9, 23, 59))
  const { container } = render(
    <NextUp flights={[upcoming]} refs={refs} locale="en" onOpen={vi.fn()} />,
  )
  const digits = () => [...container.querySelectorAll('.split-flap-digit')]
  expect(digits().map((node) => node.textContent)).toEqual(['1', '2'])
  act(() => vi.advanceTimersByTime(2 * 60_000))
  expect(digits().map((node) => node.textContent)).toEqual(['1', '1'])
  expect(digits().map((node) => node.hasAttribute('data-flip'))).toEqual([false, true])
})

it('flips the tomorrow word in when it replaces the flaps while open, and paints it settled on mount', () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date(2026, 9, 19, 23, 59))
  const { container, unmount } = render(
    <NextUp flights={[upcoming]} refs={refs} locale="en" onOpen={vi.fn()} />,
  )
  expect(container.querySelector('.journal-next-word')).toBeNull()
  act(() => vi.advanceTimersByTime(2 * 60_000))
  expect(screen.getByText('Tomorrow')).toHaveAttribute('data-flip')
  unmount()

  render(<NextUp flights={[upcoming]} refs={refs} locale="en" onOpen={vi.fn()} />)
  expect(screen.getByText('Tomorrow')).not.toHaveAttribute('data-flip')
})

it('flips the count in when it arrives after hydration', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 9, 12))
  const ui = <NextUp flights={[upcoming]} refs={refs} locale="en" onOpen={vi.fn()} />
  const container = document.createElement('div')
  container.innerHTML = renderToString(ui)
  document.body.appendChild(container)
  // The server knows no today, so its markup has dates but no count.
  expect(container.querySelector('.split-flap-cell')).toBeNull()
  await act(async () => {
    render(ui, { container, hydrate: true })
  })
  const digits = [...container.querySelectorAll('.split-flap-digit')]
  expect(digits.map((node) => node.textContent)).toEqual(['1', '2'])
  expect(digits.every((node) => node.hasAttribute('data-flip'))).toBe(true)
})

it('says today instead of flaps', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 21, 8))
  const { container } = render(
    <NextUp flights={[upcoming]} refs={refs} locale="ru" onOpen={vi.fn()} />,
  )
  expect(screen.getByText('Сегодня')).toBeInTheDocument()
  expect(container.querySelector('.split-flap-cell')).toBeNull()
})

it('renders nothing when no flight is upcoming', () => {
  const { container } = render(<NextUp flights={[]} refs={refs} locale="en" onOpen={vi.fn()} />)
  expect(container).toBeEmptyDOMElement()
})
