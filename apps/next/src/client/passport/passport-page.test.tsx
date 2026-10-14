// @vitest-environment jsdom
import { act, fireEvent, render as renderBare, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useReducer, type ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PassportData } from '../../server/passport'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  push: vi.fn(),
  listeners: new Set<() => void>(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: vi.fn(), replace: vi.fn() }),
  // Next keeps useSearchParams in sync with native history; the stand-in does the same.
  useSearchParams: () => {
    const [, tick] = useReducer((count: number) => count + 1, 0)
    useEffect(() => {
      mocks.listeners.add(tick)
      return () => void mocks.listeners.delete(tick)
    }, [])
    return new URLSearchParams(window.location.search)
  },
  usePathname: () => '/passport',
}))
vi.mock('next/link', async () => ({
  default: (await import('../../test/next-link')).linkStandIn((href) => mocks.push(href)),
}))
vi.mock('@kuuki/client/apiClient', () => ({
  api: { get: mocks.get, put: mocks.put, delete: mocks.delete },
  getAuthGeneration: () => 1,
}))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../write-feedback', () => ({
  useWriteFeedback: () => ({ acknowledge: vi.fn(), status: 'idle' }),
}))
vi.mock('../ui/use-mobile', () => ({ useMobile: () => false }))
vi.mock('../profile/avatar', () => ({ ProfileAvatar: () => <span aria-hidden="true" /> }))
// The atlas belongs to W3; the stand-in keeps the filtered set visible to these tests.
vi.mock('./atlas', () => ({
  PassportAtlas: ({
    entries,
    pending,
  }: {
    entries: { code: string }[]
    pending: { code: string }[]
  }) => (
    <>
      <ul aria-label="Atlas stand-in">
        {entries.map((entry) => (
          <li key={entry.code}>{entry.code}</li>
        ))}
      </ul>
      <ul aria-label="Atlas pending stand-in">
        {pending.map((entry) => (
          <li key={entry.code}>{entry.code}</li>
        ))}
      </ul>
    </>
  ),
}))

const { PassportPage } = await import('./passport-page')
const { PrimaryNav } = await import('../nav')
const { ToastProvider } = await import('../ui/toast')

// The page lives in the member shell, whose ToastProvider carries the hide notice.
const render = (ui: ReactElement) => renderBare(ui, { wrapper: ToastProvider })

const row = (code: string, region: string, over: Record<string, unknown> = {}) => ({
  country_code: code,
  status: 'pressed',
  logged_visit_count: 1,
  awaiting_visit_count: 0,
  claimed: 0,
  ground_visit_count: 0,
  ground_journey_count: 0,
  first_visit: '2026-03-10',
  last_visit: '2026-03-10',
  region,
  ...over,
})
const pendingRow = (code: string) =>
  row(code, 'europe', {
    status: 'pending',
    logged_visit_count: 0,
    awaiting_visit_count: 1,
    first_visit: '2026-10-03',
    last_visit: '2026-10-03',
  })

const owned = {
  visits: [],
  claims: [],
  groundVisits: [],
  hidden: ['DE', 'FR'],
  journeyModes: [{ country_code: 'NO', mode: 'rail' }],
  countries: [
    row('NO', 'europe'),
    row('JP', 'asia', { first_visit: '2025-05-01', last_visit: '2025-05-01' }),
    row('GE', 'asia', {
      logged_visit_count: 0,
      claimed: 1,
      first_visit: null,
      last_visit: null,
    }),
    pendingRow('PT'),
    pendingRow('GR'),
  ],
  // Three visible pressed countries plus the two hidden ones.
  pressedCountryCount: 5,
  visibleCountryCount: 3,
  pendingCountryCount: 2,
  flightCountryCount: 2,
  regionPolicyVersion: 1,
  regions: [],
  updatedAt: Date.now(),
  derivedState: 'ready',
  revision: 3,
  publishedRevision: 3,
} as unknown as PassportData

const profile = {
  id: 'owner',
  username: 'ana',
  display_name: 'Ana',
  avatar_url: null,
  bio: null,
  is_public: true,
  theme_color: null,
}
const stats = {
  user_id: 'owner',
  total_flights: 9,
  total_distance_km: 12345,
  total_duration_minutes: 600,
  longest_flight_minutes: 30,
  airports_count: 4,
  cities_count: 2,
  countries_count: 2,
  continents_count: 1,
  airlines_count: 1,
  aircraft_count: 1,
  time_zones_count: 0,
  most_visited_country: null,
  most_visited_count: 0,
  world_completion_pct: 0,
  has_night_departure: false,
  updated_at: '2026-10-04',
}
const base = {
  locale: 'en' as const,
  profile,
  routeHandle: 'ana',
  stats,
  badges: [],
  rankings: [],
  derivedState: 'ready',
}
const ownerProps = (over: Partial<{ data: PassportData; visibility: 'public' | 'private' }> = {}) =>
  ({
    ...base,
    mode: 'owner' as const,
    ownerId: 'owner',
    data: over.data ?? owned,
    visibility: over.visibility ?? ('public' as const),
    shareUrl: 'https://kuuki.test/fly/ana',
  }) satisfies Parameters<typeof PassportPage>[0]
const publicProps = (mode: 'visitor' | 'preview', countries = ['NO', 'JP', 'GE']) =>
  mode === 'visitor'
    ? ({
        ...base,
        mode,
        countries,
        memberViewer: false,
        viewerIsOwner: false,
      } satisfies Parameters<typeof PassportPage>[0])
    : ({ ...base, mode, countries } satisfies Parameters<typeof PassportPage>[0])

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const awaitingDetail = (code: string, flightId: number) => ({
  countryCode: code,
  status: 'pending',
  groundVisits: [],
  journeys: [],
  suppressed: [],
  airports: [],
  firstVisit: '2026-10-03',
  lastVisit: '2026-10-03',
  totalVisits: 1,
  derivedState: 'ready',
  revision: 3,
  publishedRevision: 3,
  entries: [
    {
      kind: 'flight',
      flightId,
      endpoint: 'destination',
      airport: 'LIS',
      date: '2026-10-03',
      state: 'awaiting',
    },
  ],
})
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

const nativePush = window.history.pushState.bind(window.history)
const nativeReplace = window.history.replaceState.bind(window.history)
let reads: Map<string, ReturnType<typeof deferred<unknown>>>
beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  const notify = () => act(() => mocks.listeners.forEach((listener) => listener()))
  vi.spyOn(window.history, 'pushState').mockImplementation((...args) => {
    nativePush(...args)
    notify()
  })
  vi.spyOn(window.history, 'replaceState').mockImplementation((...args) => {
    nativeReplace(...args)
    notify()
  })
  Element.prototype.scrollIntoView = vi.fn()
  reads = new Map()
  mocks.get.mockImplementation((path: string) => {
    const code = /countries\/([A-Z]{2})\/stats/.exec(path)?.[1]
    if (!code) return Promise.resolve(owned)
    const read = deferred<unknown>()
    reads.set(code, read)
    return read.promise
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  nativeReplace(null, '', '/')
})

const pendingLink = (country: string) =>
  screen.getByRole('link', { name: `${country}: waiting for confirmation. Open the arrival card` })
const toolbar = () => screen.getByRole('group', { name: 'Passport search, view and filters' })

describe('owner, visitor and preview', () => {
  it('shows the owner controls, dates, source marks and the pending block only to the owner', async () => {
    render(<PassportPage {...ownerProps()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Ana' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Passport menu' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sort stamps' })).toHaveTextContent('Recent')
    expect(screen.getByRole('button', { name: 'Share profile' })).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Public profile, change in Settings' }),
    ).toHaveAttribute('href', '/settings')
    expect(screen.getByText('Only you see this')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Awaiting confirmation · 2' })).toBeVisible()
    const norway = screen.getByRole('button', { name: /^Norway/ })
    expect(norway).toHaveTextContent('March 2026')
    expect(norway).toHaveTextContent('Flights, Trains')
    // Search and Cards/Map sit beside Filters, and Sources live in the Filters popover for the owner.
    await userEvent.click(within(toolbar()).getByRole('button', { name: 'Filters' }))
    expect(screen.getByRole('group', { name: 'Sources' })).toBeVisible()
    expect(screen.getByRole('checkbox', { name: 'Road trips' })).toBeVisible()
  })

  it('tells a private owner calmly and offers no Share', () => {
    render(<PassportPage {...ownerProps({ visibility: 'private' })} />)
    expect(
      screen.getByRole('link', { name: 'Private profile, change in Settings' }),
    ).toHaveAttribute('href', '/settings')
    expect(
      screen.getByText(/Your profile is private\. Others see a closed passport\./),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Share profile' })).not.toBeInTheDocument()
  })

  it.each(['visitor', 'preview'] as const)(
    'gives the %s the stamp and the name only, sorted by name, with no owner controls',
    async (mode) => {
      const view = render(<PassportPage {...publicProps(mode)} />)
      expect(screen.getByRole('heading', { level: 1, name: 'Ana' })).toBeVisible()
      const cards = within(screen.getByRole('list', { name: 'Stamps' })).getAllByRole('button')
      expect(cards.map((card) => card.textContent)).toEqual(['Georgia', 'Japan', 'Norway'])
      for (const control of [
        'Passport menu',
        'Sort stamps',
        'Share profile',
        'Public profile, change in Settings',
      ])
        expect(screen.queryByRole('button', { name: control })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /change in Settings/ })).not.toBeInTheDocument()
      expect(screen.queryByText('Only you see this')).not.toBeInTheDocument()
      expect(screen.queryByText(/Awaiting confirmation/)).not.toBeInTheDocument()
      expect(view.container.textContent).not.toMatch(/2026|2025|Trains|hidden/i)
      // A visitor has no Sources group.
      await userEvent.click(within(toolbar()).getByRole('button', { name: 'Filters' }))
      expect(screen.getByRole('group', { name: 'Region' })).toBeVisible()
      expect(screen.queryByRole('group', { name: 'Sources' })).not.toBeInTheDocument()
    },
  )

  it('marks the preview and names a private profile; a visitor gets the join card, a member does not', () => {
    const { unmount } = render(<PassportPage {...publicProps('preview')} />)
    expect(screen.getByText('Previewing as a visitor: this is what others see.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to my passport' })).toHaveAttribute(
      'href',
      '/passport',
    )
    expect(screen.queryByRole('link', { name: 'Start your own flight journal' })).toBeNull()
    unmount()
    const preview = { ...publicProps('preview'), profile: { ...profile, is_public: false } }
    const second = render(<PassportPage {...preview} />)
    expect(
      screen.getByText(/Your profile is private\. This is what visitors would see/),
    ).toBeVisible()
    second.unmount()
    render(<PassportPage {...publicProps('visitor')} />)
    expect(screen.getByRole('link', { name: 'Start your own flight journal' })).toHaveAttribute(
      'href',
      '/signup',
    )
  })

  it('links the owner on their own public page back to the passport', () => {
    render(
      <PassportPage {...publicProps('visitor')} {...{ viewerIsOwner: true, memberViewer: true }} />,
    )
    expect(screen.getByText('This is your public page.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to my passport' })).toBeVisible()
  })

  it('opens the read-only sheet for a visitor with the name and no write actions', async () => {
    render(<PassportPage {...publicProps('visitor')} />)
    await userEvent.click(screen.getByRole('button', { name: 'Japan' }))
    expect(window.location.search).toBe('?country=JP')
    const sheet = await screen.findByRole('dialog', { name: 'Japan' })
    expect(within(sheet).queryByRole('button', { name: /claim|add|remove/i })).toBeNull()
    await userEvent.keyboard('{Escape}')
    expect(window.location.search).toBe('')
  })

  it('names an unvisited catalog country without a stamp', async () => {
    window.history.replaceState(null, '', '/passport?country=IS')
    render(<PassportPage {...publicProps('visitor')} />)
    const sheet = await screen.findByRole('dialog', { name: 'Iceland' })
    expect(sheet).toHaveTextContent('Not in this passport')
  })
})

describe('totals and found', () => {
  it('states the factual total with the hidden count beside it for the owner', () => {
    render(<PassportPage {...ownerProps()} />)
    expect(screen.getByText('Visited 5 countries · 2 hidden')).toBeVisible()
    // Cards and counts of the collection refer to the visible set.
    expect(
      within(screen.getByRole('list', { name: 'Stamps' })).getAllByRole('button'),
    ).toHaveLength(3)
  })

  it('states the public set size for a visitor', () => {
    render(<PassportPage {...publicProps('visitor')} />)
    expect(screen.getByText('Visited 3 countries')).toBeVisible()
  })

  it('shows Found N of M only while a search or filter is active and clears it with Escape', async () => {
    const user = userEvent.setup()
    render(<PassportPage {...ownerProps()} />)
    expect(screen.queryByText(/^Found /)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
    const search = screen.getByRole('searchbox', { name: 'Search the passport' })
    await user.type(search, 'nor')
    expect(screen.getByText('Found 1 of 3')).toBeVisible()
    expect(window.location.search).toBe('?q=nor')
    expect(screen.getByRole('button', { name: 'Reset' })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(search).toHaveValue('')
    expect(screen.queryByText(/^Found /)).not.toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('keeps the filters in the URL across Cards and Map and counts them on the Filters button', async () => {
    const user = userEvent.setup()
    render(<PassportPage {...ownerProps()} />)
    await user.click(within(toolbar()).getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('radio', { name: 'Asia' }))
    await user.click(screen.getByRole('checkbox', { name: 'Manual' }))
    expect(window.location.search).toBe('?region=asia&src=manual')
    expect(screen.getByRole('button', { name: 'Filters, 2 active' })).toBeVisible()
    expect(screen.getByText('Found 1 of 3')).toBeVisible()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('radio', { name: 'Map' }))
    expect(window.location.search).toBe('?view=map&region=asia&src=manual')
    expect(
      within(screen.getByRole('list', { name: 'Atlas stand-in' })).getAllByRole('listitem'),
    ).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(window.location.search).toBe('?view=map')
    expect(screen.queryByText(/^Found /)).not.toBeInTheDocument()
  })

  it('filters the pending countries the atlas draws with the same model', async () => {
    const atlasPending = () =>
      within(screen.getByRole('list', { name: 'Atlas pending stand-in' })).queryAllByRole(
        'listitem',
      )
    nativeReplace(null, '', '/passport?view=map')
    render(<PassportPage {...ownerProps()} />)
    expect(atlasPending().map((item) => item.textContent)).toEqual(['PT', 'GR'])
    act(() => window.history.replaceState(null, '', '/passport?view=map&region=asia'))
    expect(atlasPending()).toHaveLength(0)
  })
})

describe('search with no match', () => {
  it('offers the owner a separate Add action for the unvisited country the query names', async () => {
    const user = userEvent.setup()
    render(<PassportPage {...ownerProps()} />)
    await user.type(screen.getByRole('searchbox', { name: 'Search the passport' }), 'Iceland')
    expect(screen.getByRole('heading', { name: 'Nothing matches' })).toBeVisible()
    expect(screen.getByText('Found 0 of 3')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Add Iceland' }))
    expect(window.location.search).toContain('country=IS')
    expect(await screen.findByRole('dialog', { name: 'Iceland' })).toBeVisible()
  })

  it('gives the visitor only the name and a way back', async () => {
    const user = userEvent.setup()
    render(<PassportPage {...publicProps('visitor')} />)
    await user.type(screen.getByRole('searchbox', { name: 'Search the passport' }), 'Iceland')
    expect(screen.getByText('Iceland is not in this passport.')).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Add/ })).not.toBeInTheDocument()
    // The toolbar and the empty state both offer the way back.
    await user.click(screen.getAllByRole('button', { name: 'Reset' })[0])
    expect(screen.getByRole('list', { name: 'Stamps' })).toBeVisible()
  })

  it('does not suggest a country that is already in the passport or hidden', async () => {
    const user = userEvent.setup()
    render(<PassportPage {...ownerProps()} />)
    await user.type(screen.getByRole('searchbox', { name: 'Search the passport' }), 'germany')
    expect(screen.getByRole('heading', { name: 'Nothing matches' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Add/ })).not.toBeInTheDocument()
  })
})

describe('states', () => {
  const empty = (over: Record<string, unknown> = {}) =>
    ({
      ...owned,
      countries: [],
      hidden: [],
      pressedCountryCount: 0,
      visibleCountryCount: 0,
      pendingCountryCount: 0,
      ...over,
    }) as unknown as PassportData

  it('shows the empty passport with its two ways in', () => {
    render(<PassportPage {...ownerProps({ data: empty() })} />)
    expect(screen.getByRole('heading', { name: '246 countries are waiting for you' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add country' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Import flights' })).toBeVisible()
  })

  it('points a pending-only passport at the pending block instead of calling it empty', async () => {
    const data = empty({
      countries: [pendingRow('PT')],
      pendingCountryCount: 1,
    })
    render(<PassportPage {...ownerProps({ data })} />)
    expect(screen.queryByRole('heading', { name: /waiting for you/ })).not.toBeInTheDocument()
    expect(screen.getByText(/No stamps yet: the countries below are waiting/)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Go to awaiting' }))
    expect(screen.getByRole('heading', { name: 'Awaiting confirmation · 1' })).toHaveFocus()
  })

  it('shows the atlas with its pending countries for a pending-only passport', () => {
    const data = empty({ countries: [pendingRow('PT')], pendingCountryCount: 1 })
    nativeReplace(null, '', '/passport?view=map')
    render(<PassportPage {...ownerProps({ data })} />)
    expect(screen.getByText(/No stamps yet: the countries below are waiting/)).toBeVisible()
    expect(
      within(screen.getByRole('list', { name: 'Atlas pending stand-in' })).getByText('PT'),
    ).toBeInTheDocument()
  })

  it('scrolls to and focuses the pending block from the entry above the collection', async () => {
    render(<PassportPage {...ownerProps()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Awaiting confirmation · 2' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Awaiting confirmation · 2' })).toHaveFocus()
  })

  it('is a calm line for a visitor with nothing to show, never an empty block', () => {
    render(<PassportPage {...publicProps('visitor', [])} />)
    expect(screen.getByText(/^No countries to show yet\./)).toBeVisible()
    expect(screen.queryByText(/^Visited/)).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Stamps' })).not.toBeInTheDocument()
  })

  it.each([
    ['pending', /still being prepared/, /Your passport is being prepared/],
    ['error', /could not be processed/, /could not be assembled/],
  ] as const)(
    'reports a %s derivation as a status note, never as an empty passport',
    (derivedState, note, line) => {
      render(<PassportPage {...ownerProps({ data: empty({ derivedState }) })} />)
      expect(screen.getAllByRole('status').some((node) => note.test(node.textContent ?? ''))).toBe(
        true,
      )
      expect(screen.getByText(line)).toBeVisible()
      expect(screen.queryByRole('heading', { name: /waiting for you/ })).not.toBeInTheDocument()
    },
  )

  it('says all countries are hidden and opens the hidden list', async () => {
    render(
      <PassportPage {...ownerProps({ data: empty({ hidden: ['FR'], pressedCountryCount: 1 }) })} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Hidden countries' }))
    expect(await screen.findByRole('dialog', { name: 'Hidden countries' })).toBeVisible()
  })

  it('does not replay existing stamps on the first visit', () => {
    const { container } = render(<PassportPage {...ownerProps()} />)
    expect(container.querySelector('[data-impress]')).toBeNull()
  })
})

describe('hidden countries', () => {
  it('lists the hidden names from the owner menu and restores one, then refetches', async () => {
    const user = userEvent.setup()
    mocks.delete.mockResolvedValue({ ok: true, hidden: ['DE'] })
    render(<PassportPage {...ownerProps()} />)
    await user.click(screen.getByRole('button', { name: 'Passport menu' }))
    expect(screen.getByRole('menuitem', { name: 'Edit profile' })).toHaveAttribute(
      'href',
      '/settings',
    )
    expect(screen.getByRole('menuitem', { name: 'View as visitor' })).toHaveAttribute(
      'href',
      '/passport?as=visitor',
    )
    await user.click(screen.getByRole('menuitem', { name: 'Hidden (2)' }))
    const sheet = await screen.findByRole('dialog', { name: 'Hidden countries' })
    expect(within(sheet).getByText('France')).toBeVisible()
    expect(within(sheet).getByText('Germany')).toBeVisible()
    await user.click(within(sheet).getByRole('button', { name: 'Restore France' }))
    await settle()
    expect(mocks.delete).toHaveBeenCalledWith(
      '/api/passport/hidden/FR',
      undefined,
      expect.anything(),
    )
    expect(mocks.get).toHaveBeenCalledWith('/api/passport/countries', undefined, expect.anything())
  })

  it('keeps the list and says so calmly when a restore fails', async () => {
    const user = userEvent.setup()
    mocks.delete.mockRejectedValue(new Error('offline'))
    render(<PassportPage {...ownerProps()} />)
    await user.click(screen.getByRole('button', { name: 'Passport menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Hidden (2)' }))
    const sheet = await screen.findByRole('dialog', { name: 'Hidden countries' })
    await user.click(within(sheet).getByRole('button', { name: 'Restore Germany' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      'Could not restore this country',
    )
    expect(within(sheet).getByText('Germany')).toBeVisible()
  })

  it('adds a country from the owner menu', async () => {
    const user = userEvent.setup()
    render(<PassportPage {...ownerProps()} />)
    await user.click(screen.getByRole('button', { name: 'Passport menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Add country' }))
    expect(await screen.findByRole('dialog', { name: 'Add country' })).toBeVisible()
  })
})

const pressedDetail = (code: string) => ({
  countryCode: code,
  status: 'pressed',
  isClaimed: false,
  groundVisits: [],
  journeys: [],
  suppressed: [],
  airports: [],
  firstVisit: '2026-03-10',
  lastVisit: '2026-03-10',
  totalVisits: 1,
  derivedState: 'ready',
  revision: 3,
  publishedRevision: 3,
  entries: [
    {
      kind: 'flight',
      flightId: 4,
      endpoint: 'destination',
      airport: 'OSL',
      date: '2026-03-10',
      state: 'logged',
    },
  ],
})

describe('hide from passport', () => {
  it('keeps a sheet opened after the hide started when the late response lands', async () => {
    const user = userEvent.setup()
    const put = deferred<unknown>()
    mocks.put.mockReturnValue(put.promise)
    render(<PassportPage {...ownerProps()} />)
    await user.click(screen.getByRole('button', { name: /^Norway/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Norway' })
    reads.get('NO')!.resolve(pressedDetail('NO'))
    await user.click(await within(sheet).findByRole('button', { name: 'Hide from passport' }))
    act(() => window.history.replaceState(null, '', '/passport?country=JP'))
    await act(async () => put.resolve({ ok: true, hidden: ['NO'] }))
    await settle()
    expect(window.location.search).toBe('?country=JP')
    expect(await screen.findByText('Norway hidden from your passport.')).toBeVisible()
  })

  it('hides through PUT, closes the sheet and offers an Undo that restores through DELETE', async () => {
    const user = userEvent.setup()
    mocks.put.mockResolvedValue({ ok: true, hidden: ['NO'] })
    mocks.delete.mockResolvedValue({ ok: true, hidden: [] })
    render(<PassportPage {...ownerProps()} />)
    await user.click(screen.getByRole('button', { name: /^Norway/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Norway' })
    reads.get('NO')!.resolve(pressedDetail('NO'))
    await user.click(await within(sheet).findByRole('button', { name: 'Hide from passport' }))
    expect(mocks.put).toHaveBeenCalledWith('/api/passport/hidden/NO', undefined, expect.anything())
    expect(await screen.findByText('Norway hidden from your passport.')).toBeVisible()
    expect(window.location.search).toBe('')
    expect(mocks.delete).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await settle()
    expect(mocks.delete).toHaveBeenCalledWith(
      '/api/passport/hidden/NO',
      undefined,
      expect.anything(),
    )
  })
})

describe('stamp hero', () => {
  type Transition = (update: () => Promise<void>) => { finished: Promise<void> }
  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition')
  })

  it('runs a pointer open inside a view transition and a keyboard open without one', async () => {
    const user = userEvent.setup()
    mocks.get.mockImplementation(() => new Promise(() => {}))
    const start = vi.fn<Transition>((update) => {
      void update()
      return { finished: Promise.resolve() }
    })
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    render(<PassportPage {...ownerProps()} />)
    const card = screen.getByRole('button', { name: /^Norway/ })
    card.focus()
    await user.keyboard('{Enter}')
    expect(window.location.search).toBe('?country=NO')
    expect(start).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /^Japan/ }))
    await settle()
    expect(start).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe('?country=JP')
    expect(await screen.findByRole('dialog', { name: 'Japan' })).toBeVisible()
  })

  it('marks each pressed card stamp for the Import to Passport hero and leaves awaiting ones out', () => {
    render(<PassportPage {...ownerProps()} />)
    const marked = within(screen.getByRole('list', { name: 'Stamps' }))
      .getAllByRole('button')
      .map((card) =>
        card.querySelector('[data-hero-enter-key]')?.getAttribute('data-hero-enter-key'),
      )
    expect(marked.sort()).toEqual(['GE', 'JP', 'NO'])
    expect(
      within(screen.getByRole('list', { name: 'Awaiting confirmation' })).queryAllByText(
        (_, element) => element?.hasAttribute('data-hero-enter-key') ?? false,
      ),
    ).toHaveLength(0)
  })
})

describe('pending slot navigation', () => {
  it('says it is opening the arrival card while the evidence loads and navigates once however often it is activated', async () => {
    render(<PassportPage {...ownerProps()} />)
    fireEvent.click(pendingLink('Portugal'))
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    expect(screen.getByText('Opening the arrival card for Portugal…')).toBeInTheDocument()
    expect(pendingLink('Portugal')).toHaveAttribute('aria-busy', 'true')
    expect(mocks.get).toHaveBeenCalledWith(
      '/api/passport/countries/PT/stats',
      undefined,
      expect.anything(),
    )
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    await settle()
    expect(mocks.push).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith('/journal?queue=awaiting#arrival-8')
  })

  it('drops the navigation when the page goes away before the evidence arrives', async () => {
    const { unmount } = render(<PassportPage {...ownerProps()} />)
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    unmount()
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    await settle()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('follows only the latest activation', async () => {
    render(<PassportPage {...ownerProps()} />)
    fireEvent.click(pendingLink('Portugal'))
    fireEvent.click(pendingLink('Greece'))
    await settle()
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    reads.get('GR')!.resolve(awaitingDetail('GR', 9))
    await settle()
    expect(mocks.push.mock.calls).toEqual([['/journal?queue=awaiting#arrival-9']])
  })

  it('drops the navigation when the member changes the view meanwhile', async () => {
    render(<PassportPage {...ownerProps()} />)
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    fireEvent.click(screen.getByRole('radio', { name: 'Map' }))
    expect(screen.queryByText('Opening the arrival card for Portugal…')).toBeNull()
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    await settle()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('drops a pending arrival when history traversal supersedes it without unmounting', async () => {
    render(<PassportPage {...ownerProps()} />)
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.queryByText('Opening the arrival card for Portugal…')).toBeNull()
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    await settle()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('does not override another URL change while the lookup is pending', async () => {
    render(<PassportPage {...ownerProps()} />)
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    const before = window.location.href
    try {
      nativeReplace(null, '', '/passport?country=PT')
      reads.get('PT')!.resolve(awaitingDetail('PT', 8))
      await settle()
      expect(mocks.push).not.toHaveBeenCalled()
      expect(screen.queryByText('Opening the arrival card for Portugal…')).toBeNull()
    } finally {
      nativeReplace(null, '', before)
    }
  })

  it('lets a cold shell navigation supersede a pending arrival before its URL commits', async () => {
    render(
      <>
        <PrimaryNav />
        <PassportPage {...ownerProps()} />
      </>,
    )
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
    render(
      <>
        <PrimaryNav />
        <PassportPage {...ownerProps()} />
      </>,
    )
    fireEvent.click(pendingLink('Portugal'))
    await settle()
    fireEvent.click(screen.getByRole('link', { name: /Overview/ }), { ctrlKey: true })
    expect(screen.getByText('Opening the arrival card for Portugal…')).toBeInTheDocument()
    reads.get('PT')!.resolve(awaitingDetail('PT', 8))
    await settle()
    expect(mocks.push.mock.calls).toEqual([['/journal?queue=awaiting#arrival-8']])
  })

  it('leaves modified clicks to the browser', () => {
    render(<PassportPage {...ownerProps()} />)
    const link = pendingLink('Portugal')
    expect(fireEvent.click(link, { metaKey: true })).toBe(true)
    expect(link).toHaveAttribute('href', '/journal?queue=awaiting')
    expect(mocks.get).not.toHaveBeenCalledWith(
      '/api/passport/countries/PT/stats',
      undefined,
      expect.anything(),
    )
  })
})

describe('Cards and Map', () => {
  it('records a view change in browser history without a server navigation', () => {
    render(<PassportPage {...ownerProps()} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Map' }))
    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/passport?view=map')
    expect(mocks.push).not.toHaveBeenCalled()
    expect(screen.getByRole('list', { name: 'Atlas stand-in' })).toBeVisible()
  })

  it('opens the same country sheet from a card by keyboard and returns focus to it', async () => {
    const user = userEvent.setup()
    render(<PassportPage {...ownerProps()} />)
    mocks.get.mockImplementation(() => new Promise(() => {}))
    const card = screen.getByRole('button', { name: /^Norway/ })
    card.focus()
    await user.keyboard('{Enter}')
    expect(window.location.search).toBe('?country=NO')
    expect(await screen.findByRole('dialog', { name: 'Norway' })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(window.location.search).toBe('')
    expect(card).toHaveFocus()
  })
})
