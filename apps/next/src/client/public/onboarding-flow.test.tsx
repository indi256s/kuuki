// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { OnboardingFlow } from './onboarding-flow'
import { fetchPressedCountries } from '../import/import-api'
import type { ImportResult } from '../import/import-client'
const push = vi.fn()
let resultCallback: ((result: ImportResult) => void) | undefined
const flight = { id: 44, user_id: 'a', origin: 'TBS', destination: 'IST', date: '2026-12-01', is_upcoming: true, derived_state: 'ready' }
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../../../../web/src/lib/apiClient', () => ({ getAuthGeneration: () => 0 }))
vi.mock('../../../../web/src/lib/flights', () => ({ getFlight: vi.fn(async () => flight) }))
vi.mock('../import/import-api', () => ({ fetchPressedCountries: vi.fn(async () => new Set()) }))
vi.mock('../capture/flight-form', () => ({ FlightForm: ({ onSaved }: { onSaved: (flight: object, status: string) => void }) => <button onClick={() => onSaved(flight, 'ready')}>Save real form</button> }))
vi.mock('../import/import-client', () => ({ ImportClient: ({ initialBatchId, initialSource, onBatchId, onResult }: { initialBatchId?: string; initialSource: string; onBatchId: (id: string) => void; onResult: typeof resultCallback }) => { resultCallback = onResult; return <><p>Resume {initialBatchId} {initialSource}</p><button onClick={() => onBatchId('11111111-1111-1111-1111-111111111111')}>Accept durable batch</button></> } }))
const props = { ownerId: 'a', locale: 'en' as const, step: 'capture' as const, batchId: null, source: null }
beforeEach(() => { push.mockReset(); vi.mocked(fetchPressedCountries).mockReset().mockResolvedValue(new Set()); window.history.replaceState(null, '', '/onboarding?step=capture&extra=keep') })
it('offers upload, paste and manual equally, with an ordinary Overview skip', () => {
  render(<OnboardingFlow {...props} />)
  for (const name of ['Upload boarding passes or PDFs', 'Paste text from an email', 'Enter manually']) expect(screen.getByRole('button', { name })).toBeVisible()
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
  await act(async () => resultCallback?.({ eventId: 'onboarding:a:import:fresh', flightIds: [], savedCount: 9, publication: 'pending', newCodes: codes }))
  view.rerender(<OnboardingFlow {...props} source="file" step="reveal" />)
  expect(document.querySelectorAll('.stamp')).toHaveLength(0)
  await act(async () => resultCallback?.({ eventId: 'onboarding:a:import:fresh', flightIds: [], savedCount: 9, publication: 'ready', newCodes: codes }))
  await waitFor(() => expect(document.querySelectorAll('.stamp[data-press=play]')).toHaveLength(8))
  view.unmount()
  render(<OnboardingFlow {...props} source="file" step="reveal" />)
  expect(screen.getByText('Your saved flights are in your journal.')).toBeVisible()
  expect(document.querySelectorAll('.stamp')).toHaveLength(0)
  await act(async () => resultCallback?.({ eventId: 'onboarding:a:import:fresh', flightIds: [], savedCount: 9, publication: 'ready', newCodes: codes }))
  await waitFor(() => expect(document.querySelectorAll('.stamp[data-press=idle]')).toHaveLength(8))
})
it('uses honest saved-flight copy when a published save adds no countries', async () => {
  const view = render(<OnboardingFlow {...props} source="file" />)
  await act(async () => resultCallback?.({ eventId: 'onboarding:a:import:zero', flightIds: [], savedCount: 1, publication: 'ready', newCodes: [] }))
  view.rerender(<OnboardingFlow {...props} source="file" step="reveal" />)
  expect(screen.getByText('No new country stamps this time. Your flight is saved.')).toBeVisible()
})
it('uses authenticated canonical import fields even when the shared own-flight adapter has no user_id', async () => {
  const { getFlight } = await import('../../../../web/src/lib/flights')
  vi.mocked(getFlight).mockResolvedValueOnce({ ...flight, user_id: '' } as unknown as Awaited<ReturnType<typeof getFlight>>)
  const view = render(<OnboardingFlow {...props} source="file" />)
  await act(async () => resultCallback?.({ eventId: 'onboarding:a:import:future', flightIds: [44], savedCount: 1, publication: 'ready', newCodes: ['JP'] }))
  view.rerender(<OnboardingFlow {...props} source="file" step="reveal" />)
  expect(await screen.findByRole('heading', { name: 'Your flight is booked' })).toBeVisible()
  expect(screen.getByRole('article', { name: 'TBS to IST' })).toHaveTextContent('Upcoming')
  expect(document.querySelectorAll('.stamp')).toHaveLength(0)
})
