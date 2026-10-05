// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { api } from '../../../web/src/lib/apiClient'
import { AwaitingProvider } from './awaiting'
import { QueueSummarySlot } from './queue-summary'
import { AddActions } from './add-actions'

vi.mock('./activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../../../web/src/lib/apiClient', () => ({ api: { get: vi.fn() }, getAuthGeneration: () => 0 }))

it('shares distinct C4 counts with navigation/capture, retains cached counts on failure, and hides zero', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ actionableCount: 5, awaitingFlightCount: 2, draftRowCount: 3 }).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ actionableCount: 0, awaitingFlightCount: 0, draftRowCount: 0 })
  render(<AwaitingProvider ownerId="owner"><QueueSummarySlot /><AddActions variant="sheet" /></AwaitingProvider>)
  expect(await screen.findByRole('link', { name: '5 awaiting action: 2 flights awaiting confirmation, 3 draft rows to review' })).toHaveTextContent('5')
  expect(screen.getByText('Awaiting action: 5')).toBeInTheDocument()
  act(() => window.dispatchEvent(new Event('kuuki:lifecycle-changed')))
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('link', { name: '5 awaiting action: 2 flights awaiting confirmation, 3 draft rows to review' })).toHaveTextContent('5')
  act(() => window.dispatchEvent(new Event('kuuki:lifecycle-changed')))
  await waitFor(() => expect(screen.queryByRole('link', { name: /awaiting/ })).not.toBeInTheDocument())
  expect(screen.queryByText('Awaiting action: 5')).not.toBeInTheDocument()
})

const cases: Array<[number, number, string, string]> = [
  [1, 0, '1 awaiting action: 1 flight awaiting confirmation', '1 в очереди: 1 перелёт ждёт подтверждения'],
  [2, 0, '2 awaiting action: 2 flights awaiting confirmation', '2 в очереди: 2 перелёта ждут подтверждения'],
  [5, 0, '5 awaiting action: 5 flights awaiting confirmation', '5 в очереди: 5 перелётов ждут подтверждения'],
  [0, 1, '1 awaiting action: 1 draft row to review', '1 в очереди: 1 строка для проверки'],
  [0, 2, '2 awaiting action: 2 draft rows to review', '2 в очереди: 2 строки для проверки'],
  [0, 5, '5 awaiting action: 5 draft rows to review', '5 в очереди: 5 строк для проверки'],
  [1, 5, '6 awaiting action: 1 flight awaiting confirmation, 5 draft rows to review', '6 в очереди: 1 перелёт ждёт подтверждения, 5 строк для проверки'],
  [21, 2, '23 awaiting action: 21 flights awaiting confirmation, 2 draft rows to review', '23 в очереди: 21 перелёт ждёт подтверждения, 2 строки для проверки'],
]
it.each(cases)('names the badge with real plurals, only non-zero parts and the visible number first (%i flights, %i rows)', async (flights, rows, en, ru) => {
  for (const [locale, name] of [['en', en], ['ru', ru]] as const) {
    vi.mocked(api.get).mockReset().mockResolvedValue({ actionableCount: flights + rows, awaitingFlightCount: flights, draftRowCount: rows })
    const { unmount } = render(<AwaitingProvider ownerId={`owner-${locale}`}><QueueSummarySlot locale={locale} /></AwaitingProvider>)
    const link = await screen.findByRole('link', { name })
    expect(link).toHaveTextContent(String(flights + rows))
    expect(link.getAttribute('aria-label')!.startsWith(link.textContent!)).toBe(true)
    expect(link.getAttribute('aria-label')).not.toMatch(/\b0 /)
    unmount()
  }
})
