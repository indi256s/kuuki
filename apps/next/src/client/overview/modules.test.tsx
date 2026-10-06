// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OverviewFigures } from './figures'
import { OverviewMap } from './map-band'
import { OverviewNotable } from './notable'
import { OverviewRankings } from './rankings'
import { OverviewRhythm } from './rhythm'
import { busySummary, emptySummary, fakeLabels, singleFlightSummary, stressSummary } from './fixtures'

// The map's route read stays pending here; its states are covered in map-band.test.tsx.
vi.mock('@kuuki/client/apiClient', () => ({ api: { get: () => new Promise(() => {}) } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
afterEach(cleanup)

const figure = (name: string) => document.querySelector(`[data-figure=${name}]`) as HTMLElement
const hrefs = (root: Element | Document) => [...root.querySelectorAll('a')].map(a => a.getAttribute('href'))

describe('figures', () => {
  it('n=0: genuine zeros with no comparison noise in all time', () => {
    render(<OverviewFigures summary={emptySummary('all')} locale="en" />)
    expect(screen.getByTestId('overview-flights')).toHaveTextContent('0')
    expect(figure('distance')).toHaveTextContent('0')
    expect(figure('distance').querySelector('.ov-caption')).toBeNull()
  })
  it('n=1: unknown distance and duration read as unavailable, a zero baseline reads as the first year', () => {
    render(<OverviewFigures summary={singleFlightSummary('2026')} locale="en" />)
    expect(figure('distance')).toHaveTextContent('—')
    expect(figure('distance')).toHaveTextContent('Distance not recorded')
    expect(figure('time')).toHaveTextContent('Duration not recorded')
    expect(figure('flights')).toHaveTextContent('First year')
    expect(figure('countries')).toHaveTextContent('First year')
  })
  it('n=500: comparison in both languages, pending countries counted apart, distance as laps around the Earth', () => {
    const { rerender } = render(<OverviewFigures summary={busySummary(500)} locale="en" />)
    expect(screen.getByTestId('overview-flights')).toHaveTextContent('500')
    expect(figure('flights')).toHaveTextContent('−50% vs 2025')
    expect(figure('countries')).toHaveTextContent('1 waiting for a stamp')
    expect(figure('distance')).toHaveTextContent('times around the Earth')
    expect(figure('time')).toHaveTextContent('Duration known for 498 of 500 flights')
    rerender(<OverviewFigures summary={busySummary(500)} locale="ru" />)
    expect(figure('flights')).toHaveTextContent('−50% к 2025')
    expect(figure('countries')).toHaveTextContent('1 ждёт отметки')
    expect(figure('time')).toHaveTextContent('Время известно для 498 из 500 перелётов')
  })
  it('names countries and territories, and says all time includes archived flight evidence only for an account that has it', () => {
    const legacy = { ...busySummary(10, 'all'), archivedEvidence: true }
    const { rerender } = render(<OverviewFigures summary={legacy} locale="en" />)
    expect(figure('countries')).toHaveTextContent('Countries and territories')
    expect(figure('countries')).toHaveTextContent('Includes archived flight evidence')
    rerender(<OverviewFigures summary={legacy} locale="ru" />)
    expect(figure('countries')).toHaveTextContent('Страны и территории')
    expect(figure('countries')).toHaveTextContent('Включая архивные данные о перелётах')
    rerender(<OverviewFigures summary={{ ...busySummary(10), archivedEvidence: true }} locale="en" />)
    expect(figure('countries')).not.toHaveTextContent('archived') // a year never reads archived evidence
  })
  it('makes no archive claim for a canonical-only account, or while the country evidence is updating', () => {
    const { rerender } = render(<OverviewFigures summary={busySummary(10, 'all')} locale="en" />)
    expect(figure('countries')).toHaveTextContent('Countries and territories')
    expect(figure('countries')).not.toHaveTextContent('rchived')
    rerender(<OverviewFigures summary={busySummary(10, 'all')} locale="ru" />)
    expect(figure('countries')).not.toHaveTextContent('архивн')
    rerender(<OverviewFigures summary={{ ...busySummary(10, 'all'), archivedEvidence: true, countryState: 'updating', totals: { ...busySummary(10, 'all').totals, countries: null } }} locale="en" />)
    expect(figure('countries')).not.toHaveTextContent('rchived')
    rerender(<OverviewFigures summary={{ ...busySummary(10, 'all'), archivedEvidence: true, countryState: 'updating' }} locale="en" />)
    expect(figure('countries')).not.toHaveTextContent('rchived') // gated on readiness even if a total were present
  })

  it('all time shows no year-over-year percentage', () => {
    render(<OverviewFigures summary={busySummary(500, 'all')} locale="en" />)
    expect(document.body.textContent).not.toMatch(/vs 20\d\d/)
    expect(document.body.textContent).not.toMatch(/%/)
  })
  it('shows an updating countries figure, never a zero', () => {
    const summary = busySummary(10)
    render(<OverviewFigures summary={{ ...summary, countryState: 'updating', totals: { ...summary.totals, countries: null, pendingCountries: null }, comparison: { ...summary.comparison!, countries: null } }} locale="en" />)
    expect(figure('countries')).toHaveTextContent('—')
    expect(figure('countries')).toHaveTextContent('Updating')
  })
})

describe('map band', () => {
  it('lists every country as text with visits, the legend line, and the Passport map link with the year', () => {
    render(<OverviewMap summary={busySummary(10)} locale="en" labels={fakeLabels} />)
    expect(screen.getByRole('link', { name: /Open Passport map/ })).toHaveAttribute('href', '/passport?view=map&year=2026')
    expect(document.querySelector('.ov-legend-line')).toHaveTextContent('7 routes · 8 airports · 6 countries and territories · 1 waiting for a stamp')
    expect(document.querySelectorAll('.ov-legend li')).toHaveLength(4)
    const list = document.querySelector('.ov-country-list ul') as HTMLElement
    expect(within(list).getByText(/Country JP · 3 visits/)).toBeInTheDocument()
    expect(within(list).getByText(/Country AU · 1 visit · waiting for a stamp/)).toBeInTheDocument()
  })
  it('keeps waiting countries unpressed beside the period visit buckets', () => {
    render(<OverviewMap summary={busySummary(10)} locale="en" labels={fakeLabels} />)
    const dots = [...document.querySelectorAll('svg circle title')].map(node => node.textContent)
    expect(dots).toContain('JP')
    expect(dots).toContain('AU')
    expect(document.querySelector('circle[data-country="AU"]')).toHaveAttribute('data-pending', 'true')
    expect(document.querySelector('circle[data-country="AU"]')).toHaveAttribute('fill', 'none')
  })
  it('n=0 has a sentence instead of a list and an all-time link without a year', () => {
    render(<OverviewMap summary={emptySummary('all')} locale="ru" labels={fakeLabels} />)
    expect(screen.getByRole('link', { name: /Открыть карту паспорта/ })).toHaveAttribute('href', '/passport?view=map')
    expect(screen.getByText('Пока нет стран.')).toBeInTheDocument()
  })
  it('says the country figures are updating', () => {
    const summary = busySummary(10)
    render(<OverviewMap summary={{ ...summary, countryState: 'updating', totals: { ...summary.totals, countries: null, pendingCountries: null }, map: { ...summary.map, countries: [] } }} locale="en" labels={fakeLabels} />)
    expect(screen.getByRole('status')).toHaveTextContent('Country figures are updating.')
  })
})

describe('notable', () => {
  it('links routes and the favorite airline to the Journal with the selected year', () => {
    render(<OverviewNotable summary={busySummary(10)} locale="en" labels={fakeLabels} />)
    expect(hrefs(document.body)).toEqual([
      '/journal?year=2026&status=completed&origin=JFK&destination=SYD', '/journal?year=2026&status=completed&origin=TBS&destination=IST', '/journal?year=2026&status=completed&airline=TK',
    ])
    expect(screen.getByText('New countries in 2026')).toBeInTheDocument()
    expect(screen.getByText(/Country AU \(waiting for a stamp\)/)).toBeInTheDocument()
    expect(screen.queryByText(/more/)).toBeNull()
  })
  it('stress: more new countries than the list holds says how many more', () => {
    render(<OverviewNotable summary={stressSummary()} locale="en" labels={fakeLabels} />)
    expect(screen.getByText(/and 2 more/)).toBeInTheDocument()
  })
  it('omits every row the period has no fact for, and has a sentence when there are none', () => {
    render(<OverviewNotable summary={emptySummary('all')} locale="en" labels={fakeLabels} />)
    expect(document.querySelector('dl')).toBeNull()
    expect(screen.getByText('More journeys will reveal a pattern.')).toBeInTheDocument()
  })
  it('does not list new countries in all time', () => {
    render(<OverviewNotable summary={busySummary(10, 'all')} locale="en" labels={fakeLabels} />)
    expect(screen.queryByText(/New countries/)).toBeNull()
    expect(hrefs(document.body)[0]).toBe('/journal?status=completed&origin=JFK&destination=SYD')
  })
})

describe('rankings', () => {
  it('n=10: lists with row and All links carrying the selected year and the category filter', () => {
    render(<OverviewRankings summary={busySummary(10)} locale="en" labels={fakeLabels} />)
    const airlines = screen.getByRole('region', { name: 'Airlines' })
    expect(within(airlines).getAllByRole('listitem')).toHaveLength(5)
    expect(hrefs(airlines)).toEqual(['/journal?year=2026&status=completed&sort=airline_iata', ...['TK', 'PC', 'BA', 'LH', 'AF'].map(code => `/journal?year=2026&status=completed&airline=${code}`)])
    expect(hrefs(screen.getByRole('region', { name: 'Airports' }))[1]).toBe('/journal?year=2026&status=completed&airport=IST')
    expect(hrefs(screen.getByRole('region', { name: 'Aircraft' }))).toContain('/journal?year=2026&status=completed&aircraft=A320')
    expect(document.querySelector(".ov-manufacturers")).toHaveTextContent("Airbus (5), Boeing (2)")
  })
  it('all time links carry no year', () => {
    render(<OverviewRankings summary={busySummary(10, 'all')} locale="en" labels={fakeLabels} />)
    expect(hrefs(document.body).filter(href => href?.includes('year='))).toEqual([])
  })
  it('n=1 and two entries become sentences, not bars', () => {
    const summary = singleFlightSummary('2026')
    render(<OverviewRankings summary={{ ...summary, topLists: { ...summary.topLists, airlines: [{ id: 'TK', count: 1 }], aircraft: [{ id: 'A320', count: 1 }] } }} locale="en" labels={fakeLabels} />)
    expect(screen.getAllByText(/All 1 flight:/)).toHaveLength(2)
    expect(screen.getByRole('region', { name: 'Airports' }).querySelector('.rank-list')).toBeNull()
    expect(screen.getByRole('region', { name: 'Airports' })).toHaveTextContent('Passed through JFK · City JFK (1), TBS · City TBS (1).')
  })
  it('n=0 says there is nothing to rank and has no All links', () => {
    render(<OverviewRankings summary={emptySummary('all')} locale="en" labels={fakeLabels} />)
    expect(screen.getAllByText('Nothing recorded for this period yet.')).toHaveLength(3)
    expect(document.querySelectorAll('a')).toHaveLength(0)
  })
  it('turns missing aircraft into an action that opens the review, with Russian plural forms', () => {
    const summary = busySummary(500)
    const { rerender } = render(<OverviewRankings summary={{ ...summary, dataAvailability: { ...summary.dataAvailability, missingAircraft: 69 } }} locale="ru" labels={fakeLabels} />)
    expect(screen.getByText('У 69 рейсов не указан самолёт')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Проверить самолёты' })).toBeInTheDocument()
    expect(hrefs(document.body).some(href => href?.includes('sort=aircraft_icao&order=asc'))).toBe(false)
    rerender(<OverviewRankings summary={{ ...summary, dataAvailability: { ...summary.dataAvailability, missingAircraft: 1 } }} locale="ru" labels={fakeLabels} />)
    expect(screen.getByText('У 1 рейса не указан самолёт')).toBeInTheDocument()
    rerender(<OverviewRankings summary={{ ...summary, dataAvailability: { ...summary.dataAvailability, missingAircraft: 0 } }} locale="en" labels={fakeLabels} />)
    expect(screen.queryByText(/no aircraft listed/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Review aircraft/ })).toBeNull()
  })
})

describe('rhythm', () => {
  it('has a text for every month, the busiest month and six region chips with waiting shown apart', () => {
    render(<OverviewRhythm summary={busySummary(500)} locale="en" />)
    expect(document.querySelectorAll('.ov-months li')).toHaveLength(12)
    expect(screen.getByText('April 2026: 150 flights')).toBeInTheDocument()
    expect(screen.getByText('Busiest month: April 2026, 150 flights.')).toBeInTheDocument()
    const chips = [...document.querySelectorAll('.ov-regions li')].map(li => li.textContent)
    expect(chips).toHaveLength(6)
    expect(chips).toContain('Asia3 of 52')
    expect(chips).toContain('Oceania0 of 28 +1 waiting')
  })
  it('all time labels the window, n=0 says nothing flew, and updating replaces the chips', () => {
    const { rerender } = render(<OverviewRhythm summary={emptySummary('all')} locale="ru" />)
    expect(screen.getByText('Последние 12 месяцев')).toBeInTheDocument()
    expect(screen.getByText('В этом периоде перелётов нет.')).toBeInTheDocument()
    rerender(<OverviewRhythm summary={{ ...emptySummary('2026'), regions: null }} locale="en" />)
    expect(screen.getByText('Country figures are updating.')).toBeInTheDocument()
    expect(document.querySelector('.ov-regions')).toBeNull()
  })
})
