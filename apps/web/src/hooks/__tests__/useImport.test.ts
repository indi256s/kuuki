import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'

import { useParseImport, useEnrichmentPolling } from '../useImport'
import type { ParseResult, ExtractedFlight } from '../useImport'

// ---------- helpers ----------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const flight: ExtractedFlight = {
  date: '2025-06-01',
  origin: 'IST',
  destination: 'TBS',
  airline_iata: 'TK',
  confidence: 0.95,
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

/** Flush pending microtasks (Promise callbacks) */
function flushMicrotasks() {
  return act(() => Promise.resolve())
}

// ---------- useParseImport ----------

describe('useParseImport', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('1 — successful sync parse returns ParseResult with flights', async () => {
    const result: ParseResult = { flights: [flight] }
    vi.spyOn(global, 'fetch').mockReturnValue(jsonResponse(result))

    const { result: hook } = renderHook(() => useParseImport(), {
      wrapper: createWrapper(),
    })

    let data: ParseResult | undefined
    await act(async () => {
      data = await hook.current.mutateAsync({ type: 'text', content: 'IST-TBS' })
    })

    expect(data?.flights).toEqual([flight])
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/import/parse',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('2 — HTTP error rejects with error message from body', async () => {
    vi.spyOn(global, 'fetch').mockReturnValue(
      jsonResponse({ error: 'Invalid PDF format' }, 400)
    )

    const { result: hook } = renderHook(() => useParseImport(), {
      wrapper: createWrapper(),
    })

    await expect(
      act(() => hook.current.mutateAsync({ type: 'pdf', content: 'bad' }))
    ).rejects.toThrow('Invalid PDF format')
  })

  it('3 — network error rejects', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const { result: hook } = renderHook(() => useParseImport(), {
      wrapper: createWrapper(),
    })

    await expect(
      act(() => hook.current.mutateAsync({ type: 'text', content: 'x' }))
    ).rejects.toThrow('Failed to fetch')
  })

  it('4 — unparseable error body falls back to generic message', async () => {
    vi.spyOn(global, 'fetch').mockReturnValue(
      Promise.resolve(new Response('not json', { status: 500 }))
    )

    const { result: hook } = renderHook(() => useParseImport(), {
      wrapper: createWrapper(),
    })

    await expect(
      act(() => hook.current.mutateAsync({ type: 'text', content: 'x' }))
    ).rejects.toThrow('Failed to parse document')
  })

  it('5 — legacy async mode polls and completes', async () => {
    const asyncResult: ParseResult = {
      flights: [],
      jobId: 'job-1',
      status: 'processing',
    }
    const completedResult: ParseResult = {
      flights: [flight],
      status: 'completed',
    }

    let callCount = 0
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : (url as Request).url
      if (urlStr === '/api/import/parse') {
        return jsonResponse(asyncResult)
      }
      // status poll
      callCount++
      if (callCount === 1) {
        return jsonResponse({ flights: [], status: 'processing' })
      }
      return jsonResponse(completedResult)
    })

    const { result: hook } = renderHook(() => useParseImport(), {
      wrapper: createWrapper(),
    })

    let data: ParseResult | undefined
    await act(async () => {
      data = await hook.current.mutateAsync({ type: 'text', content: 'x' })
    })
    expect(data!.flights).toEqual([flight])
    expect(data!.status).toBe('completed')
  })

  it('6 — legacy async mode failure rejects', async () => {
    const asyncResult: ParseResult = {
      flights: [],
      jobId: 'job-2',
      status: 'processing',
    }

    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : (url as Request).url
      if (urlStr === '/api/import/parse') {
        return jsonResponse(asyncResult)
      }
      return jsonResponse({ status: 'failed', error: 'Gemini failed' })
    })

    const { result: hook } = renderHook(() => useParseImport(), {
      wrapper: createWrapper(),
    })

    await expect(
      act(() => hook.current.mutateAsync({ type: 'text', content: 'x' }))
    ).rejects.toThrow('Gemini failed')
  })

  it('7 — two-phase mode returns flights + enrichmentJobId without polling', async () => {
    const twoPhaseResult: ParseResult = {
      flights: [flight],
      enrichmentJobId: 'enrich-1',
      enrichmentStatus: 'pending',
    }

    vi.spyOn(global, 'fetch').mockReturnValue(jsonResponse(twoPhaseResult))

    const { result: hook } = renderHook(() => useParseImport(), {
      wrapper: createWrapper(),
    })

    let data: ParseResult | undefined
    await act(async () => {
      data = await hook.current.mutateAsync({ type: 'text', content: 'x' })
    })
    expect(data!.flights).toEqual([flight])
    expect(data!.enrichmentJobId).toBe('enrich-1')
    // Should only call parse endpoint, no polling
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('8 — AbortError translates to "Request cancelled"', async () => {
    // Create an error that matches `error instanceof Error && error.name === 'AbortError'`
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    vi.spyOn(global, 'fetch').mockRejectedValue(abortError)

    const { result: hook } = renderHook(() => useParseImport(), {
      wrapper: createWrapper(),
    })

    await expect(
      act(() => hook.current.mutateAsync({ type: 'text', content: 'x' }))
    ).rejects.toThrow('Request cancelled')
  })
})

// ---------- useEnrichmentPolling ----------

describe('useEnrichmentPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('9 — completes on first poll, calls onComplete', async () => {
    const enrichedFlights: ExtractedFlight[] = [
      { ...flight, aircraft_icao: 'A320', enrichment_status: 'enriched' },
    ]
    vi.spyOn(global, 'fetch').mockReturnValue(
      jsonResponse({ status: 'completed', flights: enrichedFlights })
    )

    const onComplete = vi.fn()
    const onError = vi.fn()

    renderHook(
      () => useEnrichmentPolling('job-1', onComplete, onError),
      { wrapper: createWrapper() }
    )

    // The effect fires and calls poll() immediately. Flush the promise chain.
    await flushMicrotasks()

    expect(onComplete).toHaveBeenCalledWith(enrichedFlights)
    expect(onError).not.toHaveBeenCalled()
  })

  it('10 — pending then completes on second poll', async () => {
    let callCount = 0
    const enrichedFlights: ExtractedFlight[] = [{ ...flight, aircraft_icao: 'B738' }]

    vi.spyOn(global, 'fetch').mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return jsonResponse({ status: 'pending' })
      }
      return jsonResponse({ status: 'completed', flights: enrichedFlights })
    })

    const onComplete = vi.fn()

    renderHook(
      () => useEnrichmentPolling('job-2', onComplete),
      { wrapper: createWrapper() }
    )

    // First poll (immediate) — pending
    await flushMicrotasks()
    expect(onComplete).not.toHaveBeenCalled()

    // Advance to next interval (2500ms) and flush the async poll
    await vi.advanceTimersByTimeAsync(2500)
    await flushMicrotasks()

    expect(onComplete).toHaveBeenCalledWith(enrichedFlights)
  })

  it('11 — fails and calls onError', async () => {
    vi.spyOn(global, 'fetch').mockReturnValue(
      jsonResponse({ status: 'failed', error: 'Enrichment service down' })
    )

    const onComplete = vi.fn()
    const onError = vi.fn()

    renderHook(
      () => useEnrichmentPolling('job-3', onComplete, onError),
      { wrapper: createWrapper() }
    )

    await flushMicrotasks()

    expect(onError).toHaveBeenCalledWith('Enrichment service down')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('12 — 404 response calls onError with expired message', async () => {
    vi.spyOn(global, 'fetch').mockReturnValue(
      jsonResponse({}, 404)
    )

    const onComplete = vi.fn()
    const onError = vi.fn()

    renderHook(
      () => useEnrichmentPolling('job-4', onComplete, onError),
      { wrapper: createWrapper() }
    )

    await flushMicrotasks()

    expect(onError).toHaveBeenCalledWith(
      'Enrichment job expired. You can still save the basic flights.'
    )
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('13 — max attempts triggers timeout error', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      jsonResponse({ status: 'pending' })
    )

    const onComplete = vi.fn()
    const onError = vi.fn()

    renderHook(
      () => useEnrichmentPolling('job-5', onComplete, onError),
      { wrapper: createWrapper() }
    )

    // Initial poll fires immediately → attemptsRef becomes 1
    await flushMicrotasks()

    // Advance through 119 more polls to reach attemptsRef = 120
    for (let i = 0; i < 119; i++) {
      await vi.advanceTimersByTimeAsync(2500)
      await flushMicrotasks()
    }

    // Next interval: attemptsRef >= MAX_POLL_ATTEMPTS → timeout
    await vi.advanceTimersByTimeAsync(2500)
    await flushMicrotasks()

    expect(onError).toHaveBeenCalledWith(
      'Enrichment timed out. You can still save the basic flights.'
    )
    expect(onComplete).not.toHaveBeenCalled()
  }, 30000)

  it('14 — enabled=false means no fetch called', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const onComplete = vi.fn()

    renderHook(
      () => useEnrichmentPolling('job-6', onComplete, undefined, false),
      { wrapper: createWrapper() }
    )

    await vi.advanceTimersByTimeAsync(5000)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('15 — cleanup on unmount stops further fetches', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      jsonResponse({ status: 'pending' })
    )

    const onComplete = vi.fn()

    const { unmount } = renderHook(
      () => useEnrichmentPolling('job-7', onComplete),
      { wrapper: createWrapper() }
    )

    // Initial poll
    await flushMicrotasks()
    const callsBeforeUnmount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length

    unmount()

    // Advance timer — no more fetches should happen
    await vi.advanceTimersByTimeAsync(10000)
    await flushMicrotasks()

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBeforeUnmount)
  })
})
