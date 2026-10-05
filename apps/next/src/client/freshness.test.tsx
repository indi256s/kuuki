// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { awaitPublication } = vi.hoisted(() => ({ awaitPublication: vi.fn<(revision: number) => Promise<'delayed'>>(async () => 'delayed') }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../../../web/src/lib/apiClient', () => ({ getAuthGeneration: () => 1 }))
vi.mock('./activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('./write-feedback', () => ({ awaitPublication }))

import { ReadFreshness, isPublicationPending } from './freshness'

afterEach(() => { cleanup(); awaitPublication.mockClear() })

describe('ReadFreshness', () => {
  it.each([
    [5, 5, undefined, false],
    [5, 5, 'ready', false],
    [6, 5, 'ready', true],
    [5, 5, 'pending', true], // stale evidence stamp: equal revisions, still not published
    [5, 5, 'error', true],
  ] as const)('revision %i published %i derivedState %s -> pending %s', (revision, published, state, pending) => {
    expect(isPublicationPending(revision, published, state)).toBe(pending)
  })

  it('polls for publication when the read says pending even though the revisions are equal', () => {
    render(<ReadFreshness ownerId="u1" revision={5} publishedRevision={5} derivedState="pending" locale="en" />)
    expect(awaitPublication).toHaveBeenCalledTimes(1)
    expect(awaitPublication.mock.calls[0][0]).toBe(5)
  })

  it('stays quiet for a ready read', () => {
    render(<ReadFreshness ownerId="u1" revision={5} publishedRevision={5} derivedState="ready" locale="en" />)
    expect(awaitPublication).not.toHaveBeenCalled()
  })
})
