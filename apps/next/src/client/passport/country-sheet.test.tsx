// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CountryDetail } from '../../server/passport'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  unclaim: vi.fn(),
  deleteVisit: vi.fn(),
  addVisit: vi.fn(),
  updateVisit: vi.fn(),
  claim: vi.fn(),
  acknowledge: vi.fn(),
}))
vi.mock('@kuuki/client/apiClient', () => ({
  api: { get: mocks.get, put: mocks.put },
  getAuthGeneration: () => 1,
}))
vi.mock('@kuuki/client/passport', () => ({
  unclaimCountry: mocks.unclaim,
  deleteGroundVisit: mocks.deleteVisit,
  addGroundVisit: mocks.addVisit,
  updateGroundVisit: mocks.updateVisit,
  claimCountry: mocks.claim,
}))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../write-feedback', () => ({
  useWriteFeedback: () => ({ acknowledge: mocks.acknowledge, status: 'ready' }),
}))

const { CountrySheet, removalCopy } = await import('./country-sheet')
const { countryNamer, passportEntries, removalOutcome } = await import('./model')

const detail = (patch: Partial<CountryDetail>): CountryDetail =>
  ({
    countryCode: 'GR',
    countryName: '',
    status: 'pressed',
    region: 'europe',
    firstVisit: '2024-05-01',
    lastVisit: '2025-07-02',
    totalVisits: 3,
    airports: [{ iata: 'ATH', name: 'ATH', city: 'Athens', visitCount: 1 }],
    isClaimed: true,
    groundVisits: [
      {
        id: 'g1',
        countryCode: 'GR',
        visitYear: 2018,
        entryMethod: 'sea',
        mode: null,
        note: 'Ferry from Bari',
        createdAt: '',
      },
      {
        id: 'g2',
        countryCode: 'GR',
        visitYear: null,
        entryMethod: null,
        mode: null,
        note: null,
        createdAt: '',
      },
    ],
    flightIds: [7],
    entries: [
      {
        kind: 'flight',
        flightId: 7,
        endpoint: 'destination',
        airport: 'ATH',
        date: '2025-07-02',
        state: 'logged',
      },
      { kind: 'claim', claimedAt: '2024-01-01' },
      { kind: 'ground', id: 'g1', visitYear: 2018, entryMethod: 'sea', mode: null },
      { kind: 'ground', id: 'g2', visitYear: null, entryMethod: null, mode: null },
    ],
    suppressed: [],
    journeys: [],
    derivedState: 'ready',
    revision: 3,
    publishedRevision: 3,
    ...patch,
  }) as CountryDetail

function mount(
  value: CountryDetail,
  props: {
    onRemoved?: (code: string) => void
    onChanged?: () => void
    onHidden?: (code: string) => void
    locale?: 'en' | 'ru'
  } = {},
) {
  mocks.get.mockResolvedValue(value)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const locale = props.locale ?? 'en'
  return render(
    <QueryClientProvider client={client}>
      <CountrySheet
        ownerId="owner"
        locale={locale}
        code={value.countryCode}
        entry={undefined}
        publishedRevision={3}
        mobile={false}
        name={countryNamer(locale)}
        onClose={() => {}}
        onChanged={props.onChanged ?? (() => {})}
        onRemoved={props.onRemoved ?? (() => {})}
        onHidden={props.onHidden ?? (() => {})}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

type User = ReturnType<typeof userEvent.setup>

/** A country already in the passport keeps its add form closed until Add visit opens it. */
async function openForm(user: User, dialog: HTMLElement) {
  await user.click(await within(dialog).findByRole('button', { name: 'Add visit' }))
  return within(dialog).findByRole('textbox', { name: /^Year/ })
}

async function countryAction(user: User, dialog: HTMLElement, name: string) {
  await user.click(await within(dialog).findByRole('button', { name: 'Country actions' }))
  await user.click(await screen.findByRole('menuitem', { name }))
}

describe('CountrySheet', () => {
  it('lists source flights as journal links, ground visits, airports and Add visit', async () => {
    mount(detail({}))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    expect(await within(dialog).findByRole('link', { name: /arrived at ATH/ })).toHaveAttribute(
      'href',
      '/journal?flight=7',
    )
    expect(within(dialog).getByText('2018 · by sea')).toBeInTheDocument()
    expect(within(dialog).getByText(/Ferry from Bari/)).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'ATH · Athens' })).toHaveAttribute(
      'href',
      '/journal?airport=ATH',
    )
    // The record comes first: the add form waits behind its button.
    expect(within(dialog).getByRole('button', { name: 'Add visit' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('radiogroup', { name: 'How you entered' })).toBeNull()
  })

  it('lists ground journeys apart from flights and manual visits, each linking to the Ground travel page', async () => {
    mount(
      detail({
        journeys: [
          {
            id: 'j-rail',
            mode: 'rail',
            title: 'Alps loop',
            startDate: '2026-03-02',
            endDate: '2026-03-09',
            route: 'Zurich → Milan',
          },
          {
            id: 'j-road',
            mode: 'road',
            title: null,
            startDate: null,
            endDate: null,
            route: 'Athens → Delphi',
          },
        ],
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    const list = await within(dialog).findByRole('list', { name: 'Ground journeys' })
    const links = within(list).getAllByRole('link')
    expect(links[0]).toHaveTextContent('Alps loop · Mar 2, 2026 – Mar 9, 2026')
    expect(links[0]).toHaveAttribute('href', '/ground-travel?journey=j-rail')
    expect(links[1]).toHaveTextContent('Athens → Delphi · date unknown')
    expect(links[1]).toHaveAttribute('href', '/ground-travel?journey=j-road')
    // Journeys are not manual visits: the manual list and the "Visits" count stay as they were.
    expect(within(dialog).getByRole('heading', { name: 'Visits · 3' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Ground journeys · 2' })).toBeInTheDocument()
    expect(within(list).queryByText(/by sea|Year not set/)).toBeNull()
  })

  it('counts ground journeys for a pressed country without manual visits', () => {
    const [entry] = passportEntries({
      countries: [
        {
          country_code: 'CH',
          status: 'pressed',
          logged_visit_count: 0,
          awaiting_visit_count: 0,
          claimed: 0,
          ground_visit_count: 0,
          ground_journey_count: 2,
          first_visit: null,
          last_visit: null,
          region: 'europe',
        },
      ],
      groundVisits: [],
    })
    expect(entry).toMatchObject({ status: 'pressed', visits: 2, sources: [] })
  })

  it('says ground journeys keep the stamp when a claim and manual visits are removed', () => {
    const outcome = removalOutcome({
      entries: [{ kind: 'claim', claimedAt: '2024-01-01' }] as CountryDetail['entries'],
      groundVisits: [],
      journeys: [{ id: 'j' }] as CountryDetail['journeys'],
    })
    expect(outcome).toMatchObject({ after: 'pressed', journeys: 1 })
    expect(removalCopy('en', outcome)).toContain('Ground journeys still reach this country')
  })

  it('states exactly what removal deletes and that flights keep the stamp, then removes claim and visits', async () => {
    const user = userEvent.setup()
    mocks.unclaim.mockResolvedValue({ ok: true, derived_state: 'ready', revision: 4 })
    const onRemoved = vi.fn()
    mount(detail({}), { onRemoved })
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    const copy =
      'This deletes your claim and 2 manual visits. Flights in your journal are not deleted. Flights still reach this country, so its stamp stays.'
    await countryAction(user, dialog, 'Remove country…')
    const confirm = await screen.findByRole('dialog', { name: 'Remove Greece from your passport?' })
    expect(within(confirm).getByText(copy)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Remove country' }))
    await waitFor(() => expect(mocks.unclaim).toHaveBeenCalledWith('owner', 'GR'))
    expect(mocks.acknowledge).toHaveBeenCalledWith({
      ok: true,
      derived_state: 'ready',
      revision: 4,
    })
    // Flights keep the country pressed: the sheet stays on it instead of announcing a removal.
    expect(onRemoved).not.toHaveBeenCalled()
  })

  it('hides a pressed country without a confirmation and hands the hidden code to the page', async () => {
    const user = userEvent.setup()
    mocks.put.mockResolvedValue({ ok: true })
    const onHidden = vi.fn()
    mount(detail({}), { onHidden })
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await countryAction(user, dialog, 'Hide from passport')
    await waitFor(() => expect(onHidden).toHaveBeenCalledWith('GR'))
    expect(mocks.put).toHaveBeenCalledWith('/api/passport/hidden/GR', undefined, expect.anything())
  })

  it('does not offer Hide for a country that is only awaiting confirmation', async () => {
    const user = userEvent.setup()
    mount(detail({ status: 'pending', entries: [], groundVisits: [], isClaimed: false }))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.click(await within(dialog).findByRole('button', { name: 'Country actions' }))
    expect(await screen.findByRole('menuitem', { name: 'Remove country…' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Hide from passport' })).toBeNull()
  })

  it('reports a removed country when nothing else supports it', async () => {
    const user = userEvent.setup()
    mocks.unclaim.mockResolvedValue({ ok: true, derived_state: 'ready', revision: 4 })
    const onRemoved = vi.fn()
    mount(
      detail({
        entries: [{ kind: 'claim', claimedAt: null }],
        groundVisits: [],
        airports: [],
        flightIds: [],
        firstVisit: '',
        lastVisit: '',
        totalVisits: 0,
      }),
      { onRemoved },
    )
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await countryAction(user, dialog, 'Remove country…')
    const confirm = await screen.findByRole('dialog', { name: 'Remove Greece from your passport?' })
    expect(
      within(confirm).getByText(
        'This deletes your claim. Flights in your journal are not deleted. The stamp disappears from your passport.',
      ),
    ).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Remove country' }))
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith('GR'))
  })

  it('deletes one ground visit from its edit form and a confirmation', async () => {
    const user = userEvent.setup()
    mocks.deleteVisit.mockResolvedValue({ ok: true, derived_state: 'ready', revision: 4 })
    mount(detail({}))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.click(
      await within(dialog).findByRole('button', { name: 'Edit visit: 2018 · by sea' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Delete visit' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete the 2018 visit?' })
    expect(
      within(confirm).getByText(
        "Only this visit is deleted. The rest of this country's record stays.",
      ),
    ).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Delete visit' }))
    await waitFor(() => expect(mocks.deleteVisit).toHaveBeenCalledWith('owner', 'g1'))
  })

  it.each([
    ['By plane', { entryMethod: 'air', mode: null }],
    ['By train', { entryMethod: 'land', mode: 'rail' }],
    ['By car', { entryMethod: 'land', mode: 'road' }],
    ['By sea', { entryMethod: 'sea', mode: null }],
    ['Other', { entryMethod: null, mode: null }],
  ])('records the %s way as its own payload', async (name, payload) => {
    const user = userEvent.setup()
    mocks.addVisit.mockResolvedValue({ ok: true, derived_state: 'ready', revision: 4 })
    mount(detail({}))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await openForm(user, dialog)
    await user.click(within(dialog).getByRole('radio', { name }))
    await user.click(within(dialog).getByRole('button', { name: 'Add visit' }))
    await waitFor(() =>
      expect(mocks.addVisit).toHaveBeenCalledWith('owner', 'GR', {
        visitYear: null,
        note: null,
        ...payload,
      }),
    )
  })

  it('keeps a saved air visit editable and offers the existing flight capture as an optional link', async () => {
    const value = detail({})
    value.groundVisits[0].entryMethod = 'air'
    const row = value.entries.find((item) => item.kind === 'ground' && item.id === 'g1')!
    if (row.kind === 'ground') row.entryMethod = 'air'
    mount(value)
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    expect(await within(dialog).findByRole('link', { name: 'Add flight' })).toHaveAttribute(
      'href',
      '/add?passportVisit=g1',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: /Edit visit: 2018 · by plane/ }),
    )
    expect(within(dialog).getByRole('radio', { name: 'By plane' })).toBeChecked()
    expect(mocks.addVisit).not.toHaveBeenCalled()
  })

  it('includes superseded air records in the destructive removal count', async () => {
    const value = detail({})
    value.groundVisits[0] = { ...value.groundVisits[0], entryMethod: 'air', linkedFlightId: 7 }
    value.entries = value.entries.filter((item) => item.kind !== 'ground' || item.id !== 'g1')
    mount(value)
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await countryAction(userEvent.setup(), dialog, 'Remove country…')
    const confirm = await screen.findByRole('dialog', { name: 'Remove Greece from your passport?' })
    expect(confirm).toHaveTextContent('This deletes your claim and 2 manual visits.')
  })

  it('dates a superseded air visit from the actual arrival rather than its old manual year', async () => {
    const value = detail({ firstVisit: '2025-07-02', lastVisit: '2025-07-02' })
    value.groundVisits = [{ ...value.groundVisits[0], entryMethod: 'air', linkedFlightId: 7 }]
    value.entries = value.entries.filter((item) => item.kind !== 'ground')
    mount(value)
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    expect((await within(dialog).findByText('First visit')).nextElementSibling).toHaveTextContent(
      'Jul 2, 2025',
    )
  })

  it('edits the chosen visit in place and leaves edit mode afterwards', async () => {
    const user = userEvent.setup()
    mocks.updateVisit.mockResolvedValue({ ok: true, derived_state: 'ready', revision: 4 })
    mount(detail({}))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.click(
      await within(dialog).findByRole('button', { name: 'Edit visit: 2018 · by sea' }),
    )
    expect(within(dialog).getByRole('heading', { name: 'Edit visit' })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: /^Year/ })).toHaveValue('2018')
    expect(within(dialog).getByRole('textbox', { name: /^Note/ })).toHaveValue('Ferry from Bari')
    expect(within(dialog).getByRole('radio', { name: 'By sea' })).toBeChecked()
    expect(within(dialog).queryByRole('button', { name: 'Claim without a visit' })).toBeNull()
    await user.clear(within(dialog).getByRole('textbox', { name: /^Year/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Year/ }), '2019')
    await user.click(within(dialog).getByRole('radio', { name: 'By train' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(mocks.updateVisit).toHaveBeenCalledWith('owner', 'g1', {
        visitYear: 2019,
        note: 'Ferry from Bari',
        entryMethod: 'land',
        mode: 'rail',
      }),
    )
    expect(mocks.addVisit).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(within(dialog).queryByRole('heading', { name: 'Edit visit' })).toBeNull(),
    )
    expect(await openForm(user, dialog)).toHaveValue('')
  })

  it('labels a legacy land visit without a mode as by land', async () => {
    mount(
      detail({
        groundVisits: [
          {
            id: 'g3',
            countryCode: 'GR',
            visitYear: 2019,
            entryMethod: 'land',
            mode: null,
            linkedFlightId: null,
            note: null,
            createdAt: '',
          },
        ],
        entries: [{ kind: 'ground', id: 'g3', visitYear: 2019, entryMethod: 'land', mode: null }],
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    expect(await within(dialog).findByText('2019 · by land')).toBeInTheDocument()
  })

  it('blocks removing a flight-only stamp and points to the Journal', async () => {
    const user = userEvent.setup()
    mount(
      detail({
        isClaimed: false,
        groundVisits: [],
        entries: [
          {
            kind: 'flight',
            flightId: 7,
            endpoint: 'destination',
            airport: 'ATH',
            date: '2025-07-02',
            state: 'logged',
          },
        ],
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.click(await within(dialog).findByRole('button', { name: 'Country actions' }))
    expect(
      await screen.findByRole('menuitem', { name: 'Claim without a visit' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Remove country…' }))
    const confirm = await screen.findByRole('dialog', { name: 'Remove Greece from your passport?' })
    expect(within(confirm).getByText('Flights press this stamp.')).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Remove country' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(
      within(confirm).getByText('To remove it, delete or change those flights in the Journal.'),
    ).toBeInTheDocument()
  })

  it('dates a country known only from land and sea visits by their years', async () => {
    mount(
      detail({
        firstVisit: null as unknown as string,
        lastVisit: null as unknown as string,
        isClaimed: false,
        flightIds: [],
        airports: [],
        groundVisits: [
          {
            id: 'g1',
            countryCode: 'GR',
            visitYear: 2021,
            entryMethod: 'sea',
            mode: null,
            linkedFlightId: null,
            note: null,
            createdAt: '',
          },
          {
            id: 'g3',
            countryCode: 'GR',
            visitYear: 2019,
            entryMethod: 'land',
            mode: null,
            linkedFlightId: null,
            note: null,
            createdAt: '',
          },
        ],
        entries: [
          { kind: 'ground', id: 'g1', visitYear: 2021, entryMethod: 'sea', mode: null },
          { kind: 'ground', id: 'g3', visitYear: 2019, entryMethod: 'land', mode: null },
        ],
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    expect((await within(dialog).findByText('First visit')).nextElementSibling).toHaveTextContent(
      /^2019$/,
    )
    expect(within(dialog).getByText('Last visit').nextElementSibling).toHaveTextContent(/^2021$/)
  })

  it('never opens an actionable sheet for a code outside the catalog', async () => {
    mount(
      detail({
        countryCode: 'ZZ',
        status: 'none' as CountryDetail['status'],
        entries: [],
        groundVisits: [],
        airports: [],
        isClaimed: false,
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Claim without a visit' })).toBeNull()
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('shows transit-suppressed endpoints as connections, not visits', async () => {
    mount(detail({ suppressed: [{ flightId: 9, endpoint: 'destination', airport: 'ATH' }] }))
    const list = await screen.findByRole('list', { name: 'Connections not counted as a visit' })
    expect(within(list).getByRole('link', { name: 'ATH' })).toHaveAttribute(
      'href',
      '/journal?flight=9',
    )
  })
})

describe('CountrySheet freshness and failures', () => {
  const none = detail({
    status: 'none' as CountryDetail['status'],
    isClaimed: false,
    entries: [],
    groundVisits: [],
    airports: [],
    flightIds: [],
    firstVisit: null as unknown as string,
    lastVisit: null as unknown as string,
    totalVisits: 0,
  })
  const entry = (status: 'pressed' | 'pending') =>
    passportEntries({
      countries: [
        {
          country_code: 'GR',
          status,
          logged_visit_count: 0,
          awaiting_visit_count: 0,
          claimed: 1,
          ground_visit_count: 0,
          ground_journey_count: 0,
          first_visit: null,
          last_visit: null,
          region: 'europe',
        },
      ],
      groundVisits: [],
    })[0]

  function Harness({
    client,
    publishedRevision,
    pressed,
  }: {
    client: QueryClient
    publishedRevision: number
    pressed: boolean
  }) {
    return (
      <QueryClientProvider client={client}>
        <CountrySheet
          ownerId="owner"
          locale="en"
          code="GR"
          entry={pressed ? entry('pressed') : undefined}
          publishedRevision={publishedRevision}
          mobile={false}
          name={countryNamer('en')}
          onClose={() => {}}
          onChanged={() => {}}
          onRemoved={() => {}}
          onHidden={() => {}}
        />
      </QueryClientProvider>
    )
  }

  it('refreshes an open sheet when publication catches up after a pending write', async () => {
    const user = userEvent.setup()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mocks.get.mockResolvedValueOnce(none)
    mocks.claim.mockResolvedValue({ ok: true, derived_state: 'pending', revision: 4 })
    // The read right after the write still sees the previous publication: the claim is saved, the stamp is not.
    mocks.get.mockResolvedValueOnce({
      ...none,
      isClaimed: true,
      entries: [{ kind: 'claim', claimedAt: '2026-10-05' }],
      revision: 4,
      derivedState: 'pending',
    })
    const { rerender } = render(<Harness client={client} publishedRevision={3} pressed={false} />)
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.click(await within(dialog).findByRole('button', { name: 'Claim without a visit' }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2))
    expect(
      await within(dialog).findByText(
        'Recent changes are still being prepared. This country may lag behind them.',
      ),
    ).toBeInTheDocument()

    // Publication completes and the page refresh delivers a pressed collection entry while the sheet stays open.
    mocks.get.mockResolvedValueOnce(
      detail({
        entries: [{ kind: 'claim', claimedAt: '2026-10-05' }],
        groundVisits: [],
        airports: [],
        flightIds: [],
        revision: 4,
        publishedRevision: 4,
      }),
    )
    rerender(<Harness client={client} publishedRevision={4} pressed />)
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3))
    expect(
      await within(dialog).findByRole('button', { name: 'Country actions' }),
    ).toBeInTheDocument()
    expect(within(dialog).queryByText('Not in your passport yet')).toBeNull()
  })

  it('says when a refresh failed instead of presenting the cached country as current', async () => {
    const user = userEvent.setup()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mocks.get.mockResolvedValueOnce(none)
    mocks.claim.mockResolvedValue({ ok: true, derived_state: 'ready', revision: 4 })
    mocks.get.mockRejectedValueOnce(new Error('offline'))
    render(<Harness client={client} publishedRevision={3} pressed={false} />)
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.click(await within(dialog).findByRole('button', { name: 'Claim without a visit' }))
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent(
      'Could not refresh this country. Showing the last loaded details.',
    )
    mocks.get.mockResolvedValueOnce(
      detail({
        entries: [{ kind: 'claim', claimedAt: '2026-10-05' }],
        groundVisits: [],
        airports: [],
        flightIds: [],
        revision: 4,
        publishedRevision: 4,
      }),
    )
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(
      await within(dialog).findByRole('button', { name: 'Country actions' }),
    ).toBeInTheDocument()
    expect(within(dialog).queryByRole('alert')).toBeNull()
  })

  it('reports failed derived processing as an error with a retry, not as preparation', async () => {
    const user = userEvent.setup()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mocks.get.mockResolvedValueOnce(
      detail({
        revision: 4,
        publishedRevision: 3,
        derivedState: 'error' as CountryDetail['derivedState'],
      }),
    )
    render(<Harness client={client} publishedRevision={3} pressed />)
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent(
      "This country's totals could not be updated. Your visits are saved, but what you see here may be out of date.",
    )
    expect(
      within(dialog).queryByText(
        'Recent changes are still being prepared. This country may lag behind them.',
      ),
    ).toBeNull()
    // Saved evidence stays visible.
    expect(within(dialog).getByText('2018 · by sea')).toBeInTheDocument()
    mocks.get.mockResolvedValueOnce(detail({ revision: 4, publishedRevision: 4 }))
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(within(dialog).queryByRole('alert')).toBeNull())
    expect(mocks.get).toHaveBeenCalledTimes(2)
  })

  it('keeps the form and reports a rejected claim, visit or deletion without refreshing', async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    mocks.claim.mockRejectedValue(new Error('offline'))
    mocks.addVisit.mockRejectedValue(new Error('offline'))
    mocks.deleteVisit.mockRejectedValue(new Error('offline'))
    mount(
      {
        ...detail({}),
        isClaimed: false,
        entries: detail({}).entries.filter((item) => item.kind !== 'claim'),
      },
      { onChanged },
    )
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await countryAction(user, dialog, 'Claim without a visit')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Could not save. Check your connection and try again.',
    )
    await user.type(await openForm(user, dialog), '2020')
    await user.click(within(dialog).getByRole('button', { name: 'Add visit' }))
    await waitFor(() => expect(mocks.addVisit).toHaveBeenCalled())
    expect(within(dialog).getByRole('textbox', { name: /^Year/ })).toHaveValue('2020')
    await user.click(within(dialog).getByRole('button', { name: 'Edit visit: 2018 · by sea' }))
    await user.click(within(dialog).getByRole('button', { name: 'Delete visit' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete the 2018 visit?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete visit' }))
    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      'Could not delete the visit. Try again.',
    )
    expect(onChanged).not.toHaveBeenCalled()
    expect(mocks.acknowledge).not.toHaveBeenCalled()
  })
})

describe('CountrySheet add-visit form during a save', () => {
  const ack = { ok: true, derived_state: 'ready', revision: 4 }
  const france = detail({ countryCode: 'FR' })
  function Switchable({ client, code }: { client: QueryClient; code: string | null }) {
    return (
      <QueryClientProvider client={client}>
        <CountrySheet
          ownerId="owner"
          locale="en"
          code={code}
          entry={undefined}
          publishedRevision={3}
          mobile={false}
          name={countryNamer('en')}
          onClose={() => {}}
          onChanged={() => {}}
          onRemoved={() => {}}
          onHidden={() => {}}
        />
      </QueryClientProvider>
    )
  }
  function held() {
    let release = () => {}
    mocks.addVisit.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(ack)
      }),
    )
    return () => release()
  }

  it('closes the form after a normal save and reopens it empty', async () => {
    const user = userEvent.setup()
    mocks.addVisit.mockResolvedValue(ack)
    mount(detail({}))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.type(await openForm(user, dialog), '2020')
    await user.type(within(dialog).getByRole('textbox', { name: /^Note/ }), 'Corfu')
    await user.click(within(dialog).getByRole('button', { name: 'Add visit' }))
    await waitFor(() => expect(within(dialog).queryByRole('textbox', { name: /^Year/ })).toBeNull())
    expect(await openForm(user, dialog)).toHaveValue('')
    expect(within(dialog).getByRole('textbox', { name: /^Note/ })).toHaveValue('')
  })

  it('keeps a Note typed while the save is in flight and clears the submitted Year', async () => {
    const user = userEvent.setup()
    const release = held()
    mount(detail({}))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.type(await openForm(user, dialog), '2020')
    await user.type(within(dialog).getByRole('textbox', { name: /^Note/ }), 'Corfu')
    await user.click(within(dialog).getByRole('button', { name: 'Add visit' }))
    await waitFor(() => expect(mocks.addVisit).toHaveBeenCalledTimes(1))
    await user.clear(within(dialog).getByRole('textbox', { name: /^Note/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Note/ }), 'Crete')
    release()
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: /^Year/ })).toHaveValue(''),
    )
    expect(within(dialog).getByRole('textbox', { name: /^Note/ })).toHaveValue('Crete')
  })

  it('still clears the saved draft when the save completes while the sheet is closed', async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue(detail({}))
    const release = held()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender } = render(<Switchable client={client} code="GR" />)
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.type(await openForm(user, dialog), '2020')
    await user.type(within(dialog).getByRole('textbox', { name: /^Note/ }), 'Corfu')
    await user.click(within(dialog).getByRole('button', { name: 'Add visit' }))
    await waitFor(() => expect(mocks.addVisit).toHaveBeenCalledTimes(1))
    rerender(<Switchable client={client} code={null} />)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Greece' })).toBeNull())
    release()
    await waitFor(() => expect(mocks.acknowledge).toHaveBeenCalled())
    rerender(<Switchable client={client} code="GR" />)
    const reopened = await screen.findByRole('dialog', { name: 'Greece' })
    expect(await openForm(user, reopened)).toHaveValue('')
    expect(within(reopened).getByRole('textbox', { name: /^Note/ })).toHaveValue('')
  })

  it('keeps the draft of another country opened while the save is in flight', async () => {
    const user = userEvent.setup()
    mocks.get.mockImplementation(async (url: string) =>
      url.includes('/FR/') ? france : detail({}),
    )
    const release = held()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender } = render(<Switchable client={client} code="GR" />)
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.type(await openForm(user, dialog), '2020')
    await user.type(within(dialog).getByRole('textbox', { name: /^Note/ }), 'Corfu')
    await user.click(within(dialog).getByRole('button', { name: 'Add visit' }))
    await waitFor(() => expect(mocks.addVisit).toHaveBeenCalledTimes(1))
    rerender(<Switchable client={client} code="FR" />)
    const next = await screen.findByRole('dialog', { name: 'France' })
    await user.type(await openForm(user, next), '2021')
    await user.type(within(next).getByRole('textbox', { name: /^Note/ }), 'Paris')
    release()
    await waitFor(() => expect(mocks.acknowledge).toHaveBeenCalled())
    expect(within(next).getByRole('textbox', { name: /^Year/ })).toHaveValue('2021')
    expect(within(next).getByRole('textbox', { name: /^Note/ })).toHaveValue('Paris')
  })

  it('closes an edit whose visit disappeared in a refetch', async () => {
    const user = userEvent.setup()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mocks.get.mockResolvedValue(detail({}))
    render(<Switchable client={client} code="GR" />)
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.click(
      await within(dialog).findByRole('button', { name: 'Edit visit: 2018 · by sea' }),
    )
    expect(within(dialog).getByRole('heading', { name: 'Edit visit' })).toBeInTheDocument()
    mocks.get.mockResolvedValue(
      detail({
        groundVisits: detail({}).groundVisits.filter((visit) => visit.id !== 'g1'),
        entries: detail({}).entries.filter((item) => !('id' in item) || item.id !== 'g1'),
      }),
    )
    await client.invalidateQueries()
    await waitFor(() =>
      expect(within(dialog).queryByRole('button', { name: /Edit visit: 2018/ })).toBeNull(),
    )
    expect(within(dialog).queryByRole('heading', { name: 'Edit visit' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Save changes' })).toBeNull()
  })

  it('does not start a save while a hide is in flight', async () => {
    const user = userEvent.setup()
    mocks.put.mockReturnValue(new Promise(() => {}))
    mount(detail({}))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.type(await openForm(user, dialog), '2020')
    await countryAction(user, dialog, 'Hide from passport')
    await waitFor(() => expect(mocks.put).toHaveBeenCalled())
    await user.click(within(dialog).getByRole('button', { name: 'Add visit' }))
    expect(mocks.addVisit).not.toHaveBeenCalled()
  })

  it('does not carry a save in flight over to the next country', async () => {
    const user = userEvent.setup()
    mocks.get.mockImplementation(async (url: string) =>
      url.includes('/FR/') ? france : detail({}),
    )
    held()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender } = render(<Switchable client={client} code="GR" />)
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.type(await openForm(user, dialog), '2020')
    await user.click(within(dialog).getByRole('button', { name: 'Add visit' }))
    await waitFor(() => expect(mocks.addVisit).toHaveBeenCalledTimes(1))
    rerender(<Switchable client={client} code="FR" />)
    const next = await screen.findByRole('dialog', { name: 'France' })
    await openForm(user, next)
    expect(within(next).queryByRole('button', { name: 'Saving…' })).toBeNull()
    expect(within(next).getByRole('button', { name: 'Add visit' })).toBeEnabled()
  })

  it('does not let a save from an earlier visit to the country unlock a newer save', async () => {
    const user = userEvent.setup()
    mocks.get.mockImplementation(async (url: string) =>
      url.includes('/FR/') ? france : detail({}),
    )
    let releaseFirst = () => {}
    mocks.addVisit
      .mockReturnValueOnce(new Promise((resolve) => (releaseFirst = () => resolve(ack))))
      .mockReturnValueOnce(new Promise(() => {}))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender } = render(<Switchable client={client} code="GR" />)
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.type(await openForm(user, dialog), '2020')
    await user.click(within(dialog).getByRole('button', { name: 'Add visit' }))
    await waitFor(() => expect(mocks.addVisit).toHaveBeenCalledTimes(1))
    rerender(<Switchable client={client} code="FR" />)
    await screen.findByRole('dialog', { name: 'France' })
    rerender(<Switchable client={client} code="GR" />)
    const again = await screen.findByRole('dialog', { name: 'Greece' })
    await user.type(await openForm(user, again), '2021')
    await user.click(within(again).getByRole('button', { name: 'Add visit' }))
    await waitFor(() => expect(mocks.addVisit).toHaveBeenCalledTimes(2))
    await act(async () => releaseFirst())
    expect(within(again).getByRole('button', { name: 'Saving…' })).toBeInTheDocument()
  })
})

describe('CountrySheet in Russian', () => {
  it('reaches both destructive confirmations through Russian controls', async () => {
    const user = userEvent.setup()
    mount(detail({}), { locale: 'ru' })
    const dialog = await screen.findByRole('dialog', { name: 'Греция' })
    await user.click(
      await within(dialog).findByRole('button', { name: 'Изменить визит: 2018 · морем' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Удалить визит' }))
    const deleteVisit = await screen.findByRole('dialog', { name: 'Удалить визит 2018 года?' })
    await user.click(within(deleteVisit).getByRole('button', { name: 'Отмена' }))
    await user.click(within(dialog).getByRole('button', { name: 'Действия со страной' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Удалить страну…' }))
    const remove = await screen.findByRole('dialog', { name: 'Удалить из паспорта: Греция?' })
    expect(within(remove).getByRole('button', { name: 'Отмена' })).toBeInTheDocument()
  })
})

describe('CountrySheet derived failure in Russian', () => {
  it('states the failure and offers a retry in Russian', async () => {
    mount(
      detail({
        revision: 4,
        publishedRevision: 3,
        derivedState: 'error' as CountryDetail['derivedState'],
      }),
      { locale: 'ru' },
    )
    const alert = await within(await screen.findByRole('dialog', { name: 'Греция' })).findByRole(
      'alert',
    )
    expect(alert).toHaveTextContent(
      'Не удалось обновить итоги по стране. Визиты сохранены, но данные здесь могут быть устаревшими.',
    )
    expect(within(alert).getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })
})

describe('CountrySheet ground journeys in Russian', () => {
  it('labels ground journeys and unknown dates in Russian', async () => {
    mount(
      detail({
        journeys: [
          {
            id: 'j1',
            mode: 'rail',
            title: null,
            startDate: null,
            endDate: null,
            route: '',
          },
        ],
      }),
      { locale: 'ru' },
    )
    const list = await screen.findByRole('list', { name: 'Наземные поездки' })
    expect(within(list).getByRole('link')).toHaveTextContent('Поездка на поезде · дата неизвестна')
  })
})

describe('removalCopy', () => {
  it('is precise in Russian too', () => {
    const outcome = removalOutcome({
      groundVisits: [{ ...detail({}).groundVisits[0], id: 'a', entryMethod: 'land' }],
      entries: [
        { kind: 'ground', id: 'a', visitYear: 2018, entryMethod: 'land', mode: null },
        {
          kind: 'flight',
          flightId: 1,
          endpoint: 'destination',
          airport: 'ATH',
          date: '2026-01-01',
          state: 'awaiting',
        },
      ],
    })
    expect(removalCopy('ru', outcome)).toBe(
      'Будет удалён 1 ручной визит. Перелёты в журнале не удаляются. Останется только неподтверждённый перелёт: страна будет ждать отметки.',
    )
  })
})
