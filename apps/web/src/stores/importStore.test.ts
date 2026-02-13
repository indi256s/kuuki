import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { useImportStore, type BackgroundJob } from './importStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<BackgroundJob> = {}): BackgroundJob {
  return {
    jobId: overrides.jobId ?? 'job-1',
    basicFlights: [],
    startedAt: overrides.startedAt ?? Date.now(),
    ...overrides,
  }
}

const getState = () => useImportStore.getState()

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('importStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
    useImportStore.setState({ backgroundJobs: {} })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // 1 ─ Initial state
  it('has empty backgroundJobs by default', () => {
    expect(getState().backgroundJobs).toEqual({})
  })

  // 2 ─ addBackgroundJob stores job keyed by jobId
  it('addBackgroundJob stores job keyed by jobId', () => {
    const job = makeJob({ jobId: 'abc' })
    getState().addBackgroundJob(job)
    expect(getState().backgroundJobs['abc']).toEqual(job)
  })

  // 3 ─ addBackgroundJob x2 stores both independently
  it('addBackgroundJob stores multiple jobs independently', () => {
    const job1 = makeJob({ jobId: 'j1' })
    const job2 = makeJob({ jobId: 'j2' })
    getState().addBackgroundJob(job1)
    getState().addBackgroundJob(job2)

    expect(Object.keys(getState().backgroundJobs)).toHaveLength(2)
    expect(getState().backgroundJobs['j1']).toEqual(job1)
    expect(getState().backgroundJobs['j2']).toEqual(job2)
  })

  // 4 ─ addBackgroundJob overwrites same jobId
  it('addBackgroundJob overwrites existing job with same jobId', () => {
    const original = makeJob({ jobId: 'dup', returnPath: '/old' })
    const replacement = makeJob({ jobId: 'dup', returnPath: '/new' })
    getState().addBackgroundJob(original)
    getState().addBackgroundJob(replacement)

    expect(Object.keys(getState().backgroundJobs)).toHaveLength(1)
    expect(getState().backgroundJobs['dup'].returnPath).toBe('/new')
  })

  // 5 ─ removeBackgroundJob removes target, keeps others
  it('removeBackgroundJob removes target and keeps others', () => {
    getState().addBackgroundJob(makeJob({ jobId: 'keep' }))
    getState().addBackgroundJob(makeJob({ jobId: 'remove' }))
    getState().removeBackgroundJob('remove')

    expect(getState().backgroundJobs['keep']).toBeDefined()
    expect(getState().backgroundJobs['remove']).toBeUndefined()
  })

  // 6 ─ removeBackgroundJob nonexistent is a no-op
  it('removeBackgroundJob on nonexistent jobId is a no-op', () => {
    getState().addBackgroundJob(makeJob({ jobId: 'only' }))
    getState().removeBackgroundJob('ghost')

    expect(Object.keys(getState().backgroundJobs)).toHaveLength(1)
    expect(getState().backgroundJobs['only']).toBeDefined()
  })

  // 7 ─ getActiveJobs returns fresh jobs (< 10 min old)
  it('getActiveJobs returns jobs younger than 10 minutes', () => {
    const job = makeJob({ jobId: 'fresh', startedAt: Date.now() })
    getState().addBackgroundJob(job)

    // Advance 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000)

    const active = getState().getActiveJobs()
    expect(active).toHaveLength(1)
    expect(active[0].jobId).toBe('fresh')
  })

  // 8 ─ getActiveJobs excludes expired jobs (> 10 min)
  it('getActiveJobs excludes jobs older than 10 minutes', () => {
    const job = makeJob({ jobId: 'old', startedAt: Date.now() })
    getState().addBackgroundJob(job)

    // Advance 11 minutes
    vi.advanceTimersByTime(11 * 60 * 1000)

    expect(getState().getActiveJobs()).toHaveLength(0)
  })

  // 9 ─ getActiveJobs boundary: exactly 600000ms is excluded (strict <)
  it('getActiveJobs excludes job at exactly 10 minutes (strict <)', () => {
    const job = makeJob({ jobId: 'boundary', startedAt: Date.now() })
    getState().addBackgroundJob(job)

    // Advance exactly 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000)

    expect(getState().getActiveJobs()).toHaveLength(0)
  })

  // 10 ─ getActiveJobs mixed: only fresh jobs from a mix
  it('getActiveJobs returns only fresh jobs from a mixed set', () => {
    const now = Date.now()
    getState().addBackgroundJob(makeJob({ jobId: 'fresh', startedAt: now }))
    getState().addBackgroundJob(
      makeJob({ jobId: 'stale', startedAt: now - 11 * 60 * 1000 })
    )

    const active = getState().getActiveJobs()
    expect(active).toHaveLength(1)
    expect(active[0].jobId).toBe('fresh')
  })

  // 11 ─ clearExpiredJobs removes expired, keeps active
  it('clearExpiredJobs removes expired and keeps active jobs', () => {
    const now = Date.now()
    getState().addBackgroundJob(makeJob({ jobId: 'active', startedAt: now }))
    getState().addBackgroundJob(
      makeJob({ jobId: 'expired', startedAt: now - 11 * 60 * 1000 })
    )

    getState().clearExpiredJobs()

    expect(getState().backgroundJobs['active']).toBeDefined()
    expect(getState().backgroundJobs['expired']).toBeUndefined()
  })

  // 12 ─ clearExpiredJobs all expired empties store
  it('clearExpiredJobs empties store when all jobs are expired', () => {
    const old = Date.now() - 15 * 60 * 1000
    getState().addBackgroundJob(makeJob({ jobId: 'a', startedAt: old }))
    getState().addBackgroundJob(makeJob({ jobId: 'b', startedAt: old }))

    getState().clearExpiredJobs()

    expect(getState().backgroundJobs).toEqual({})
  })
})
