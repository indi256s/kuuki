// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsForm } from './settings-form'
import { ApiError } from '@kuuki/client/apiClient'

const m = vi.hoisted(() => ({ patch: vi.fn(), get: vi.fn(), remove: vi.fn(), post: vi.fn(), refresh: vi.fn(), push: vi.fn(), flights: vi.fn(), exportFlights: vi.fn(), exportClaims: vi.fn(), exportGround: vi.fn(), identity: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh, push: m.push }) }))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {}, withIdentityMutation: m.identity }))
vi.mock('@kuuki/client/apiClient', async original => ({ ...await original<typeof import('@kuuki/client/apiClient')>(), api: { patch: m.patch, get: m.get, delete: m.remove, post: m.post } }))
vi.mock('@kuuki/client/flights', () => ({ getAllFlights: m.flights }))
vi.mock('@kuuki/client/export', () => ({ exportFlights: m.exportFlights, exportClaims: m.exportClaims }))
vi.mock('./ground-export', () => ({ exportGroundVisits: m.exportGround }))
const profile = { id: 'a', username: 'member-a', display_name: 'Original', bio: 'About', home_airport: null, avatar_url: null, gemini_api_key: null, is_public: true, show_on_leaderboards: true, locale: 'en', theme_color: null, created_at: '', updated_at: '' }
const counts = { flights: 12, completed: 10, claims: 2, ground: 1, drafts: 3 }
const mount = (locale: 'en' | 'ru' = 'en', data = counts) => render(<SettingsForm ownerId="a" profile={profile} locale={locale} counts={data} />)
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  m.patch.mockImplementation(async (_path, body) => ({ ...profile, ...body }))
  m.get.mockResolvedValue([]); m.flights.mockResolvedValue([{ id: 1 }]); m.remove.mockResolvedValue({ ok: true })
  m.identity.mockImplementation(async run => run(Symbol('identity')))
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) })
})
describe('Settings work and data outcomes', () => {
  it('keeps unsaved values through a server refresh and a declined owned navigation; saves once and clears the dirty bar', async () => {
    const view = mount()
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Local edit' } })
    view.rerender(<SettingsForm ownerId="a" profile={{ ...profile, display_name: 'Server refresh' }} locale="en" counts={counts} />)
    expect(screen.getByLabelText('Display name')).toHaveValue('Local edit')
    await userEvent.click(screen.getByRole('link', { name: 'Change username' }))
    await userEvent.click(screen.getByRole('button', { name: 'Stay' }))
    expect(m.push).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Display name')).toHaveValue('Local edit')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved.'))
    expect(m.patch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })
  it('preserves dirty values after a save failure and discards only on the explicit action', async () => {
    m.patch.mockRejectedValue(new TypeError('offline')); mount()
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'Unsaved note' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getByLabelText('Bio')).toHaveValue('Unsaved note')
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByLabelText('Bio')).toHaveValue('About')
  })
  it('disables participation with its reason and submits public-off and participation-off together', async () => {
    mount(); await userEvent.click(screen.getByRole('switch', { name: 'Public profile' }))
    expect(screen.getByRole('switch', { name: 'Show on leaderboards when eligible' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Make your profile public first.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(m.patch).toHaveBeenCalled())
    expect(m.patch.mock.calls[0][1]).toMatchObject({ is_public: false, show_on_leaderboards: false })
  })
  it('shows real per-kind counts; failures and empty reads do not consume the allowance, successful downloads do', async () => {
    mount(); expect(screen.getByText('Records: 12')).toBeVisible(); expect(screen.getByText('Records: 2')).toBeVisible()
    m.flights.mockRejectedValueOnce(new TypeError('offline'))
    await userEvent.click(screen.getByRole('button', { name: 'Download flights' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not export')
    expect(localStorage.getItem('kuuki-export-count:a')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Download country claims' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No records to export'))
    expect(localStorage.getItem('kuuki-export-count:a')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Download flights' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('CSV files downloaded'))
    expect(m.exportFlights).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('kuuki-export-count:a')!)).toMatchObject({ count: 1 })
  })
  it('honors current legacy usage and announces the daily reset time', async () => {
    localStorage.setItem('kuuki-export-count', JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 5 }))
    localStorage.setItem('kuuki-export-count:b', JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 99 }))
    mount(); expect(await screen.findAllByText('Daily limit reached.')).toHaveLength(3)
    expect(screen.getByText(/Resets.*UTC/)).toHaveTextContent('Remaining: 0')
    await userEvent.click(screen.getByRole('button', { name: 'Download flights' }))
    expect(m.flights).not.toHaveBeenCalled()
  })
  it('does not spend another account’s export allowance and retains successful usage if browser storage fails', async () => {
    localStorage.setItem('kuuki-export-count:b', JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 5 }))
    mount()
    const failedStorage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    try {
      await userEvent.click(screen.getByRole('button', { name: 'Download flights' }))
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('CSV files downloaded'))
      expect(screen.getByText(/Resets.*UTC/)).toHaveTextContent('Remaining: 4')
      expect(JSON.parse(localStorage.getItem('kuuki-export-count:b')!)).toMatchObject({ count: 5 })
    } finally { failedStorage.mockRestore() }
  })
  it('blocks owned links during a pending save without losing the edited field', async () => {
    let reject!: (error: Error) => void
    m.patch.mockReturnValue(new Promise((_resolve, fail) => { reject = fail }))
    mount(); fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Pending edit' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await userEvent.click(screen.getByRole('link', { name: 'Change username' }))
    expect(m.push).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await act(async () => reject(new TypeError('offline')))
    expect(screen.getByLabelText('Display name')).toHaveValue('Pending edit')
  })
  it('renders unknown counts as unavailable, never as an empty account', async () => {
    render(<SettingsForm ownerId="a" profile={profile} locale="en" />)
    expect(screen.getAllByText('Count unavailable')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Download flights' })).not.toHaveAttribute('aria-disabled')
  })
  it('warns for document exits only while dirty', () => {
    mount(); const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false)
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Unsaved' } })
    const dirty = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(dirty); expect(dirty.defaultPrevented).toBe(true)
  })
})
describe.each(['en', 'ru'] as const)('deletion (%s)', locale => {
  const ru = locale === 'ru'
  async function passwordStep() {
    mount(locale); await userEvent.click(screen.getByRole('button', { name: ru ? 'Удалить аккаунт' : 'Delete account' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('12')).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: ru ? 'Продолжить' : 'Continue' }))
    await userEvent.click(within(dialog).getByRole('button', { name: ru ? 'Пропустить' : 'Skip' }))
    await userEvent.type(screen.getByLabelText(ru ? 'Текущий пароль' : 'Current password'), 'password')
    return dialog
  }
  it.each([{ error: new ApiError(401, 'bad', 'INVALID_CREDENTIALS'), en: 'Incorrect password', ru: 'Неверный пароль' }, { error: new ApiError(429, 'limited', 'RATE_LIMIT', { retryAfter: 60 }), en: 'Too many attempts', ru: 'Слишком много попыток' }, { error: new TypeError('offline'), en: 'Deletion is not confirmed', ru: 'Удаление не подтверждено' }])('preserves distinct password/rate/network outcomes: $en', async item => {
    m.remove.mockRejectedValue(item.error); const dialog = await passwordStep()
    await userEvent.keyboard('{Enter}')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(ru ? item.ru : item.en)
    expect(screen.getByLabelText(ru ? 'Текущий пароль' : 'Current password')).toHaveValue('password')
  })
  it('blocks Escape, cancel, and duplicate submission while deleting, then uses the dedicated success target', async () => {
    let resolve!: () => void; m.remove.mockReturnValue(new Promise<void>(done => { resolve = done }))
    const dialog = await passwordStep(); await userEvent.keyboard('{Enter}'); await userEvent.keyboard('{Escape}')
    expect(dialog).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: ru ? 'Отмена' : 'Cancel' }))
    await userEvent.keyboard('{Enter}'); expect(m.remove).toHaveBeenCalledTimes(1)
    await act(async () => resolve())
    expect(m.identity.mock.calls[0][1]).toBe('/account-deleted')
  })
})
