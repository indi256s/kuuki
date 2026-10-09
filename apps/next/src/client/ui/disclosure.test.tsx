// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Disclosure } from './disclosure'

describe('Disclosure', () => {
  it('keeps collapsed content out of the tab order and expands with aria-expanded', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Disclosure summary="More details">
          <button type="button">Inner action</button>
        </Disclosure>
        <button type="button">After</button>
      </>,
    )
    const trigger = screen.getByRole('button', { name: 'More details' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    const panel = document.getElementById(
      trigger.getAttribute('aria-controls') as string,
    ) as HTMLElement
    expect(panel.hasAttribute('inert')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Inner action' })).not.toBeInTheDocument() // hidden from the accessibility tree
    // jsdom does not implement `inert`, so user-event's Tab would still land inside; browsers skip anything under [inert].
    expect(screen.getByText('Inner action', { selector: 'button' }).closest('[inert]')).toBe(panel)
    await user.tab()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(panel.hasAttribute('inert')).toBe(false)
    expect(screen.getByRole('button', { name: 'Inner action' }).closest('[inert]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Inner action' })).toBeInTheDocument()
  })
})
