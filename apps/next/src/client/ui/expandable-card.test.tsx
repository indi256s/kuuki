// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ExpandableCard } from './expandable-card'

afterEach(cleanup)

describe('ExpandableCard', () => {
  it('keeps closed details out of reach and closes on Escape with focus back on the header', async () => {
    const user = userEvent.setup()
    render(
      <ExpandableCard title="Imports" direction="up">
        <button type="button">Cancel reading</button>
      </ExpandableCard>,
    )
    const header = screen.getByRole('button', { name: /imports/i })
    const panel = document.getElementById(header.getAttribute('aria-controls')!)!
    expect(panel).toHaveAttribute('inert')

    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('inert')
    screen.getByRole('button', { name: /cancel reading/i }).focus()
    await user.keyboard('{Escape}')
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(header).toHaveFocus()
  })
})
