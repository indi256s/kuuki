// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { writeDraft } from './draft'
import { blankState, emptyLeg, newId } from './model'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('../api', () => ({
  searchPlaces: vi.fn(async () => []),
  readJourney: vi.fn(),
  readOperation: vi.fn(),
  sendCommand: vi.fn(),
  createManualPlace: vi.fn(),
}))

const { JourneyForm } = await import('./journey-form')

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})

describe('JourneyForm', () => {
  it('asks for the countries answer before an old trip can be saved, with nothing pre-ticked', async () => {
    render(<JourneyForm ownerId="owner-a" locale="en" mode="road" returnTo="/ground-travel" />)
    await userEvent.click(screen.getByRole('radio', { name: 'Already happened' }))
    const countries = screen.getByRole('group', { name: 'Countries you actually crossed' })
    expect(
      within(countries)
        .getAllByRole('checkbox')
        .every((box) => !(box as HTMLInputElement).checked),
    ).toBe(true)
    expect(screen.getByText('Transit without stopping counts.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save journey' }).getAttribute('aria-disabled')).toBe(
      'true',
    )
    await userEvent.click(within(countries).getByRole('checkbox', { name: 'None of these' }))
    expect(
      screen.getByRole('button', { name: 'Save journey' }).getAttribute('aria-disabled'),
    ).toBeNull()
  })

  it('restores only the signed-in owner’s unfinished entry, with a way to discard it', () => {
    const state = blankState('rail')
    state.title = 'Caucasus loop'
    state.legs = [emptyLeg()]
    writeDraft('owner-a', 'new-rail', {
      v: 1,
      journeyId: newId(),
      baseVersion: null,
      state,
      pending: null,
    })
    const { unmount } = render(
      <JourneyForm ownerId="owner-b" locale="en" mode="rail" returnTo="/ground-travel" />,
    )
    expect(screen.queryByText('Unfinished entry restored')).toBeNull()
    unmount()
    render(<JourneyForm ownerId="owner-a" locale="en" mode="rail" returnTo="/ground-travel" />)
    expect(screen.getByText('Unfinished entry restored')).toBeTruthy()
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('Caucasus loop')
  })

  it('mounts the OCR slot in rail journeys only, with the candidate entry point', () => {
    const slot = vi.fn(() => <p>ocr panel</p>)
    render(
      <JourneyForm
        ownerId="owner-a"
        locale="en"
        mode="rail"
        returnTo="/ground-travel"
        ocrSlot={slot}
      />,
    )
    expect(screen.getByText('ocr panel')).toBeTruthy()
    expect(slot).toHaveBeenCalledWith(
      expect.objectContaining({ onCandidates: expect.any(Function), disabled: false }),
    )
  })

  it('shows an unconfirmed save from a reloaded draft with Check result and Retry original save', () => {
    const state = blankState('road')
    const journeyId = newId()
    const pending = {
      action: 'create' as const,
      operationKey: 'key-restored-1',
      journeyId,
      status: 'planned' as const,
      journey: {
        mode: 'road' as const,
        title: null,
        note: null,
        startDate: null,
        endDate: null,
        points: [],
      },
    }
    writeDraft('owner-a', 'new-road', { v: 1, journeyId, baseVersion: null, state, pending })
    render(<JourneyForm ownerId="owner-a" locale="en" mode="road" returnTo="/ground-travel" />)
    expect(screen.getByRole('alert').textContent).toBe('We could not confirm the save')
    expect(screen.getByRole('button', { name: 'Check result' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry original save' })).toBeTruthy()
  })
})
