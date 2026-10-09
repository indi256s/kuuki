// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { OnboardingFlow } from './onboarding-flow'
import { getFlight } from '@kuuki/client/flights'
import { getAuthGeneration } from '@kuuki/client/apiClient'
import { fetchPressedCountries } from '../import/import-api'
import type { ImportResult } from '../import/import-client'
const push = vi.fn()
let resultCallback: ((result: ImportResult) => void) | undefined
const flight = {
  id: 44,
  user_id: 'a',
  origin: 'TBS',
  destination: 'IST',
  date: '2026-12-01',
  is_upcoming: true,
  derived_state: 'ready',
}
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('@kuuki/client/apiClient', () => ({ getAuthGeneration: vi.fn(() => 0) }))
vi.mock('@kuuki/client/flights', () => ({ getFlight: vi.fn(async () => flight) }))
vi.mock('../import/import-api', () => ({ fetchPressedCountries: vi.fn(async () => new Set()) }))
vi.mock('../capture/flight-form', () => ({
  FlightForm: ({ onSaved }: { onSaved: (flight: object, status: string) => void }) => (
    <button onClick={() => onSaved(flight, 'ready')}>Save real form</button>
  ),
}))
vi.mock('../import/import-client', () => ({
  ImportClient: ({
    initialBatchId,
    initialSource,
    onBatchId,
    onResult,
  }: {
    initialBatchId?: string
    initialSource: string
    onBatchId: (id: string) => void
    onResult: typeof resultCallback
  }) => {
    resultCallback = onResult
    return (
      <>
        <p>
          Resume {initialBatchId} {initialSource}
        </p>
        <button onClick={() => onBatchId('11111111-1111-1111-1111-111111111111')}>
          Accept durable batch
        </button>
      </>
    )
  },
}))
const props = {
  ownerId: 'a',
  locale: 'en' as const,
  step: 'capture' as const,
  batchId: null,
  source: null,
}
beforeEach(() => {
  push.mockReset()
  vi.mocked(getAuthGeneration).mockReturnValue(0)
  vi.mocked(getFlight)
    .mockReset()
    .mockResolvedValue(flight as unknown as Awaited<ReturnType<typeof getFlight>>)
  vi.mocked(fetchPressedCountries).mockReset().mockResolvedValue(new Set())
  window.history.replaceState(null, '', '/onboarding?step=capture&extra=keep')
})
it('offers upload, paste and manual equally, with an ordinary Overview skip', () => {
  render(<OnboardingFlow {...props} />)
  for (const name of [
    'Upload boarding passes or PDFs',
    'Paste text from an email',
    'Enter manually',
  ])
    expect(screen.getByRole('button', { name })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Do this later' })).toHaveAttribute('href', '/overview')
})
it('keeps a durable batch in the onboarding URL and resumes it on a fresh mount', () => {
  const view = render(<OnboardingFlow {...props} source="text" />)
  fireEvent.click(screen.getByRole('button', { name: 'Accept durable batch' }))
  expect(window.location.pathname).toBe('/onboarding')
  expect(window.location.search).toContain('batch=11111111-1111-1111-1111-111111111111')
  expect(window.location.search).toContain('extra=keep')
  view.unmount()
  render(<OnboardingFlow {...props} source="text" batchId="11111111-1111-1111-1111-111111111111" />)
  expect(screen.getByText('Resume 11111111-1111-1111-1111-111111111111 text')).toBeVisible()
})
it('renders a canonical future-only save as a booked Ticket without country stamps', async () => {
  const view = render(<OnboardingFlow {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Enter manually' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Save real form' }))
  view.rerender(<OnboardingFlow {...props} step="reveal" />)
  expect(await screen.findByRole('heading', { name: 'Your flight is booked' })).toBeVisible()
  expect(screen.getByRole('article', { name: 'TBS to IST' })).toHaveTextContent('Upcoming')
  expect(document.querySelectorAll('.stamp')).toHaveLength(0)
})
it('presses only a fresh published import delta, capped at eight, and never replays after remount', async () => {
  const view = render(<OnboardingFlow {...props} source="file" />)
  const codes = ['JP', 'FR', 'DE', 'GE', 'TR', 'US', 'GB', 'IT', 'ES']
  await act(async () =>
    resultCallback?.({
      eventId: 'onboarding:a:import:fresh',
      flightIds: [],
      savedCount: 9,
      publication: 'pending',
      newCodes: codes,
    }),
  )
  view.rerender(<OnboardingFlow {...props} source="file" step="reveal" />)
  expect(document.querySelectorAll('.stamp')).toHaveLength(0)
  await act(async () =>
    resultCallback?.({
      eventId: 'onboarding:a:import:fresh',
      flightIds: [],
      savedCount: 9,
      publication: 'ready',
      newCodes: codes,
    }),
  )
  await waitFor(() => expect(document.querySelectorAll('.stamp[data-press=play]')).toHaveLength(8))
  expect(
    [...document.querySelectorAll<HTMLElement>('.onboarding-stamps > div')].map((node) =>
      node.style.getPropertyValue('--onboarding-stamp-delay'),
    ),
  ).toEqual(Array.from({ length: 8 }, (_, index) => `${index * 80}ms`))
  view.unmount()
  render(<OnboardingFlow {...props} source="file" step="reveal" />)
  expect(screen.getByText('Your saved flights are in your journal.')).toBeVisible()
  expect(document.querySelectorAll('.stamp')).toHaveLength(0)
  await act(async () =>
    resultCallback?.({
      eventId: 'onboarding:a:import:fresh',
      flightIds: [],
      savedCount: 9,
      publication: 'ready',
      newCodes: codes,
    }),
  )
  await waitFor(() => expect(document.querySelectorAll('.stamp[data-press=idle]')).toHaveLength(8))
})
it('uses honest saved-flight copy when a published save adds no countries', async () => {
  const view = render(<OnboardingFlow {...props} source="file" />)
  await act(async () =>
    resultCallback?.({
      eventId: 'onboarding:a:import:zero',
      flightIds: [],
      savedCount: 1,
      publication: 'ready',
      newCodes: [],
    }),
  )
  view.rerender(<OnboardingFlow {...props} source="file" step="reveal" />)
  expect(screen.getByText('No new country stamps this time. Your flight is saved.')).toBeVisible()
})
it('uses authenticated canonical import fields even when the shared own-flight adapter has no user_id', async () => {
  const { getFlight } = await import('@kuuki/client/flights')
  vi.mocked(getFlight).mockResolvedValueOnce({ ...flight, user_id: '' } as unknown as Awaited<
    ReturnType<typeof getFlight>
  >)
  const view = render(<OnboardingFlow {...props} source="file" />)
  await act(async () =>
    resultCallback?.({
      eventId: 'onboarding:a:import:future',
      flightIds: [44],
      savedCount: 1,
      publication: 'ready',
      newCodes: ['JP'],
    }),
  )
  view.rerender(<OnboardingFlow {...props} source="file" step="reveal" />)
  expect(await screen.findByRole('heading', { name: 'Your flight is booked' })).toBeVisible()
  expect(screen.getByRole('article', { name: 'TBS to IST' })).toHaveTextContent('Upcoming')
  expect(document.querySelectorAll('.stamp')).toHaveLength(0)
})

it('retains fulfilled canonical Tickets, retries only failed IDs, and waits for complete evidence before a booked heading', async () => {
  vi.mocked(getFlight)
    .mockResolvedValueOnce(flight as unknown as Awaited<ReturnType<typeof getFlight>>)
    .mockRejectedValueOnce(new Error('503'))
  render(<OnboardingFlow {...props} source="file" step="reveal" />)
  await act(async () =>
    resultCallback?.({
      eventId: 'partial',
      flightIds: [44, 45],
      savedCount: 2,
      publication: 'ready',
      newCodes: [],
    }),
  )
  expect(await screen.findByRole('article', { name: 'TBS to IST' })).toBeVisible()
  expect(
    screen.getByText('Some flight details could not be loaded. Your flights are saved.'),
  ).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Your journal is open' })).toBeVisible()
  vi.mocked(getFlight).mockResolvedValueOnce({
    ...flight,
    id: 45,
    destination: 'NRT',
  } as unknown as Awaited<ReturnType<typeof getFlight>>)
  fireEvent.click(screen.getByRole('button', { name: 'Retry flight details' }))
  expect(await screen.findByRole('article', { name: 'TBS to NRT' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Your flight is booked' })).toBeVisible()
  expect(vi.mocked(getFlight).mock.calls.map(([id]) => id)).toEqual([44, 45, 45])
})
it('distinguishes pending canonical reads from an honest receipt-free refresh, and treats null as retryable', async () => {
  let finish!: (value: Awaited<ReturnType<typeof getFlight>>) => void
  vi.mocked(getFlight)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValueOnce(null)
  const view = render(<OnboardingFlow {...props} source="file" step="reveal" />)
  expect(screen.queryByText('Loading saved flight details…')).not.toBeInTheDocument()
  await act(async () =>
    resultCallback?.({
      eventId: 'pending',
      flightIds: [44, 45],
      savedCount: 2,
      publication: 'ready',
      newCodes: [],
    }),
  )
  expect(screen.getByText('Loading saved flight details…')).toBeVisible()
  await act(async () => finish(flight as unknown as Awaited<ReturnType<typeof getFlight>>))
  expect(screen.getByRole('heading', { name: 'Your journal is open' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Retry flight details' })).toBeVisible()
  view.unmount()
})
it('discards a late retry after authentication changes', async () => {
  vi.mocked(getFlight).mockRejectedValueOnce(new Error('503'))
  const view = render(<OnboardingFlow {...props} source="file" step="reveal" />)
  await act(async () =>
    resultCallback?.({
      eventId: 'old-account',
      flightIds: [44],
      savedCount: 1,
      publication: 'ready',
      newCodes: [],
    }),
  )
  let finish!: (value: Awaited<ReturnType<typeof getFlight>>) => void
  vi.mocked(getFlight).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Retry flight details' }))
  await waitFor(() => expect(getFlight).toHaveBeenCalledTimes(2))
  vi.mocked(getAuthGeneration).mockReturnValue(1)
  await act(async () => finish(flight as unknown as Awaited<ReturnType<typeof getFlight>>))
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  view.unmount()
})

it('uses complete mixed canonical DTOs directly without inventing an all-upcoming receipt', async () => {
  render(<OnboardingFlow {...props} source="text" step="reveal" />)
  const flights = [
    flight,
    { ...flight, id: 45, destination: 'NRT', is_upcoming: false },
  ] as unknown as NonNullable<ImportResult['flights']>
  await act(async () =>
    resultCallback?.({
      eventId: 'canonical-mixed',
      flightIds: [44, 45],
      flights,
      savedCount: 2,
      publication: 'ready',
      newCodes: [],
    }),
  )
  expect(screen.getByRole('heading', { name: 'Your journal is open' })).toBeVisible()
  expect(screen.getAllByRole('article')).toHaveLength(2)
  expect(getFlight).not.toHaveBeenCalled()
})
it('keeps late previous-batch reads out of the new account receipt', async () => {
  let finish!: (value: Awaited<ReturnType<typeof getFlight>>) => void
  vi.mocked(getFlight).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const view = render(<OnboardingFlow {...props} source="file" step="reveal" />)
  await act(async () =>
    resultCallback?.({
      eventId: 'old-batch',
      flightIds: [44],
      savedCount: 1,
      publication: 'ready',
      newCodes: [],
    }),
  )
  view.rerender(<OnboardingFlow {...props} ownerId="b" source="file" step="reveal" />)
  expect(screen.getByText('Your saved flights are in your journal.')).toBeVisible()
  const flights = [
    { ...flight, id: 45, user_id: 'b', destination: 'NRT', is_upcoming: false },
  ] as unknown as NonNullable<ImportResult['flights']>
  await act(async () =>
    resultCallback?.({
      eventId: 'new-batch',
      flightIds: [45],
      flights,
      savedCount: 1,
      publication: 'ready',
      newCodes: [],
    }),
  )
  await act(async () => finish(flight as unknown as Awaited<ReturnType<typeof getFlight>>))
  expect(screen.queryByRole('article', { name: 'TBS to IST' })).not.toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'TBS to NRT' })).toBeVisible()
})
it('preserves fulfilled Tickets when a same-batch partial save adds IDs, and retries only the new failed ID', async () => {
  vi.mocked(getFlight).mockImplementation(async (id) => {
    if (id === 44) return flight as unknown as Awaited<ReturnType<typeof getFlight>>
    throw new Error('new detail unavailable')
  })
  render(<OnboardingFlow {...props} source="file" step="reveal" />)
  await act(async () =>
    resultCallback?.({
      eventId: 'import:a:batch1',
      flightIds: [44],
      savedCount: 1,
      publication: 'ready',
      newCodes: [],
    }),
  )
  expect(await screen.findByRole('article', { name: 'TBS to IST' })).toBeVisible()
  await act(async () =>
    resultCallback?.({
      eventId: 'import:a:batch1',
      flightIds: [44, 45],
      savedCount: 2,
      publication: 'ready',
      newCodes: [],
    }),
  )
  expect(await screen.findByRole('button', { name: 'Retry flight details' })).toBeVisible()
  expect(screen.getByRole('article', { name: 'TBS to IST' })).toBeVisible()
  expect(vi.mocked(getFlight).mock.calls.map(([id]) => id)).toEqual([44, 45])
  vi.mocked(getFlight).mockResolvedValueOnce({
    ...flight,
    id: 45,
    destination: 'NRT',
  } as unknown as Awaited<ReturnType<typeof getFlight>>)
  fireEvent.click(screen.getByRole('button', { name: 'Retry flight details' }))
  expect(await screen.findByRole('article', { name: 'TBS to NRT' })).toBeVisible()
  expect(screen.getByRole('article', { name: 'TBS to IST' })).toBeVisible()
  expect(vi.mocked(getFlight).mock.calls.map(([id]) => id)).toEqual([44, 45, 45])
})
it('restarts unresolved reads on same-event expansion and ignores the aborted response', async () => {
  let finish!: (value: Awaited<ReturnType<typeof getFlight>>) => void
  vi.mocked(getFlight).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const view = render(<OnboardingFlow {...props} source="file" step="reveal" />)
  await act(async () =>
    resultCallback?.({
      eventId: 'pending-expansion',
      flightIds: [44],
      savedCount: 1,
      publication: 'ready',
      newCodes: [],
    }),
  )
  vi.mocked(getFlight).mockImplementation(
    async (id) =>
      ({ ...flight, id, destination: id === 45 ? 'NRT' : 'IST' }) as unknown as Awaited<
        ReturnType<typeof getFlight>
      >,
  )
  await act(async () =>
    resultCallback?.({
      eventId: 'pending-expansion',
      flightIds: [44, 45],
      savedCount: 2,
      publication: 'ready',
      newCodes: [],
    }),
  )
  expect(await screen.findByRole('article', { name: 'TBS to NRT' })).toBeVisible()
  await act(async () =>
    finish({ ...flight, destination: 'JFK' } as unknown as Awaited<ReturnType<typeof getFlight>>),
  )
  expect(screen.queryByRole('article', { name: 'TBS to JFK' })).not.toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'TBS to IST' })).toBeVisible()
  view.unmount()
})
it('does not reuse fulfilled rows for a different batch event in the same account', async () => {
  render(<OnboardingFlow {...props} source="file" step="reveal" />)
  await act(async () =>
    resultCallback?.({
      eventId: 'import:a:batch-old',
      flightIds: [44],
      savedCount: 1,
      publication: 'ready',
      newCodes: [],
    }),
  )
  expect(await screen.findByRole('article', { name: 'TBS to IST' })).toBeVisible()
  vi.mocked(getFlight).mockRejectedValueOnce(new Error('other event unavailable'))
  await act(async () =>
    resultCallback?.({
      eventId: 'import:a:batch-new',
      flightIds: [45],
      savedCount: 1,
      publication: 'ready',
      newCodes: [],
    }),
  )
  expect(await screen.findByRole('button', { name: 'Retry flight details' })).toBeVisible()
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
})
