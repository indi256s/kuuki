// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NameStep } from './name-step'

const m = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }))
vi.mock('@kuuki/client/apiClient', () => ({
  api: { get: m.get, patch: m.patch },
  getAuthGeneration: () => 0,
  ApiError: class extends Error {
    constructor(
      public status: number,
      message: string,
      public code?: string,
    ) {
      super(message)
    }
  },
}))
vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))

async function failure(status: number, code?: string) {
  const { ApiError } = await import('@kuuki/client/apiClient')
  return new ApiError(status, 'x', code)
}

function setup(props: Partial<Parameters<typeof NameStep>[0]> = {}) {
  const onName = vi.fn()
  const onSaved = vi.fn()
  render(
    <NameStep
      locale="en"
      ownerId="a"
      headingRef={createRef<HTMLHeadingElement>()}
      initialName=""
      initialAddress={null}
      onName={onName}
      onSaved={onSaved}
      {...props}
    />,
  )
  return { onName, onSaved, user: userEvent.setup() }
}

const field = () => screen.getByLabelText('Your name') as HTMLInputElement
const submit = () => screen.getByRole('button', { name: /continue|try again|saving/i })

beforeEach(() => {
  m.get.mockReset().mockResolvedValue({ available: true, valid: true })
  m.patch.mockReset()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

describe('NameStep', () => {
  it('limits and labels the field for any script', () => {
    setup()
    expect(field()).toHaveAttribute('maxlength', '40')
    expect(field()).toHaveAttribute('autocomplete', 'name')
    expect(field()).toHaveAttribute('dir', 'auto')
    expect(field()).toHaveFocus()
  })

  it('keeps Continue disabled while the trimmed name is empty', async () => {
    const { user } = setup()
    await user.type(field(), '   ')
    expect(submit()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Add your name to continue.')).toBeInTheDocument()
  })

  it('reports every input event to the passport', async () => {
    const { user, onName } = setup()
    await user.type(field(), 'Al')
    expect(onName.mock.calls.map(([value]) => value)).toEqual(['A', 'Al'])
  })

  it('saves the trimmed name with its derived address', async () => {
    m.patch.mockResolvedValue({ display_name: 'Alex Mor', username: 'alex-mor' })
    const { user, onSaved } = setup()
    await user.type(field(), '  Alex   Mor ')
    await user.click(submit())
    expect(m.patch).toHaveBeenCalledWith(
      '/api/profiles/me',
      { display_name: 'Alex Mor', username: 'alex-mor', username_derived: true },
      expect.anything(),
    )
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith({ displayName: 'Alex Mor', username: 'alex-mor' }),
    )
  })

  it('derives a Latin address from a Cyrillic name', async () => {
    m.patch.mockResolvedValue({ display_name: 'Александра', username: 'aleksandra' })
    const { user } = setup()
    await user.type(field(), 'Александра')
    await user.click(submit())
    expect(m.patch.mock.calls[0]?.[1]).toMatchObject({ username: 'aleksandra' })
  })

  it('shows a taken address inline and keeps what was typed', async () => {
    m.patch.mockRejectedValue(await failure(409, 'CONFLICT'))
    const { user } = setup()
    await user.type(field(), 'Alex Mor')
    await user.click(screen.getByRole('button', { name: 'Edit address' }))
    const address = screen.getByLabelText('Address')
    await user.clear(address)
    await user.type(address, 'pilot-alex')
    await waitFor(() => expect(m.get).toHaveBeenCalled())
    await waitFor(() => expect(submit()).not.toHaveAttribute('aria-disabled'))
    await user.click(submit())
    expect(await screen.findByText('That address is taken.')).toBeInTheDocument()
    expect(field()).toHaveValue('Alex Mor')
    expect(m.patch.mock.calls[0]?.[1]).toMatchObject({
      username: 'pilot-alex',
      username_derived: false,
    })
  })

  it('offers a plain retry after a server error', async () => {
    m.patch.mockRejectedValue(await failure(500))
    const { user } = setup()
    await user.type(field(), 'Alex Mor')
    await user.click(submit())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t save your name. Nothing you typed was lost.',
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(field()).toHaveValue('Alex Mor')
  })

  it('disables Continue while offline and keeps the text', async () => {
    const { user } = setup()
    await user.type(field(), 'Alex Mor')
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    act(() => {
      fireEvent(window, new Event('offline'))
    })
    expect(submit()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/You’re offline/)).toBeInTheDocument()
    expect(field()).toHaveValue('Alex Mor')
  })
})
