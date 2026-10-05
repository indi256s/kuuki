// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CountryDetail } from '../../server/passport'

const mocks = vi.hoisted(() => ({ get: vi.fn(), unclaim: vi.fn(), deleteVisit: vi.fn(), addVisit: vi.fn(), claim: vi.fn(), acknowledge: vi.fn() }))
vi.mock('../../../../web/src/lib/apiClient', () => ({ api: { get: mocks.get }, getAuthGeneration: () => 1 }))
vi.mock('../../../../web/src/lib/passport', () => ({ unclaimCountry: mocks.unclaim, deleteGroundVisit: mocks.deleteVisit, addGroundVisit: mocks.addVisit, claimCountry: mocks.claim }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../write-feedback', () => ({ useWriteFeedback: () => ({ acknowledge: mocks.acknowledge, status: 'ready' }) }))

const { CountrySheet, removalCopy } = await import('./country-sheet')
const { countryNamer, removalOutcome } = await import('./model')

const detail = (patch: Partial<CountryDetail>): CountryDetail => ({
  countryCode: 'GR', countryName: '', status: 'pressed', region: 'europe', firstVisit: '2024-05-01', lastVisit: '2025-07-02', totalVisits: 3,
  airports: [{ iata: 'ATH', name: 'ATH', city: 'Athens', visitCount: 1 }], isClaimed: true,
  groundVisits: [{ id: 'g1', countryCode: 'GR', visitYear: 2018, entryMethod: 'sea', note: 'Ferry from Bari', createdAt: '' }, { id: 'g2', countryCode: 'GR', visitYear: null, entryMethod: null, note: null, createdAt: '' }],
  flightIds: [7],
  entries: [
    { kind: 'flight', flightId: 7, endpoint: 'destination', airport: 'ATH', date: '2025-07-02', state: 'logged' },
    { kind: 'claim', claimedAt: '2024-01-01' },
    { kind: 'ground', id: 'g1', visitYear: 2018, entryMethod: 'sea' },
    { kind: 'ground', id: 'g2', visitYear: null, entryMethod: null },
  ],
  suppressed: [],
  derivedState: 'ready', revision: 3, publishedRevision: 3,
  ...patch,
} as CountryDetail)

function mount(value: CountryDetail, props: { onRemoved?: (code: string) => void; onChanged?: () => void; locale?: 'en' | 'ru' } = {}) {
  mocks.get.mockResolvedValue(value)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const locale = props.locale ?? 'en'
  return render(<QueryClientProvider client={client}>
    <CountrySheet ownerId="owner" locale={locale} code={value.countryCode} entry={undefined} mobile={false} awaiting={[]} name={countryNamer(locale)}
      onClose={() => {}} onChanged={props.onChanged ?? (() => {})} onRemoved={props.onRemoved ?? (() => {})} />
  </QueryClientProvider>)
}

beforeEach(() => { vi.clearAllMocks() })

describe('CountrySheet', () => {
  it('lists source flights as journal links, ground visits, airports and the add-visit form', async () => {
    mount(detail({}))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    expect(await within(dialog).findByRole('link', { name: /arrived at ATH/ })).toHaveAttribute('href', '/journal?flight=7')
    expect(within(dialog).getByText('2018 · by sea')).toBeInTheDocument()
    expect(within(dialog).getByText(/Ferry from Bari/)).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'ATH · Athens' })).toHaveAttribute('href', '/journal?airport=ATH')
    expect(within(dialog).getByRole('radiogroup', { name: 'How you entered' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Add visit' })).toBeInTheDocument()
  })

  it('states exactly what removal deletes and that flights keep the stamp, then removes claim and visits', async () => {
    const user = userEvent.setup()
    mocks.unclaim.mockResolvedValue({ ok: true, derived_state: 'ready', revision: 4 })
    const onRemoved = vi.fn()
    mount(detail({}), { onRemoved })
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    const copy = 'This deletes your claim and 2 land and sea visits. Flights in your journal are not deleted. Flights still reach this country, so its stamp stays.'
    expect(await within(dialog).findByText(copy)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Remove country' }))
    const confirm = await screen.findByRole('dialog', { name: 'Remove Greece from your passport?' })
    expect(within(confirm).getByText(copy)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Remove country' }))
    await waitFor(() => expect(mocks.unclaim).toHaveBeenCalledWith('owner', 'GR'))
    expect(mocks.acknowledge).toHaveBeenCalledWith({ ok: true, derived_state: 'ready', revision: 4 })
    // Flights keep the country pressed: the sheet stays on it instead of announcing a removal.
    expect(onRemoved).not.toHaveBeenCalled()
  })

  it('reports a removed country when nothing else supports it', async () => {
    const user = userEvent.setup()
    mocks.unclaim.mockResolvedValue({ ok: true, derived_state: 'ready', revision: 4 })
    const onRemoved = vi.fn()
    mount(detail({ entries: [{ kind: 'claim', claimedAt: null }], groundVisits: [], airports: [], flightIds: [], firstVisit: '', lastVisit: '', totalVisits: 0 }), { onRemoved })
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    expect(await within(dialog).findByText('This deletes your claim. Flights in your journal are not deleted. The stamp disappears from your passport.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Remove country' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Remove Greece from your passport?' })).getByRole('button', { name: 'Remove country' }))
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith('GR'))
  })

  it('deletes one ground visit through its menu and a confirmation', async () => {
    const user = userEvent.setup()
    mocks.deleteVisit.mockResolvedValue({ ok: true, derived_state: 'ready', revision: 4 })
    mount(detail({}))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    await user.click(await within(dialog).findByRole('button', { name: 'Actions for visit 2018 · by sea' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete visit' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete the 2018 visit?' })
    expect(within(confirm).getByText("Only this visit is deleted. The rest of this country's record stays.")).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Delete visit' }))
    await waitFor(() => expect(mocks.deleteVisit).toHaveBeenCalledWith('owner', 'g1'))
  })

  it('offers no direct removal for a flight-only stamp and points to the Journal', async () => {
    mount(detail({ isClaimed: false, groundVisits: [], entries: [{ kind: 'flight', flightId: 7, endpoint: 'destination', airport: 'ATH', date: '2025-07-02', state: 'logged' }] }))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    expect(await within(dialog).findByText(/Flights press this stamp/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Remove country' })).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Claim without a visit' })).toBeInTheDocument()
  })

  it('dates a country known only from land and sea visits by their years', async () => {
    mount(detail({ firstVisit: null as unknown as string, lastVisit: null as unknown as string, isClaimed: false, flightIds: [], airports: [],
      groundVisits: [{ id: 'g1', countryCode: 'GR', visitYear: 2021, entryMethod: 'sea', note: null, createdAt: '' }, { id: 'g3', countryCode: 'GR', visitYear: 2019, entryMethod: 'land', note: null, createdAt: '' }],
      entries: [{ kind: 'ground', id: 'g1', visitYear: 2021, entryMethod: 'sea' }, { kind: 'ground', id: 'g3', visitYear: 2019, entryMethod: 'land' }] }))
    const dialog = await screen.findByRole('dialog', { name: 'Greece' })
    expect((await within(dialog).findByText('First visit')).nextElementSibling).toHaveTextContent(/^2019$/)
    expect(within(dialog).getByText('Last visit').nextElementSibling).toHaveTextContent(/^2021$/)
  })

  it('never opens an actionable sheet for a code outside the catalog', async () => {
    mount(detail({ countryCode: 'ZZ', status: 'none' as CountryDetail['status'], entries: [], groundVisits: [], airports: [], isClaimed: false }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Claim without a visit' })).toBeNull()
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('shows transit-suppressed endpoints as connections, not visits', async () => {
    mount(detail({ suppressed: [{ flightId: 9, endpoint: 'destination', airport: 'ATH' }] }))
    const list = await screen.findByRole('list', { name: 'Connections not counted as a visit' })
    expect(within(list).getByRole('link', { name: 'ATH' })).toHaveAttribute('href', '/journal?flight=9')
  })
})

describe('CountrySheet in Russian', () => {
  it('names the close button of both destructive confirmations in Russian', async () => {
    const user = userEvent.setup()
    mount(detail({}), { locale: 'ru' })
    const dialog = await screen.findByRole('dialog', { name: 'Греция' })
    await user.click(await within(dialog).findByRole('button', { name: 'Действия: визит 2018 · по морю' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Удалить визит' }))
    const deleteVisit = await screen.findByRole('dialog', { name: 'Удалить визит 2018 года?' })
    expect(within(deleteVisit).getByRole('button', { name: 'Закрыть' })).toBeInTheDocument()
    expect(within(deleteVisit).queryByRole('button', { name: 'Close' })).toBeNull()
    await user.click(within(deleteVisit).getByRole('button', { name: 'Отмена' }))
    await user.click(within(dialog).getByRole('button', { name: 'Удалить страну' }))
    const remove = await screen.findByRole('dialog', { name: 'Удалить из паспорта: Греция?' })
    expect(within(remove).getByRole('button', { name: 'Закрыть' })).toBeInTheDocument()
    expect(within(remove).queryByRole('button', { name: 'Close' })).toBeNull()
  })
})

describe('removalCopy', () => {
  it('is precise in Russian too', () => {
    const outcome = removalOutcome({ entries: [{ kind: 'ground', id: 'a', visitYear: 2018, entryMethod: 'land' }, { kind: 'flight', flightId: 1, endpoint: 'destination', airport: 'ATH', date: '2026-01-01', state: 'awaiting' }] })
    expect(removalCopy('ru', outcome)).toBe('Будет удалён 1 визит по суше или морю. Перелёты в журнале не удаляются. Останется только неподтверждённый перелёт: страна будет ждать отметки.')
  })
})
