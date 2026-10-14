// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { ChapterCard } from './chapter-card'
import { ChapterContext } from './chapter-context'
import userEvent from '@testing-library/user-event'

vi.mock('../store/overview-context', () => ({ useOverview: () => ({ locale: 'en' }) }))

function Harness() {
  const [applied, setApplied] = useState(false)
  return (
    <ChapterCard
      state="ready"
      figure={null}
      figureButton={{ label: 'Show next airline', onPress: () => {} }}
      hero={{
        value: '4',
        caption: 'Air France',
        only: applied ? null : { label: 'Only Air France', onPress: () => setApplied(true) },
      }}
      chart={{
        caption: 'Top airlines',
        plot: <button data-picked="">Air France, 4 flights</button>,
      }}
    />
  )
}

it('hands focus to the picked mark, not the figure button before it, when applying "Only …" removes its own button', async () => {
  render(<Harness />)
  const only = screen.getByRole('button', { name: 'Only Air France' })
  only.focus()
  fireEvent.click(only)
  expect(screen.queryByRole('button', { name: 'Only Air France' })).toBeNull()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Air France, 4 flights' })).toHaveFocus(),
  )
})

it.each(['full', 'sheet'] as const)(
  'keeps %s details collapsed until keyboard activation, while chart data stays accessible',
  async (span) => {
    const user = userEvent.setup()
    render(
      <ChapterContext.Provider value={{ span, active: true }}>
        <ChapterCard
          state="ready"
          figure={null}
          hero={{ value: '4', caption: 'Air France' }}
          chart={{
            caption: 'Top airlines',
            plot: <button type="button">Air France, 4 flights</button>,
            table: {
              caption: 'Airline flights',
              columns: [{ key: 'name', label: 'Airline' }],
              rows: [{ name: 'Air France' }],
            },
          }}
          details={{
            heading: 'Travel patterns',
            extra: <button type="button">Inspect schedule</button>,
          }}
        />
      </ChapterContext.Provider>,
    )
    const toggle = screen.getByRole('button', { name: 'Travel patterns' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Inspect schedule' })).toBeNull()
    expect(screen.getByRole('table', { name: 'Airline flights' })).toBeInTheDocument()
    toggle.focus()
    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Inspect schedule' })).toHaveFocus()
    await user.tab({ shift: true })
    await user.keyboard(' ')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Inspect schedule' })).toBeNull()
  },
)
