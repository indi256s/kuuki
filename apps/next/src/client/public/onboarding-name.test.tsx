// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { OnboardingName } from './onboarding-name'
import { api } from '@kuuki/client/apiClient'
const push = vi.fn(),
  refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock('@kuuki/client/apiClient', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
  getAuthGeneration: () => 0,
  ApiError: class extends Error {},
}))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('../profile/avatar', () => ({ ProfileAvatar: () => <span /> }))
const props = {
  ownerId: 'a',
  username: '',
  displayName: '',
  profileUrl: 'https://configured.example/fly/your-name',
  locale: 'en' as const,
}
beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  push.mockReset()
  refresh.mockReset()
})
it('normalizes a configured absolute profile URL and persists before Continue navigates', async () => {
  vi.mocked(api.get).mockResolvedValue({ available: true })
  let resolve!: () => void
  vi.mocked(api.patch).mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done
      }),
  )
  render(<OnboardingName {...props} />)
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: '  Alex_42 ' } })
  expect(screen.getByText('https://configured.example/fly/alex_42')).toBeVisible()
  await screen.findByText('Username available.')
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(push).not.toHaveBeenCalled()
  await act(async () => resolve())
  expect(api.patch).toHaveBeenCalledWith(
    '/api/profiles/me',
    { username: 'alex_42', display_name: null },
    expect.anything(),
  )
  expect(push).toHaveBeenCalledWith('/onboarding?step=capture')
})
it('rejects a late availability reply after a rapid username change', async () => {
  let first!: (value: { available: boolean }) => void
  vi.mocked(api.get)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          first = resolve
        }),
    )
    .mockResolvedValueOnce({ available: false })
  render(<OnboardingName {...props} />)
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'old_name' } })
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'taken_name' } })
  await screen.findByText('That username is already taken.')
  await act(async () => first({ available: true }))
  expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByText('That username is already taken.')).toBeVisible()
})
it('distinguishes network failure from taken and retries without editing', async () => {
  vi.mocked(api.get)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ available: true })
  render(<OnboardingName {...props} />)
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'traveler' } })
  expect(await screen.findByText(/Could not check username/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Retry check' }))
  expect(await screen.findByText('Username available.')).toBeVisible()
})
it('keeps a failed profile save on Name with a retryable outcome', async () => {
  vi.mocked(api.patch).mockRejectedValue(new Error('offline'))
  render(<OnboardingName {...props} username="existing" />)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your profile')
  expect(push).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Username')).toHaveValue('existing')
})
