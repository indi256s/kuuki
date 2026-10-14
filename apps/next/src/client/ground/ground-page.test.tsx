// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@kuuki/client/apiClient'
import type { GroundMutationResult } from '@kuuki/shared/groundTravel'
import * as api from './api'
import { announceShellNotice } from '../shell-notices'
import { GroundTravelPage } from './ground-page'
import { baku, listOf, rail, road, tbilisi, uuid } from './test-fixtures'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/ground-travel',
}))
vi.mock('next/link', async () => ({
  default: (await import('../../test/next-link')).linkStandIn(() => {}),
}))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../ui/use-mobile', () => ({ useMobile: () => false }))
vi.mock('../shell-notices', () => ({ announceShellNotice: vi.fn() }))
vi.mock('./api', () => ({
  listJourneys: vi.fn(),
  readJourney: vi.fn(),
  sendCommand: vi.fn(),
  readOperation: vi.fn(),
  exportJourneysUrl: '/api/ground-journeys/export',
}))

// Dates far from any real "today", so the groups never depend on when the suite runs.
const upcoming = rail({ id: 1, status: 'planned', startDate: '2999-01-01' })
const pastPlan = road({ id: 2, status: 'planned', startDate: '2000-01-01' })
const undatedPlan = rail({ id: 3, status: 'planned', startDate: null })
const recent = rail({ id: 4, status: 'completed', startDate: '2025-05-01' })
const older = road({ id: 5, status: 'completed', startDate: '2024-05-01' })
const undatedDone = rail({
  id: 6,
  status: 'completed',
  startDate: null,
  metrics: { distanceKm: null, distanceCoverage: { known: 0, total: 1 } },
})
const all = [older, undatedDone, upcoming, recent, undatedPlan, pastPlan]

const user = () => userEvent.setup()
// The page mirrors the URL, so the address must carry the query the server would have rendered from.
const mount = (query = '') => {
  window.history.replaceState(null, '', query ? `/ground-travel?${query}` : '/ground-travel')
  return render(<GroundTravelPage ownerId="owner" locale="en" initialQuery={query} />)
}
const cards = () =>
  [...document.querySelectorAll('[data-journey-card]')].map((node) =>
    node.getAttribute('data-journey-card'),
  )

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/ground-travel')
  vi.mocked(api.listJourneys).mockResolvedValue(listOf(all))
})

describe('list', () => {
  it('shows plans (upcoming, past-dated, undated) then history, newest first, undated last', async () => {
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Plans' })
    expect(screen.getByRole('heading', { level: 2, name: 'History' })).toBeInTheDocument()
    expect(cards()).toEqual([
      upcoming.id,
      pastPlan.id,
      undatedPlan.id,
      recent.id,
      older.id,
      undatedDone.id,
    ])
  })

  it('writes unknown values as words, never zero, and distances with ≈', async () => {
    mount()
    await screen.findByRole('heading', { level: 2, name: 'History' })
    const done = document.querySelector(`[data-journey-card="${undatedDone.id}"]`) as HTMLElement
    expect(within(done).getByText(/Date unknown/)).toBeInTheDocument()
    expect(within(done).getByText(/Distance unknown/)).toBeInTheDocument()
    expect(done).not.toHaveTextContent(/\b0 km\b/)
    const dated = document.querySelector(`[data-journey-card="${recent.id}"]`) as HTMLElement
    expect(within(dated).getByText(/≈ 321 km/)).toBeInTheDocument()
    expect(within(dated).getByText(/Rail/)).toBeInTheDocument()
  })

  it('flags a past-dated plan without changing its status', async () => {
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Plans' })
    const card = document.querySelector(`[data-journey-card="${pastPlan.id}"]`) as HTMLElement
    expect(card).toHaveAttribute('data-status', 'planned')
    expect(card).toHaveTextContent('Date passed')
  })

  it('filters by transport locally and mirrors it in the URL without adding history', async () => {
    const u = user()
    const entries = window.history.length
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Plans' })
    await u.click(screen.getByRole('radio', { name: 'Road' }))
    expect(cards()).toEqual([pastPlan.id, older.id])
    expect(window.location.search).toBe('?mode=road')
    expect(window.history.length).toBe(entries)
    expect(api.listJourneys).toHaveBeenCalledTimes(1)
  })

  it('opens the cancelled list as a separate read and hides the totals', async () => {
    const u = user()
    const cancelled = rail({ id: 9, status: 'cancelled', startDate: '2026-01-01' })
    vi.mocked(api.listJourneys).mockImplementation(async (query) =>
      query.cancelled ? listOf([cancelled]) : listOf(all),
    )
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Totals of completed journeys' })
    await u.click(screen.getByRole('button', { name: 'Cancelled' }))
    await screen.findByRole('heading', { level: 2, name: 'Cancelled' })
    expect(cards()).toEqual([cancelled.id])
    expect(screen.queryByRole('heading', { name: 'Totals of completed journeys' })).toBeNull()
    expect(api.listJourneys).toHaveBeenLastCalledWith(
      expect.objectContaining({ cancelled: true }),
      expect.anything(),
    )
  })
})

describe('states', () => {
  it('confirmed empty offers the Add chooser, with no totals', async () => {
    vi.mocked(api.listJourneys).mockResolvedValue(listOf([]))
    mount()
    await screen.findByText('No ground journeys yet')
    expect(screen.queryByRole('heading', { name: 'Totals of completed journeys' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /Add journey/ }).length).toBeGreaterThan(0)
  })

  it('filtered empty names the filter and Show all clears it', async () => {
    const u = user()
    vi.mocked(api.listJourneys).mockResolvedValue(listOf([upcoming, recent]))
    mount('mode=road')
    await screen.findByText('No road trips yet')
    await u.click(screen.getByRole('button', { name: 'Show all' }))
    expect(cards()).toEqual([upcoming.id, recent.id])
    expect(window.location.search).toBe('')
  })

  it('a read error is an alert with Retry, never an empty state', async () => {
    const u = user()
    vi.mocked(api.listJourneys).mockRejectedValueOnce(new ApiError(500, 'boom'))
    mount()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load ground travel')
    expect(screen.queryByText('No ground journeys yet')).toBeNull()
    await u.click(within(alert).getByRole('button', { name: 'Try again' }))
    await screen.findByRole('heading', { level: 2, name: 'Plans' })
  })

  it('keeps the rows and shows the failure when a refresh fails', async () => {
    const u = user()
    vi.mocked(api.readJourney).mockResolvedValue(upcoming)
    vi.mocked(api.sendCommand).mockResolvedValue({
      outcome: 'saved',
      journeyId: upcoming.id,
      action: 'cancel',
      savedVersion: 2,
      accountRevision: 3,
      derivedState: 'ready',
      replayed: false,
      current: { ...upcoming, status: 'cancelled', version: 2 },
    })
    mount(`journey=${upcoming.id}`)
    const dialog = await screen.findByRole('dialog')
    vi.mocked(api.listJourneys).mockRejectedValue(new ApiError(500, 'boom'))
    await u.click(within(dialog).getByRole('button', { name: 'Cancel plan' }))
    await u.keyboard('{Escape}')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not refresh the list')
    expect(cards()).toHaveLength(6)
  })

  it('keeps the filters reachable when the cancelled list fails to load', async () => {
    const u = user()
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Plans' })
    vi.mocked(api.listJourneys).mockRejectedValue(new ApiError(500, 'boom'))
    await u.click(screen.getByRole('button', { name: 'Cancelled' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ground travel')
    await u.click(screen.getByRole('button', { name: 'Cancelled' }))
    expect(cards()).toHaveLength(6)
  })

  it('says totals are still updating when publication is pending', async () => {
    vi.mocked(api.listJourneys).mockResolvedValue(listOf(all, { derivedState: 'pending' }))
    mount()
    await screen.findByText('Saved. Totals are still updating.')
  })
})

describe('detail sheet', () => {
  const savedResult = (
    over: Partial<GroundMutationResult> = {},
    status: 'planned' | 'cancelled' = 'cancelled',
  ): GroundMutationResult => ({
    outcome: 'saved',
    journeyId: upcoming.id,
    action: 'cancel',
    savedVersion: 2,
    accountRevision: 3,
    derivedState: 'ready',
    replayed: false,
    current: { ...upcoming, status, version: 2 },
    ...over,
  })

  async function openPlan() {
    vi.mocked(api.readJourney).mockResolvedValue(upcoming)
    mount(`journey=${upcoming.id}`)
    return screen.findByRole('dialog')
  }

  it('opens from ?journey= with the sketch label and the form links', async () => {
    const dialog = await openPlan()
    // The drawing is hidden from assistive technology; its caption names it.
    expect(within(dialog).getByText('Route sketch (straight lines)')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      expect.stringContaining(`/ground-travel/${upcoming.id}/edit?return=`),
    )
    expect(within(dialog).getByRole('link', { name: 'Complete' })).toHaveAttribute(
      'href',
      expect.stringContaining('complete=1'),
    )
  })

  it('draws separate rail legs without inventing a connection between them', async () => {
    const journey = rail({ id: 1, status: 'planned' })
    if (journey.mode !== 'rail') throw new Error('Expected rail fixture')
    journey.legs.push({ ...journey.legs[0], id: uuid(9000), from: baku, to: tbilisi })
    vi.mocked(api.readJourney).mockResolvedValue(journey)
    mount(`journey=${journey.id}`)
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog.querySelectorAll('.gt-step')).toHaveLength(2))
    expect(dialog.querySelectorAll('.gt-sketch-svg polyline')).toHaveLength(2)
    expect(dialog.querySelectorAll('.gt-sketch-svg g')).toHaveLength(3)
  })

  it('cancels a plan with a fresh key and the loaded version, then says totals are updating', async () => {
    const u = user()
    vi.mocked(api.sendCommand).mockResolvedValue(savedResult({ derivedState: 'pending' }))
    const dialog = await openPlan()
    await u.click(within(dialog).getByRole('button', { name: 'Cancel plan' }))
    expect(api.sendCommand).toHaveBeenCalledWith(
      {
        action: 'cancel',
        operationKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
        journeyId: upcoming.id,
        expectedVersion: 1,
      },
      expect.anything(),
    )
    await within(dialog).findByText('Plan cancelled.')
    expect(within(dialog).getByText('Saved. Totals are still updating.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Restore plan' })).toBeInTheDocument()
  })

  it('409: says it changed elsewhere and reloads the journey and the list', async () => {
    const u = user()
    vi.mocked(api.sendCommand).mockRejectedValue(new ApiError(409, 'conflict', 'VERSION_CONFLICT'))
    const dialog = await openPlan()
    const reads = vi.mocked(api.readJourney).mock.calls.length
    const lists = vi.mocked(api.listJourneys).mock.calls.length
    await u.click(within(dialog).getByRole('button', { name: 'Cancel plan' }))
    await within(dialog).findByText('This journey changed elsewhere')
    await waitFor(() => expect(vi.mocked(api.readJourney).mock.calls.length).toBeGreaterThan(reads))
    await waitFor(() =>
      expect(vi.mocked(api.listJourneys).mock.calls.length).toBeGreaterThan(lists),
    )
  })

  it('keeps a confirmed change when an older detail read arrives afterwards', async () => {
    let answer!: (value: typeof upcoming) => void
    vi.mocked(api.readJourney).mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    )
    vi.mocked(api.sendCommand).mockResolvedValue(savedResult())
    mount(`journey=${upcoming.id}`)
    const dialog = await screen.findByRole('dialog')
    await user().click(await within(dialog).findByRole('button', { name: 'Cancel plan' }))
    await within(dialog).findByRole('button', { name: 'Restore plan' })
    await act(async () => answer(upcoming))
    expect(within(dialog).getByRole('button', { name: 'Restore plan' })).toBeInTheDocument()
  })

  it('lost response: keeps the key, retry reuses it, and Check result resolves it', async () => {
    const u = user()
    vi.mocked(api.sendCommand).mockRejectedValue(new TypeError('Failed to fetch'))
    const dialog = await openPlan()
    await u.click(within(dialog).getByRole('button', { name: 'Cancel plan' }))
    await within(dialog).findByText('We could not confirm that change')
    const first = vi.mocked(api.sendCommand).mock.calls[0][0]
    // No second, different command can be started while this one is unresolved.
    expect(within(dialog).getByRole('button', { name: 'Cancel plan' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    await u.click(within(dialog).getByRole('button', { name: 'Try the same change again' }))
    expect(vi.mocked(api.sendCommand).mock.calls[1][0]).toEqual(first)

    await within(dialog).findByText('We could not confirm that change')
    vi.mocked(api.readOperation).mockResolvedValue({
      status: 'saved',
      journeyId: upcoming.id,
      action: 'cancel',
      savedVersion: 2,
      accountRevision: 3,
      derivedState: 'ready',
      current: { ...upcoming, status: 'cancelled', version: 2 },
    })
    await u.click(within(dialog).getByRole('button', { name: 'Check result' }))
    expect(api.readOperation).toHaveBeenCalledWith(first.operationKey, expect.anything())
    await within(dialog).findByText('Plan cancelled.')
    expect(within(dialog).queryByText('We could not confirm that change')).toBeNull()
  })

  it('Check result with no receipt says nothing happened and keeps the retry', async () => {
    const u = user()
    vi.mocked(api.sendCommand).mockRejectedValue(new TypeError('Failed to fetch'))
    const dialog = await openPlan()
    await u.click(within(dialog).getByRole('button', { name: 'Cancel plan' }))
    await within(dialog).findByText('We could not confirm that change')
    const key = vi.mocked(api.sendCommand).mock.calls[0][0].operationKey
    vi.mocked(api.readOperation).mockResolvedValue({ status: 'unknown', operationKey: key })
    await u.click(within(dialog).getByRole('button', { name: 'Check result' }))
    await within(dialog).findByText('That change was not recorded. Nothing happened.')
    expect(
      within(dialog).getByRole('button', { name: 'Try the same change again' }),
    ).toBeInTheDocument()
  })

  it('keeps an unresolved change on its own journey and leaves other journeys free', async () => {
    const u = user()
    vi.mocked(api.sendCommand).mockRejectedValue(new TypeError('Failed to fetch'))
    vi.mocked(api.readJourney).mockImplementation(async (id) =>
      id === upcoming.id ? upcoming : undatedPlan,
    )
    mount(`journey=${upcoming.id}`)
    let dialog = await screen.findByRole('dialog')
    await u.click(within(dialog).getByRole('button', { name: 'Cancel plan' }))
    await within(dialog).findByText('We could not confirm that change')
    await u.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await u.click(
      document.querySelector(`[data-journey-card="${undatedPlan.id}"] a`) as HTMLElement,
    )
    dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText('We could not confirm that change')).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Cancel plan' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await u.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await u.click(document.querySelector(`[data-journey-card="${upcoming.id}"] a`) as HTMLElement)
    dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('We could not confirm that change')
    await u.click(within(dialog).getByRole('button', { name: 'Dismiss' }))
    expect(within(dialog).queryByText('We could not confirm that change')).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Cancel plan' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('toggling Cancelled before its list is cached keeps the toolbar and shows a list skeleton', async () => {
    const u = user()
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Plans' })
    let answer!: (value: ReturnType<typeof listOf>) => void
    vi.mocked(api.listJourneys).mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    )
    const toggle = screen.getByRole('button', { name: 'Cancelled' })
    await u.click(toggle)
    expect(screen.getByRole('button', { name: 'Cancelled' })).toBe(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Loading ground travel…', { selector: '.sr-only' })).toBeInTheDocument()
    answer(listOf([]))
    await waitFor(() =>
      expect(screen.queryByText('Loading ground travel…', { selector: '.sr-only' })).toBeNull(),
    )
  })

  it('Back to plans states what is removed and sends reopen only after confirming', async () => {
    const u = user()
    vi.mocked(api.readJourney).mockResolvedValue(recent)
    vi.mocked(api.sendCommand).mockResolvedValue(
      savedResult({
        journeyId: recent.id,
        action: 'reopen',
        current: { ...recent, status: 'planned', version: 2 },
      }),
    )
    mount(`journey=${recent.id}`)
    const dialog = await screen.findByRole('dialog')
    await u.click(within(dialog).getByRole('button', { name: 'Back to plans' }))
    const confirm = await screen.findByRole('dialog', { name: 'Move this journey back to plans?' })
    expect(confirm).toHaveTextContent('stamps and totals are removed')
    expect(api.sendCommand).not.toHaveBeenCalled()
    await u.click(within(confirm).getByRole('button', { name: 'Back to plans' }))
    await waitFor(() =>
      expect(api.sendCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reopen', expectedVersion: 1 }),
        expect.anything(),
      ),
    )
  })

  it('Delete confirms, sends delete and closes the sheet', async () => {
    const u = user()
    vi.mocked(api.readJourney).mockResolvedValue(upcoming)
    vi.mocked(api.sendCommand).mockResolvedValue(
      savedResult({ outcome: 'deleted', action: 'delete', current: null }),
    )
    mount(`journey=${upcoming.id}`)
    const dialog = await screen.findByRole('dialog')
    await u.click(within(dialog).getByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this journey?' })
    await u.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(announceShellNotice).toHaveBeenCalledWith('owner', {
        kind: 'success',
        message: 'Journey deleted.',
      }),
    )
    expect(window.location.search).toBe('')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('shows the owner-masked 404 as a calm message, with the list intact', async () => {
    vi.mocked(api.readJourney).mockRejectedValue(new ApiError(404, 'nope', 'NOT_FOUND'))
    mount(`journey=${uuid(99)}`)
    const dialog = await screen.findByRole('dialog')
    // The dialog mounts before the detail read rejects and before the list answers: wait for both outcomes.
    expect(await within(dialog).findByText('This journey is not in your list.')).toBeInTheDocument()
    await waitFor(() => expect(cards().length).toBe(6))
  })

  it('a failed detail read keeps the list copy and offers Retry', async () => {
    const u = user()
    vi.mocked(api.readJourney).mockRejectedValueOnce(new ApiError(500, 'x'))
    mount(`journey=${upcoming.id}`)
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Could not load the details')
    vi.mocked(api.readJourney).mockResolvedValue(upcoming)
    await u.click(within(dialog).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(within(dialog).queryByText('Could not load the details')).toBeNull())
  })

  it('disables writes offline and says why', async () => {
    const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    const dialog = await openPlan()
    expect(
      within(dialog).getAllByText('Offline. Connect to change journeys.').length,
    ).toBeGreaterThan(0)
    expect(within(dialog).getByRole('button', { name: 'Cancel plan' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    online.mockRestore()
  })
})

describe('history', () => {
  it('opening a journey pushes one entry and closing steps back over it', async () => {
    const u = user()
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Plans' })
    vi.mocked(api.readJourney).mockResolvedValue(recent)
    const before = window.history.length
    await u.click(document.querySelector<HTMLElement>(`[data-journey-card="${recent.id}"] a`)!)
    await screen.findByRole('dialog')
    expect(window.location.search).toBe(`?journey=${recent.id}`)
    expect(window.history.length).toBe(before + 1)

    await u.keyboard('{Escape}')
    await waitFor(() => expect(window.location.search).toBe(''))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closing a deep link replaces the URL with the list instead of leaving the page', async () => {
    const u = user()
    vi.mocked(api.readJourney).mockResolvedValue(recent)
    mount(`mode=rail&journey=${recent.id}`)
    await screen.findByRole('dialog')
    const before = window.history.length
    await u.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.location.pathname + window.location.search).toBe('/ground-travel?mode=rail')
    expect(window.history.length).toBe(before)
  })

  it('returns focus to the card that opened the sheet', async () => {
    const u = user()
    vi.mocked(api.readJourney).mockResolvedValue(recent)
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Plans' })
    const link = document.querySelector<HTMLElement>(`[data-journey-card="${recent.id}"] a`)!
    await u.click(link)
    await screen.findByRole('dialog')
    await u.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(link).toHaveFocus())
  })
})
