// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { ChapterCard } from './chapter-card'

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
