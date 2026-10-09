// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { api } from '@kuuki/client/apiClient'
import { HistoricalReview } from './historical-review'

vi.mock('../awaiting', () => ({ useOnline: () => true }))
vi.mock('@kuuki/client/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@kuuki/client/apiClient')>()),
  api: { post: vi.fn(), get: vi.fn() },
}))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../publication', () => ({ awaitPublication: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
const mount = () => render(<HistoricalReview locale="en" />)

it.each(['apply', 'dismiss'] as const)(
  'historical review %s preserves unselected flights and honors the persisted marker',
  async (action) => {
    const snapshot = {
      candidates: [1, 2].map((id) => ({
        flight: { id, origin: 'TBS', destination: 'IST' },
        candidate: { kind: 'link', label: 'estimated', leg: { destination: 'FRA' } },
        candidateToken: `review-${id}`,
        affectedCountries: ['TR'],
      })),
      wouldRemoveStamp: { TR: true },
      marker: null,
      derivedState: 'ready',
      revision: 1,
    }
    vi.mocked(api.get)
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValue({
        ...snapshot,
        marker: { status: action === 'apply' ? 'completed' : 'dismissed', matchesCandidates: true },
      })
    vi.mocked(api.post).mockResolvedValue({
      action,
      results: [],
      derivedState: 'ready',
      revision: 2,
      removedCountries: action === 'apply' ? ['TR'] : [],
    })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Review historical connections' }))
    expect(screen.getAllByText(/Estimated from dates/)).toHaveLength(2)
    expect(screen.getAllByText(/stamp will be removed/)).toHaveLength(2)
    expect(screen.queryByText(/\bTR:/)).not.toBeInTheDocument()
    if (action === 'apply') fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.click(
      screen.getByRole('button', {
        name: action === 'apply' ? 'Mark selected as transit' : 'Keep as recorded',
      }),
    )
    if (action === 'apply') expect(screen.queryByText(/\bTR\b/)).not.toBeInTheDocument()
    await screen.findByText(
      action === 'apply'
        ? `Removed stamps: ${new Intl.DisplayNames(['en'], { type: 'region' }).of('TR')}`
        : 'Review saved.',
    )
    const request = vi.mocked(api.post).mock.calls[0][1]
    expect(request).toEqual({
      operationId: expect.any(String),
      action,
      items: action === 'apply' ? [{ flightId: 1, candidateToken: 'review-1' }] : [],
    })
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Review historical connections' }),
      ).not.toBeInTheDocument(),
    )
  },
)

it.each([
  ['en', 'Based on flight times'],
  ['ru', 'Определено по времени рейсов'],
] as const)(
  'words the historical review basis like the awaiting card (%s)',
  async (locale, phrase) => {
    const snapshot = {
      candidates: [
        {
          flight: { id: 1, origin: 'TBS', destination: 'IST' },
          candidate: { kind: 'link', label: 'times', leg: { destination: 'FRA' } },
          candidateToken: 'review-1',
          affectedCountries: ['TR'],
        },
      ],
      wouldRemoveStamp: {},
      marker: null,
      derivedState: 'ready',
      revision: 1,
    }
    vi.mocked(api.get).mockResolvedValue(snapshot)
    render(<HistoricalReview locale={locale} />)
    fireEvent.click(
      await screen.findByRole('button', {
        name: locale === 'en' ? 'Review historical connections' : /Проверить|историч/i,
      }),
    )
    expect(await screen.findByText(new RegExp(phrase))).toBeInTheDocument()
  },
)
