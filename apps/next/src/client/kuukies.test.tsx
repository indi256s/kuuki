// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionGlobalConfig } from 'motion/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Kuukies, openKuukies } from './kuukies'

describe('Kuukies', () => {
  // jsdom paints no frames, so springs and exits would never settle; motion is covered by the browser check.
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false
  })
  afterEach(() => localStorage.clear())

  it('shows the notice once, remembers Got it, and Settings reopens the details with focus returned', async () => {
    const user = userEvent.setup()
    const first = render(<Kuukies />)
    await screen.findByRole('region', { name: 'Kuukies' }, { timeout: 2000 })
    await user.click(screen.getByRole('button', { name: "What's inside" }))
    const panel = await screen.findByRole('dialog', { name: 'Kuukies' })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Kuukies' })).toHaveFocus())
    expect(panel).toHaveTextContent('Sign-in')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: "What's inside" })).toHaveFocus())
    const bar = screen.getByRole('region', { name: 'Kuukies' })
    await user.click(within(bar).getByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Kuukies' })).toBeNull())
    first.unmount()

    render(
      <>
        <button type="button" onClick={openKuukies}>
          Settings row
        </button>
        <Kuukies />
      </>,
    )
    await act(() => new Promise((resolve) => setTimeout(resolve, 900)))
    expect(screen.queryByRole('region', { name: 'Kuukies' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Settings row' }))
    await screen.findByRole('dialog', { name: 'Kuukies' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Settings row' })).toHaveFocus()
  })
})
