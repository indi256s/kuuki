// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PassCardFigure } from './figure'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('swaps the print without a deal under reduced motion, so no leaving pass waits for an animationend', () => {
  vi.stubGlobal('matchMedia', (media: string) => ({ matches: media.includes('reduce') }))
  const view = render(<PassCardFigure share={0.5} route="JFK ↔ LHR" picked={false} />)
  view.rerender(<PassCardFigure share={0.5} route="JFK ↔ CDG" picked />)
  expect(view.container.querySelector('.ov3-passes')).not.toHaveAttribute('data-deal')
  expect(view.container.textContent).not.toContain('LHR')
})
