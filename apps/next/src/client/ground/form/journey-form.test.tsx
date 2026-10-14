// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@kuuki/client/apiClient'
import type { GroundJourneyDto } from '@kuuki/shared/groundTravel'
import { readDraft, writeDraft } from './draft'
import { blankState, emptyLeg, newId } from './model'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))
vi.mock('../api', () => ({
  searchPlaces: vi.fn(async () => []),
  readJourney: vi.fn(),
  readOperation: vi.fn(),
  sendCommand: vi.fn(),
  createManualPlace: vi.fn(),
}))

const { JourneyForm } = await import('./journey-form')
const api = await import('../api')

const geo = (id: string, name: string) => ({
  source: 'geonames' as const,
  id,
  name,
  nameRu: null,
  nameEn: name,
  countryCode: 'GE',
  region: null,
  lat: 41.7,
  lon: 44.8,
  timezone: null,
  catalogVersion: 'v1',
})
const roadJourney = (patch: Partial<GroundJourneyDto> = {}) =>
  ({
    id: '00000000-0000-4000-8000-0000000000aa',
    mode: 'road',
    status: 'planned',
    version: 2,
    title: null,
    note: null,
    startDate: null,
    endDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    confirmedAt: null,
    countries: [],
    metrics: {},
    points: [
      {
        id: '00000000-0000-4000-8000-0000000000a1',
        place: geo('1', 'Tbilisi'),
        arrivalDate: null,
        departureDate: null,
        nights: null,
        note: null,
      },
      {
        id: '00000000-0000-4000-8000-0000000000a2',
        place: geo('2', 'Kutaisi'),
        arrivalDate: null,
        departureDate: null,
        nights: null,
        note: null,
      },
    ],
    ...patch,
  }) as GroundJourneyDto

beforeEach(() => {
  localStorage.clear()
  push.mockReset()
  vi.mocked(api.sendCommand).mockReset()
  vi.mocked(api.readOperation).mockReset()
  vi.mocked(api.readJourney).mockReset()
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
    expect(screen.getByRole('alert').textContent).toContain('We could not confirm the save')
    // The buttons sit outside the live region.
    expect(screen.getByRole('alert')).not.toContainElement(
      screen.getByRole('button', { name: 'Check result' }),
    )
    expect(screen.getByRole('button', { name: 'Check result' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry original save' })).toBeTruthy()
  })
  it('keeps the form and the draft when a late success arrives after newer edits', async () => {
    const state = blankState('road')
    state.title = 'Edited after the request left'
    const journeyId = newId()
    const pending = {
      action: 'create' as const,
      operationKey: 'key-late-1',
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
    vi.mocked(api.readOperation).mockResolvedValue({
      status: 'saved',
      journeyId,
      action: 'create',
      savedVersion: 3,
      accountRevision: 1,
      derivedState: 'ready',
      current: null,
    })
    render(<JourneyForm ownerId="owner-a" locale="en" mode="road" returnTo="/ground-travel" />)
    await userEvent.click(screen.getByRole('button', { name: 'Check result' }))
    expect(await screen.findByText('Saved. Your later edits are not saved yet.')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe(
      'Edited after the request left',
    )
    await waitFor(() => {
      const stored = readDraft('owner-a', 'new-road', 'road')
      expect(stored.status === 'ok' && [stored.draft.pending, stored.draft.baseVersion]).toEqual([
        null,
        3,
      ])
    })
  })

  it('applies edits on top of a version completed elsewhere by asking for the countries first', async () => {
    const existing = roadJourney()
    const done = roadJourney({ status: 'completed', version: 3, countries: ['GE'] })
    vi.mocked(api.sendCommand).mockRejectedValueOnce(
      new ApiError(409, 'Conflict', 'VERSION_CONFLICT', { current: done }),
    )
    render(
      <JourneyForm
        ownerId="owner-a"
        locale="en"
        mode="road"
        existing={existing}
        returnTo="/ground-travel"
      />,
    )
    await userEvent.type(screen.getByLabelText(/^Title/), 'Edited')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Apply my changes on top' }))
    expect(screen.getByText(/completed elsewhere/)).toBeTruthy()
    const countries = screen.getByRole('group', { name: 'Countries you actually crossed' })
    await userEvent.click(within(countries).getByRole('checkbox', { name: 'None of these' }))
    vi.mocked(api.sendCommand).mockResolvedValueOnce({
      outcome: 'saved',
      journeyId: existing.id,
      action: 'update',
      savedVersion: 4,
      accountRevision: 1,
      derivedState: 'ready',
      replayed: false,
      current: null,
    })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(api.sendCommand).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.sendCommand).mock.calls[1]![0]).toMatchObject({
      action: 'update',
      expectedVersion: 3,
      countries: [],
    })
  })

  it('offers to read the saved version again when the conflict re-read failed', async () => {
    const existing = roadJourney()
    vi.mocked(api.sendCommand).mockRejectedValueOnce(new ApiError(409, 'Conflict'))
    vi.mocked(api.readJourney).mockRejectedValueOnce(new Error('down'))
    render(
      <JourneyForm
        ownerId="owner-a"
        locale="en"
        mode="road"
        existing={existing}
        returnTo="/ground-travel"
      />,
    )
    await userEvent.type(screen.getByLabelText(/^Title/), 'Edited')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('We could not read the saved version.')
    vi.mocked(api.readJourney).mockResolvedValueOnce(roadJourney({ version: 5 }))
    await userEvent.click(screen.getByRole('button', { name: 'Retry reading the saved version' }))
    expect(await screen.findByRole('button', { name: 'Apply my changes on top' })).toBeTruthy()
  })

  it('does not submit the journey form on Enter in the country search', async () => {
    render(<JourneyForm ownerId="owner-a" locale="en" mode="road" returnTo="/ground-travel" />)
    await userEvent.click(screen.getByRole('radio', { name: 'Already happened' }))
    const search = screen.getByLabelText(/^Add another country/)
    expect(fireEvent.keyDown(search, { key: 'Enter' })).toBe(false)
  })
})
