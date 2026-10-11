// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { FactFlight } from '../types'
import { ReadyStep } from './ready-step'

const flights: FactFlight[] = [
  { date: '2020-01-01', origin: 'TBS', destination: 'IST', upcoming: false },
]

function setup(onOpen: () => Promise<void>, leftOut = 0, locale: 'en' | 'ru' = 'en') {
  render(
    <ReadyStep
      locale={locale}
      ownerId="owner-1"
      headingRef={createRef<HTMLHeadingElement>()}
      summary={{ flights, leftOut }}
      onOpen={onOpen}
    />,
  )
  return userEvent.setup()
}
const open = () => screen.getByRole('button', { name: /open my journal|opening/i })

describe('ReadyStep', () => {
  it('renders the narrator line as the heading', () => {
    setup(vi.fn())
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(/TBS–IST/)
    expect(heading).toHaveAttribute('tabindex', '-1')
    expect(screen.getByText('YOUR JOURNAL IS OPEN')).toBeInTheDocument()
  })

  it('mentions left-out flights only when there are some', () => {
    setup(vi.fn(), 0)
    expect(screen.queryByText(/left out/)).not.toBeInTheDocument()
    expect(screen.getByText(/^2 countries, /)).toBeInTheDocument()
  })

  it('includes the left-out clause at 12', () => {
    setup(vi.fn(), 12)
    expect(screen.getByText(/12 flights left out; add them anytime/)).toBeInTheDocument()
  })

  it('calls onOpen once and shows the loading state', async () => {
    const onOpen = vi.fn(() => new Promise<void>(() => {}))
    const user = setup(onOpen)
    await user.click(open())
    await user.click(open())
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(open()).toHaveAttribute('aria-busy', 'true')
  })

  it('shows an error and re-enables the button when recording fails', async () => {
    const onOpen = vi.fn().mockRejectedValueOnce(new Error('x'))
    const user = setup(onOpen)
    await user.click(open())
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t open your journal/)
    await waitFor(() => expect(open()).not.toHaveAttribute('aria-busy'))
    expect(open()).not.toHaveAttribute('aria-disabled')
    await user.click(open())
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('speaks Russian', () => {
    setup(vi.fn(), 0, 'ru')
    expect(screen.getByText('ВАШ ЖУРНАЛ ОТКРЫТ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Открыть журнал/ })).toBeInTheDocument()
  })
})
