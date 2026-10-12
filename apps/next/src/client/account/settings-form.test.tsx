// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsForm } from './settings-form'
import { ApiError, advanceAuthGeneration } from '@kuuki/client/apiClient'

const m = vi.hoisted(() => ({
  patch: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  post: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  flights: vi.fn(),
  exportFlights: vi.fn(),
  exportClaims: vi.fn(),
  exportGround: vi.fn(),
  identity: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh, push: m.push }) }))
vi.mock('../activity', () => ({
  trackPrivateOperation: () => () => {},
  withIdentityMutation: m.identity,
}))
vi.mock('@kuuki/client/apiClient', async (original) => ({
  ...(await original<typeof import('@kuuki/client/apiClient')>()),
  api: { patch: m.patch, get: m.get, delete: m.remove, post: m.post },
}))
vi.mock('@kuuki/client/flights', () => ({ getAllFlights: m.flights }))
vi.mock('@kuuki/client/export', () => ({
  exportFlights: m.exportFlights,
  exportClaims: m.exportClaims,
}))
vi.mock('./ground-export', () => ({ exportGroundVisits: m.exportGround }))
const profile = {
  id: 'a',
  username: 'member-a',
  display_name: 'Original',
  bio: 'About',
  home_airport: null,
  avatar_url: null,
  gemini_api_key: null,
  is_public: true,
  show_on_leaderboards: true,
  locale: 'en',
  theme_color: null,
  created_at: '',
  onboarded_at: '2026-01-01T00:00:00.000Z',
  updated_at: '',
}
const counts = { flights: 12, completed: 10, claims: 2, ground: 1, drafts: 3 }
const mount = (locale: 'en' | 'ru' = 'en', data = counts) =>
  render(<SettingsForm ownerId="a" profile={profile} locale={locale} counts={data} />)
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  m.patch.mockImplementation(async (_path, body) => ({ ...profile, ...body }))
  m.get.mockResolvedValue([])
  m.flights.mockResolvedValue([{ id: 1 }])
  m.remove.mockResolvedValue({ ok: true })
  m.identity.mockImplementation(async (run) => run(Symbol('identity')))
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
})
describe('Settings work and data outcomes', () => {
  it('keeps unsaved values through a server refresh and a declined owned navigation; saves once and clears the dirty bar', async () => {
    const view = mount()
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Local edit' } })
    view.rerender(
      <SettingsForm
        ownerId="a"
        profile={{ ...profile, display_name: 'Server refresh' }}
        locale="en"
        counts={counts}
      />,
    )
    expect(screen.getByLabelText('Display name')).toHaveValue('Local edit')
    await userEvent.click(screen.getByRole('link', { name: 'View my profile' }))
    await userEvent.click(screen.getByRole('button', { name: 'Stay' }))
    expect(m.push).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Display name')).toHaveValue('Local edit')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved.'))
    expect(m.patch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })
  it('preserves dirty values after a save failure and discards only on the explicit action', async () => {
    m.patch.mockRejectedValue(new TypeError('offline'))
    mount()
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'Unsaved note' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getByLabelText('Bio')).toHaveValue('Unsaved note')
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByLabelText('Bio')).toHaveValue('About')
  })
  it('disables participation with its reason and submits public-off and participation-off together', async () => {
    mount()
    await userEvent.click(screen.getByRole('switch', { name: 'Public profile' }))
    expect(
      screen.getByRole('switch', { name: 'Show on leaderboards when eligible' }),
    ).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Make your profile public first.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(m.patch).toHaveBeenCalled())
    expect(m.patch.mock.calls[0][1]).toMatchObject({
      is_public: false,
      show_on_leaderboards: false,
    })
  })
  it('shows real per-kind counts; failures and empty reads do not consume the allowance, successful downloads do', async () => {
    mount()
    expect(screen.getByText('Records: 12')).toBeVisible()
    expect(screen.getByText('Records: 2')).toBeVisible()
    m.flights.mockRejectedValueOnce(new TypeError('offline'))
    await userEvent.click(screen.getByRole('button', { name: 'Download flights' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not export')
    expect(localStorage.getItem('kuuki-export-count:a')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Download country claims' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('No records to export'),
    )
    expect(localStorage.getItem('kuuki-export-count:a')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Download flights' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('CSV files downloaded'),
    )
    expect(m.exportFlights).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('kuuki-export-count:a')!)).toMatchObject({ count: 1 })
  })
  it('honors current legacy usage and announces the daily reset time', async () => {
    localStorage.setItem(
      'kuuki-export-count',
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 5 }),
    )
    localStorage.setItem(
      'kuuki-export-count:b',
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 99 }),
    )
    mount()
    expect(await screen.findAllByText('Daily limit reached.')).toHaveLength(3)
    expect(screen.getByText(/Resets.*UTC/)).toHaveTextContent('Remaining: 0')
    await userEvent.click(screen.getByRole('button', { name: 'Download flights' }))
    expect(m.flights).not.toHaveBeenCalled()
  })
  it('does not spend another account’s export allowance and retains successful usage if browser storage fails', async () => {
    localStorage.setItem(
      'kuuki-export-count:b',
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 5 }),
    )
    mount()
    const failedStorage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      await userEvent.click(screen.getByRole('button', { name: 'Download flights' }))
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('CSV files downloaded'),
      )
      expect(screen.queryByText(/Resets.*UTC/)).not.toBeInTheDocument()
      expect(JSON.parse(localStorage.getItem('kuuki-export-count:b')!)).toMatchObject({ count: 5 })
    } finally {
      failedStorage.mockRestore()
    }
  })
  it('blocks owned links during a pending save without losing the edited field', async () => {
    let reject!: (error: Error) => void
    m.patch.mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail
      }),
    )
    mount()
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Pending edit' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await userEvent.click(screen.getByRole('link', { name: 'View my profile' }))
    expect(m.push).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await act(async () => reject(new TypeError('offline')))
    expect(screen.getByLabelText('Display name')).toHaveValue('Pending edit')
  })
  it('renders unknown counts as unavailable, never as an empty account', async () => {
    render(<SettingsForm ownerId="a" profile={profile} locale="en" />)
    expect(screen.getAllByText('Count unavailable')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Download flights' })).not.toHaveAttribute(
      'aria-disabled',
    )
  })
  it('warns for document exits only while dirty', () => {
    mount()
    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Unsaved' } })
    const dirty = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)
  })
})
describe('Settings name and address', () => {
  const edit = () => userEvent.click(screen.getByRole('button', { name: 'Edit' }))
  it('caps the name at 40 characters', () => {
    mount()
    expect(screen.getByLabelText('Display name')).toHaveAttribute('maxlength', '40')
  })
  it('leaves an unchanged legacy long name out of an unrelated save', async () => {
    const legacy = 'A'.repeat(60)
    render(
      <SettingsForm
        ownerId="a"
        profile={{ ...profile, display_name: legacy }}
        locale="en"
        counts={counts}
      />,
    )
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'New bio' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(m.patch).toHaveBeenCalled())
    expect(m.patch.mock.calls[0][1]).not.toHaveProperty('display_name')
    expect(m.patch.mock.calls[0][1]).toMatchObject({ bio: 'New bio' })
  })
  it('sends an edited address as username on save', async () => {
    m.get.mockResolvedValue({ available: true, valid: true })
    mount()
    await edit()
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: ' New-Slug ' } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    )
    expect(m.get).toHaveBeenCalledWith(
      '/api/profiles/check-username',
      { username: 'new-slug' },
      expect.anything(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(m.patch).toHaveBeenCalled())
    expect(m.patch.mock.calls[0][1]).toMatchObject({ username: 'new-slug' })
  })
  it('marks a 409 as taken and keeps the typed slug', async () => {
    m.get.mockResolvedValue({ available: true, valid: true })
    m.patch.mockRejectedValue(new ApiError(409, 'taken', 'USERNAME_TAKEN'))
    mount()
    await edit()
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'busy-slug' } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('That address is taken.')).toBeVisible()
    expect(screen.getByLabelText('Address')).toHaveValue('busy-slug')
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
  it('blocks save with a reason while the address is invalid', async () => {
    mount()
    await edit()
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'a!' } })
    expect(screen.getByText('Use letters, numbers and hyphens, 3 to 30 characters.')).toBeVisible()
    expect(screen.getByText('Fix the address to save.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(m.patch).not.toHaveBeenCalled()
  })
  it('tells a member without an address it comes from the name, with no profile link', () => {
    render(
      <SettingsForm
        ownerId="a"
        profile={{ ...profile, username: null }}
        locale="en"
        counts={counts}
      />,
    )
    expect(screen.getByText('Your address is set from your name when you save.')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'View my profile' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible()
  })
  it('never links to the retired onboarding page', () => {
    const view = mount()
    expect(view.container.querySelector('a[href*="onboarding"]')).toBeNull()
    view.unmount()
    const bare = render(
      <SettingsForm
        ownerId="a"
        profile={{ ...profile, username: null }}
        locale="ru"
        counts={counts}
      />,
    )
    expect(bare.container.querySelector('a[href*="onboarding"]')).toBeNull()
    expect(screen.getByText('Адрес появится из вашего имени, когда вы сохраните.')).toBeVisible()
  })
})
describe.each(['en', 'ru'] as const)('deletion (%s)', (locale) => {
  const ru = locale === 'ru'
  async function passwordStep() {
    mount(locale)
    await userEvent.click(
      screen.getByRole('button', { name: ru ? 'Удалить аккаунт' : 'Delete account' }),
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('12')).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole('button', { name: ru ? 'Продолжить' : 'Continue' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: ru ? 'Пропустить' : 'Skip' }))
    await userEvent.type(
      screen.getByLabelText(ru ? 'Текущий пароль' : 'Current password'),
      'password',
    )
    return dialog
  }
  it.each([
    {
      error: new ApiError(401, 'bad', 'INVALID_CREDENTIALS'),
      en: 'Incorrect password',
      ru: 'Неверный пароль',
    },
    {
      error: new ApiError(429, 'limited', 'RATE_LIMIT', { retryAfter: 60 }),
      en: 'Too many attempts',
      ru: 'Слишком много попыток',
    },
    {
      error: new TypeError('offline'),
      en: 'Deletion is not confirmed',
      ru: 'Удаление не подтверждено',
    },
  ])('preserves distinct password/rate/network outcomes: $en', async (item) => {
    m.remove.mockRejectedValue(item.error)
    const dialog = await passwordStep()
    await userEvent.keyboard('{Enter}')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(ru ? item.ru : item.en)
    expect(screen.getByLabelText(ru ? 'Текущий пароль' : 'Current password')).toHaveValue(
      'password',
    )
  })
  it('blocks Escape, cancel, and duplicate submission while deleting, then uses the dedicated success target', async () => {
    let resolve!: () => void
    m.remove.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done
      }),
    )
    const dialog = await passwordStep()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Escape}')
    expect(dialog).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: ru ? 'Отмена' : 'Cancel' }))
    await userEvent.keyboard('{Enter}')
    expect(m.remove).toHaveBeenCalledTimes(1)
    await act(async () => resolve())
    expect(m.identity.mock.calls[0][1]).toBe('/account-deleted')
  })
})

describe.each(['en', 'ru'] as const)('accent color (%s)', (locale) => {
  const ru = locale === 'ru'
  const root = document.documentElement
  const swatch = (name: string) => screen.getByRole('radio', { name })
  beforeEach(() => {
    // Each test is a fresh sign-in, so no earlier test's saved accent becomes this one's rollback target.
    advanceAuthGeneration()
    document.cookie = 'kuuki_accent=shu; Path=/'
    root.dataset.accent = 'shu'
  })
  it('saves the choice on its own and keeps it out of the form save', async () => {
    mount(locale)
    await userEvent.click(swatch(ru ? 'Ай' : 'Ai'))
    expect(m.patch).toHaveBeenCalledWith(
      '/api/profiles/me',
      { theme_color: 'ai' },
      expect.anything(),
    )
    expect(root.dataset.accent).toBe('ai')
    fireEvent.change(screen.getByLabelText(ru ? 'Имя' : 'Display name'), {
      target: { value: 'Renamed' },
    })
    await userEvent.click(screen.getByRole('button', { name: ru ? 'Сохранить' : 'Save changes' }))
    await waitFor(() => expect(m.patch).toHaveBeenCalledTimes(2))
    expect(m.patch.mock.calls[1][1]).not.toHaveProperty('theme_color')
  })
  it('puts the previous accent back and says the save failed', async () => {
    m.patch.mockRejectedValue(new TypeError('offline'))
    mount(locale)
    await userEvent.click(swatch(ru ? 'Сакура' : 'Sakura'))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      ru ? 'Не удалось сохранить акцентный цвет' : 'Could not save the accent color',
    )
    expect(root.dataset.accent).toBe('shu')
    expect(swatch(ru ? 'Шу' : 'Shu')).toHaveAttribute('aria-checked', 'true')
    expect(document.cookie).toContain('kuuki_accent=shu')
  })
  it('reverts a failed save to the accent another picker saved, not a stale profile payload', async () => {
    const first = mount(locale)
    await userEvent.click(swatch(ru ? 'Ай' : 'Ai'))
    await waitFor(() => expect(m.patch).toHaveBeenCalledTimes(1))
    first.unmount()
    m.patch.mockRejectedValue(new TypeError('offline'))
    // A soft navigation can hand the next picker the profile as it was before the save.
    render(
      <SettingsForm
        ownerId="a"
        profile={{ ...profile, theme_color: 'shu' }}
        locale={locale}
        counts={counts}
      />,
    )
    await userEvent.click(swatch(ru ? 'Сакура' : 'Sakura'))
    await screen.findByRole('alert')
    expect(root.dataset.accent).toBe('ai')
  })
  it('lets a superseded save finish in order and reports only the latest pick failing', async () => {
    const sent: Array<{ accent: string; fail: () => void }> = []
    m.patch.mockImplementation(
      (_path: string, body: { theme_color: string }) =>
        new Promise((_done, fail) =>
          sent.push({ accent: body.theme_color, fail: () => fail(new TypeError('offline')) }),
        ),
    )
    mount(locale)
    await userEvent.click(swatch(ru ? 'Ай' : 'Ai'))
    await userEvent.click(swatch(ru ? 'Сакура' : 'Sakura'))
    // The second write waits behind the first instead of racing it to the server.
    expect(sent.map((request) => request.accent)).toEqual(['ai'])
    await act(async () => sent[0].fail())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(root.dataset.accent).toBe('sakura')
    await waitFor(() => expect(sent.map((request) => request.accent)).toEqual(['ai', 'sakura']))
    await act(async () => sent[1].fail())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      ru ? 'Не удалось сохранить акцентный цвет' : 'Could not save the accent color',
    )
    expect(root.dataset.accent).toBe('shu')
  })
  it('does not let an unmounted Settings revert the device after a later visit', async () => {
    const sent: Array<{ accent: string; settle: (ok: boolean) => void }> = []
    m.patch.mockImplementation(
      (_path: string, body: { theme_color: string }) =>
        new Promise((done, fail) =>
          sent.push({
            accent: body.theme_color,
            settle: (ok) => (ok ? done({}) : fail(new TypeError('offline'))),
          }),
        ),
    )
    const first = mount(locale)
    await userEvent.click(swatch(ru ? 'Ай' : 'Ai'))
    first.unmount()
    mount(locale)
    await userEvent.click(swatch(ru ? 'Сакура' : 'Sakura'))
    await act(async () => sent[0].settle(false))
    await waitFor(() => expect(sent.map((request) => request.accent)).toEqual(['ai', 'sakura']))
    await act(async () => sent[1].settle(true))
    expect(root.dataset.accent).toBe('sakura')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
