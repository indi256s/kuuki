// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
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
const mount = () => render(<HistoricalReview locale="en" available />)

it.each([true, false, null])(
  'updates unread availability after a server refresh from %s',
  (initial) => {
    const { rerender } = render(<HistoricalReview locale="en" available={initial} />)
    for (const available of [null, false, true] as const) {
      rerender(<HistoricalReview locale="en" available={available} />)
      if (available === null) {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Connection review could not be loaded or saved.',
        )
        expect(screen.getByRole('button', { name: 'Retry review' })).toBeEnabled()
      } else {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      }
      expect(screen.queryByRole('button', { name: 'Review historical connections' }) !== null).toBe(
        available === true,
      )
    }
    expect(api.get).not.toHaveBeenCalled()
  },
)

it('renders available review in the initial markup and loads details only when opened', async () => {
  let resolve!: (value: unknown) => void
  vi.mocked(api.get).mockImplementation(() => new Promise((done) => (resolve = done)))
  const props = { locale: 'en' as const, available: true }
  const review = <HistoricalReview {...props} />
  expect(renderToStaticMarkup(review)).toContain('Review historical connections')
  render(review)
  const trigger = screen.getByRole('button', { name: 'Review historical connections' })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(api.get).not.toHaveBeenCalled()

  fireEvent.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(await screen.findByText('Loading connection review…')).toBeInTheDocument()
  expect(api.get).toHaveBeenCalledTimes(1)
  resolve({
    candidates: [
      {
        flight: { id: 1, origin: 'TBS', destination: 'IST' },
        candidate: { kind: 'link', label: 'estimated', leg: { destination: 'FRA' } },
        candidateToken: 'review-1',
        affectedCountries: ['TR'],
      },
    ],
    wouldRemoveStamp: { TR: true },
    marker: null,
    derivedState: 'ready',
    revision: 1,
  })
  expect(await screen.findByRole('checkbox')).toBeInTheDocument()
  expect(screen.queryByText('Loading connection review…')).not.toBeInTheDocument()
})

it('keeps an unavailable initial review visible and retries failed detail reads on request', async () => {
  vi.mocked(api.get)
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValue({
      candidates: [
        {
          flight: { id: 1, origin: 'TBS', destination: 'IST' },
          candidate: { kind: 'link', label: 'estimated', leg: { destination: 'FRA' } },
          candidateToken: 'review-1',
          affectedCountries: [],
        },
      ],
      wouldRemoveStamp: {},
      marker: null,
      derivedState: 'ready',
      revision: 1,
    })
  render(<HistoricalReview locale="en" available={null} />)
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Connection review could not be loaded or saved.',
  )
  expect(api.get).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry review' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Retry review' }))
  expect(await screen.findByRole('checkbox')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Review historical connections' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  expect(api.get).toHaveBeenCalledTimes(2)
})

it.each(['apply', 'dismiss'] as const)(
  'keeps a late %s failure visible after collapse and retries the same operation',
  async (action) => {
    const snapshot = {
      candidates: [
        {
          flight: { id: 1, origin: 'TBS', destination: 'IST' },
          candidate: { kind: 'link', label: 'estimated', leg: { destination: 'FRA' } },
          candidateToken: 'review-1',
          affectedCountries: [],
        },
      ],
      wouldRemoveStamp: {},
      marker: null,
      derivedState: 'ready',
      revision: 1,
    }
    let reject!: (cause: Error) => void
    vi.mocked(api.get)
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValue({
        ...snapshot,
        marker: { status: action === 'apply' ? 'completed' : 'dismissed', matchesCandidates: true },
      })
    vi.mocked(api.post)
      .mockImplementationOnce(
        () =>
          new Promise((_, fail) => {
            reject = fail
          }),
      )
      .mockResolvedValue({
        action,
        results: [],
        derivedState: 'ready',
        revision: 2,
        removedCountries: [],
      })
    mount()
    const trigger = screen.getByRole('button', { name: 'Review historical connections' })
    fireEvent.click(trigger)
    const checkbox = await screen.findByRole('checkbox')
    if (action === 'apply') fireEvent.click(checkbox)
    fireEvent.click(
      screen.getByRole('button', {
        name: action === 'apply' ? 'Mark selected as transit' : 'Keep as recorded',
      }),
    )
    fireEvent.click(trigger)
    await act(async () => reject(new Error('Response unavailable')))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Connection review could not be loaded or saved.',
    )
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(api.get).toHaveBeenCalledTimes(1)
    const original = vi.mocked(api.post).mock.calls[0][1]
    fireEvent.click(screen.getByRole('button', { name: 'Retry review save' }))
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(original)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(await screen.findByText('Review saved.')).toBeInTheDocument()
  },
)

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
    expect(await screen.findAllByText(/Estimated from dates/)).toHaveLength(2)
    expect(screen.getAllByText(/stamp will be removed/)).toHaveLength(2)
    expect(screen.queryByText(/\bTR:/)).not.toBeInTheDocument()
    if (action === 'apply') fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.click(
      screen.getByRole('button', {
        name: action === 'apply' ? 'Mark selected as transit' : 'Keep as recorded',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Review historical connections' }))
    expect(vi.mocked(api.post).mock.calls[0][2]?.signal?.aborted).toBe(false)
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
    render(<HistoricalReview locale={locale} available />)
    fireEvent.click(
      await screen.findByRole('button', {
        name: locale === 'en' ? 'Review historical connections' : /Проверить|историч/i,
      }),
    )
    expect(await screen.findByText(new RegExp(phrase))).toBeInTheDocument()
  },
)
