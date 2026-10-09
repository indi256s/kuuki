// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { JournalSummary } from './filter'
import { JournalHeader, type JournalHeaderProps } from './header'
import type { JournalFlight, JournalRefs } from './model'
import { NextUp } from './next-up'

const summary = (overrides: Partial<JournalSummary> = {}): JournalSummary => ({ flights: 74, distanceKm: 141204, durationMinutes: 9 * 24 * 60 + 4 * 60, confirmedFlights: 70, distanceMissing: 0, durationMissing: 0, ...overrides })

function setup(overrides: Partial<JournalHeaderProps> = {}) {
  const props: JournalHeaderProps = { locale: 'en', summary: summary(), awaitingCount: 3, importReviewCount: 0, onReview: vi.fn(), importHref: '/import', ...overrides }
  return { props, ...render(<JournalHeader {...props} />) }
}

// SlotText keeps the real value in a hidden span; the rolling columns are aria-hidden decoration.
const values = (container: HTMLElement) => [...container.querySelectorAll('.ui-slot-text-value')].map(node => node.textContent)

it('shows the title, one summary line with confirmed-only wording, and no Add button', () => {
  const { container } = setup()
  expect(screen.getByRole('heading', { level: 1, name: 'Journal' })).toBeInTheDocument()
  expect(values(container)).toEqual(['74', '141,204 km', '9 d 4 h'])
  const line = container.querySelector('.journal-summary')!
  expect(line).toHaveTextContent('flights')
  expect(line).toHaveTextContent('in the air')
  expect(line).toHaveTextContent('(confirmed flights only)')
  expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument()
})

it.each([
  ['en', 1, 'flight'], ['en', 74, 'flights'],
  ['ru', 1, 'перелёт'], ['ru', 2, 'перелёта'], ['ru', 5, 'перелётов'], ['ru', 21, 'перелёт'], ['ru', 11, 'перелётов'],
] as const)('pluralizes the flight count in %s for %i', (locale, flights, noun) => {
  setup({ locale, summary: summary({ flights }) })
  expect(screen.getByText(noun, { selector: 'span span' })).toBeInTheDocument()
})

it.each([
  ['en', 1, '1 to confirm'], ['en', 3, '3 to confirm'],
  ['ru', 1, '1 нужно подтвердить'], ['ru', 3, '3 нужно подтвердить'], ['ru', 5, '5 нужно подтвердить'],
] as const)('words the review pill in %s for %i', async (locale, awaitingCount, label) => {
  const user = userEvent.setup()
  const { props } = setup({ locale, awaitingCount })
  await user.click(screen.getByRole('button', { name: label }))
  expect(props.onReview).toHaveBeenCalledTimes(1)
})

it('hides the review pill at zero', () => {
  setup({ awaitingCount: 0 })
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it.each([
  ['en', 1, '1 import to review'], ['en', 2, '2 imports to review'],
  ['ru', 1, '1 импорт ждёт проверки'], ['ru', 2, '2 импорта ждут проверки'], ['ru', 5, '5 импортов ждут проверки'],
] as const)('links to the import review in %s for %i', (locale, importReviewCount, label) => {
  setup({ locale, importReviewCount, awaitingCount: 0 })
  expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', '/import')
})

it('leaves out the import link at zero', () => {
  setup({ importReviewCount: 0 })
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

afterEach(() => vi.useRealTimers())

const refs: JournalRefs = { airports: { TBS: { city: 'Tbilisi', name: 'Tbilisi International', country: 'GE' } }, airlines: {}, aircraft: {} }
const upcoming = { id: 7, date: '2026-10-21', origin: 'TBS', destination: 'IST', airline_iata: 'TK', flight_number: 'TK381', lifecycle_state: 'upcoming' } as JournalFlight

it('counts down to the next flights and opens one', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 9, 12))
  const onOpen = vi.fn()
  const { unmount } = render(<NextUp flights={[upcoming]} refs={refs} locale="en" onOpen={onOpen} />)
  expect(screen.getByRole('heading', { level: 2, name: 'Next up' })).toBeInTheDocument()
  expect(screen.getByText('in 12 days')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Tbilisi \(TBS\) to IST, Oct 21, 2026, TK381, in 12 days/ })).toBeInTheDocument()
  screen.getByRole('button', { name: /TBS/ }).click()
  expect(onOpen).toHaveBeenCalledWith(7)
  unmount()

  render(<NextUp flights={[upcoming]} refs={refs} locale="ru" onOpen={onOpen} />)
  expect(screen.getByRole('heading', { level: 2, name: 'Скоро' })).toBeInTheDocument()
  expect(screen.getByText('через 12 дней')).toBeInTheDocument()
})

it('renders nothing when no flight is upcoming', () => {
  const { container } = render(<NextUp flights={[]} refs={refs} locale="en" onOpen={vi.fn()} />)
  expect(container).toBeEmptyDOMElement()
})
