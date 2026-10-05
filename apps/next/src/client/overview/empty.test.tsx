// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OverviewEmptyYear, OverviewFirstRun } from './empty'
import { OverviewFailure, OverviewView } from './view'
import { busySummary, emptySummary, fakeLabels, legacyOnlySummary, singleFlightSummary } from './fixtures'
import { SAMPLE_SUMMARY } from './sample-data'

// The map's route read stays pending here; its states are covered in map-band.test.tsx.
vi.mock('../../../../web/src/lib/apiClient', () => ({ api: { get: () => new Promise(() => {}) } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../awaiting', () => ({ useAwaiting: () => ({ data: null, error: false, reload: () => {} }) }))
afterEach(cleanup)

describe('first run', () => {
  it('puts the call to action above a labelled, inert, hidden sample that carries no real-figure test id', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<OverviewFirstRun locale="en" labels={fakeLabels} />)
    const cta = screen.getByTestId('overview-empty')
    const sample = screen.getByTestId('overview-sample')
    expect(cta.compareDocumentPosition(sample) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('link', { name: /Import/ })).toHaveAttribute('href', '/import')
    expect(sample).toHaveTextContent(/sample/i)
    const body = sample.querySelector('.ov-sample-body') as HTMLElement
    expect(body.hasAttribute('inert')).toBe(true)
    expect(body).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByTestId('overview-flights')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
  it('never puts sample numbers into a cache or a real total, and leaves the sample unmutated', () => {
    const before = JSON.stringify(SAMPLE_SUMMARY)
    const client = new QueryClient()
    render(<OverviewFirstRun locale="ru" labels={fakeLabels} />)
    expect(client.getQueryCache().getAll()).toHaveLength(0)
    expect(JSON.stringify(SAMPLE_SUMMARY)).toBe(before)
    expect(emptySummary('all').totals.flights).toBe(0)
  })
  it('an empty year is a sentence in an account that has flights', () => {
    render(<OverviewEmptyYear period="2024" locale="en" />)
    expect(screen.getByTestId('overview-empty-year')).toHaveTextContent('2024')
  })
})

describe('OverviewView', () => {
  it('first-run account: the empty state, no real figures', () => {
    render(<OverviewView ownerId="u1" summary={emptySummary('all')} locale="en" labels={fakeLabels} />)
    expect(screen.getByTestId('overview-data')).toHaveAttribute('data-mode', 'first-run')
    expect(screen.getByTestId('overview-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('overview-flights')).toBeNull()
  })
  it('a legacy-only account keeps its real geography and caption, and never sees the sample', () => {
    render(<OverviewView ownerId="u1" summary={legacyOnlySummary()} locale="en" labels={fakeLabels} />)
    expect(screen.getByTestId('overview-data')).toHaveAttribute('data-mode', 'data')
    expect(screen.queryByTestId('overview-sample')).toBeNull()
    expect(screen.queryByTestId('overview-empty')).toBeNull()
    expect(document.querySelector('[data-figure=countries]')).toHaveTextContent('1')
    expect(document.querySelector('[data-figure=countries]')).toHaveTextContent('Includes archived flight evidence')
    expect(screen.getByText(/Country AE · 2 visits/)).toBeInTheDocument()
  })
  it('a year without flights in a non-empty account', () => {
    render(<OverviewView ownerId="u1" summary={{ ...emptySummary('2019'), years: [2026, 2019] }} locale="en" labels={fakeLabels} />)
    expect(screen.getByTestId('overview-data')).toHaveAttribute('data-mode', 'empty-year')
    expect(screen.getByTestId('overview-empty-year')).toBeInTheDocument()
  })
  it('real data: one figures block, the period control, and no filter inputs', () => {
    render(<OverviewView ownerId="u1" summary={busySummary(10)} locale="en" labels={fakeLabels} />)
    expect(screen.getByTestId('overview-flights')).toHaveTextContent('10')
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
    expect(screen.queryByTestId('overview-sample')).toBeNull()
    expect(document.querySelectorAll('input:not([type=radio]), textarea')).toHaveLength(0)
  })
  it('says the figures are updating or stale instead of presenting them as final', () => {
    const { rerender } = render(<OverviewView ownerId="u1" summary={{ ...singleFlightSummary('all'), derivedState: 'pending' }} locale="en" labels={fakeLabels} />)
    expect(document.querySelector('.status-note[role=status]')).not.toBeNull()
    rerender(<OverviewView ownerId="u1" summary={{ ...singleFlightSummary('all'), derivedState: 'error' }} locale="en" labels={fakeLabels} />)
    expect(document.querySelector('.status-note[role=status]')).not.toBeNull()
  })
})

describe('OverviewFailure', () => {
  it('is an explicit alert with a retry to the same period, never an empty summary', () => {
    render(<OverviewFailure period="2025" locale="en" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Retry|Try again/ })).toHaveAttribute('href', '/overview?year=2025')
    expect(screen.queryByTestId('overview-flights')).toBeNull()
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
  })
})
