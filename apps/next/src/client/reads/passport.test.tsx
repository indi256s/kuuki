// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PassportData } from '../../server/passport'

const mocks = vi.hoisted(() => ({ get: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(''), usePathname: () => '/passport' }))
vi.mock('next/link', async () => ({ default: (await import('../../test/next-link')).linkStandIn(href => mocks.push(href)) }))
vi.mock('../../../../web/src/lib/apiClient', () => ({ api: { get: mocks.get }, getAuthGeneration: () => 1 }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../write-feedback', () => ({ useWriteFeedback: () => ({ acknowledge: vi.fn(), status: 'idle' }) }))
vi.mock('../ui/use-mobile', () => ({ useMobile: () => false }))
vi.mock('../maps/panel', () => ({ RouteMapPanel: () => null }))

const { PassportView } = await import('./passport')
const { PrimaryNav } = await import('../nav')

const initial = {
  visits: [], claims: [], groundVisits: [],
  countries: [
    { country_code: 'PT', status: 'pending', logged_visit_count: 0, awaiting_visit_count: 1, claimed: 0, ground_visit_count: 0, first_visit: '2026-10-03', last_visit: '2026-10-03', region: 'europe' },
    { country_code: 'GR', status: 'pending', logged_visit_count: 0, awaiting_visit_count: 1, claimed: 0, ground_visit_count: 0, first_visit: '2026-10-02', last_visit: '2026-10-02', region: 'europe' },
  ],
  pressedCountryCount: 0, pendingCountryCount: 2, flightCountryCount: 0, regionPolicyVersion: 1,
  regions: [{ id: 'europe', total: 51, pressed: 0, pending: 2 }],
  updatedAt: Date.now(), derivedState: 'ready', revision: 3, publishedRevision: 3,
} as unknown as PassportData

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const awaitingDetail = (code: string, flightId: number) => ({ countryCode: code, entries: [{ kind: 'flight', flightId, endpoint: 'destination', airport: 'LIS', date: '2026-10-03', state: 'awaiting' }] })
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

let reads: Map<string, ReturnType<typeof deferred<unknown>>>
beforeEach(() => {
  vi.clearAllMocks()
  reads = new Map()
  mocks.get.mockImplementation((path: string) => {
    const code = /countries\/([A-Z]{2})\/stats/.exec(path)?.[1]
    if (!code) return Promise.resolve(initial)
    const read = deferred<unknown>()
    reads.set(code, read)
    return read.promise
  })
})

const pendingLink = (country: string) => screen.getByRole('link', { name: `${country}: waiting for confirmation. Open the arrival card` })

describe('pending slot navigation', () => {
  it('says it is opening the arrival card while the evidence loads and navigates once however often it is activated', async () => {
    render(<PassportView ownerId="owner" locale="en" initial={initial} />)
    fireEvent.click(pendingLink('Portugal'))
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    expect(screen.getByText('Opening the arrival card for Portugal…')).toBeInTheDocument()
    expect(pendingLink('Portugal')).toHaveAttribute('aria-busy', 'true')
    expect(mocks.get).toHaveBeenCalledWith('/api/passport/countries/PT/stats', undefined, expect.anything())
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    await settle()
    expect(mocks.push).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith('/journal?queue=awaiting#arrival-8')
  })

  it('drops the navigation when the page goes away before the evidence arrives', async () => {
    const { unmount } = render(<PassportView ownerId="owner" locale="en" initial={initial} />)
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    unmount()
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    await settle()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('follows only the latest activation', async () => {
    render(<PassportView ownerId="owner" locale="en" initial={initial} />)
    fireEvent.click(pendingLink('Portugal'))
    fireEvent.click(pendingLink('Greece'))
    await settle()
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    reads.get('GR')!.resolve(awaitingDetail('GR', 9))
    await settle()
    expect(mocks.push.mock.calls).toEqual([['/journal?queue=awaiting#arrival-9']])
  })

  it('drops the navigation when the member changes the sort meanwhile', async () => {
    render(<PassportView ownerId="owner" locale="en" initial={initial} />)
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    fireEvent.click(screen.getByRole('radio', { name: 'A–Z' }))
    expect(screen.queryByText('Opening the arrival card for Portugal…')).toBeNull()
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    await settle()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('drops a pending arrival when history traversal supersedes it without unmounting', async () => {
    render(<PassportView ownerId="owner" locale="en" initial={initial} />)
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(screen.queryByText('Opening the arrival card for Portugal…')).toBeNull()
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    await settle()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('does not override another URL change while the lookup is pending', async () => {
    render(<PassportView ownerId="owner" locale="en" initial={initial} />)
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    const before = window.location.href
    try {
      window.history.replaceState(null, '', '/passport?country=PT')
      reads.get('PT')!.resolve(awaitingDetail('PT', 8))
      await settle()
      expect(mocks.push).not.toHaveBeenCalled()
      expect(screen.queryByText('Opening the arrival card for Portugal…')).toBeNull()
    } finally { window.history.replaceState(null, '', before) }
  })

  it('lets a cold shell navigation supersede a pending arrival before its URL commits', async () => {
    render(<><PrimaryNav /><PassportView ownerId="owner" locale="en" initial={initial} /></>)
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    fireEvent.click(screen.getByRole('link', { name: /Overview/ }))
    expect(mocks.push.mock.calls).toEqual([['/overview']])
    expect(screen.queryByText('Opening the arrival card for Portugal…')).toBeNull()
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    await settle()
    expect(mocks.push.mock.calls).toEqual([['/overview']])
  })

  it('keeps a pending arrival when a shell link opens in another tab', async () => {
    render(<><PrimaryNav /><PassportView ownerId="owner" locale="en" initial={initial} /></>)
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    fireEvent.click(screen.getByRole('link', { name: /Overview/ }), { ctrlKey: true })
    expect(screen.getByText('Opening the arrival card for Portugal…')).toBeInTheDocument()
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    await settle()
    expect(mocks.push.mock.calls).toEqual([['/journal?queue=awaiting#arrival-8']])
  })

  it('leaves modified clicks to the browser', () => {
    render(<PassportView ownerId="owner" locale="en" initial={initial} />)
    const link = pendingLink('Portugal')
    expect(fireEvent.click(link, { metaKey: true })).toBe(true)
    expect(link).toHaveAttribute('href', '/journal?queue=awaiting')
    expect(mocks.get).not.toHaveBeenCalledWith('/api/passport/countries/PT/stats', undefined, expect.anything())
  })
})
