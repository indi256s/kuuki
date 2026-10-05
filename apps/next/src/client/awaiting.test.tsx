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
  expect(await screen.findByRole('link', { name: '2 awaiting confirmation, 3 draft rows to review' })).toHaveTextContent('5')
  expect(screen.getByText('Awaiting action: 5')).toBeInTheDocument()
  act(() => window.dispatchEvent(new Event('kuuki:lifecycle-changed')))
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('link', { name: '2 awaiting confirmation, 3 draft rows to review' })).toHaveTextContent('5')
  act(() => window.dispatchEvent(new Event('kuuki:lifecycle-changed')))
  await waitFor(() => expect(screen.queryByRole('link', { name: /awaiting confirmation/ })).not.toBeInTheDocument())
  expect(screen.queryByText('Awaiting action: 5')).not.toBeInTheDocument()
})
