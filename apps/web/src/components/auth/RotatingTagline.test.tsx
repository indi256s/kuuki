import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RotatingTagline } from './RotatingTagline'

// English taglines (actual content from i18n)
const englishTaglines = [
  "Snap a boarding pass. We'll figure it out.",
  "Flights, countries, airports — all the nerdy stuff.",
  "Halfway to the Moon, apparently.",
  "Your flight data is safe with us. Probably.",
  "Logging your progress. For science.",
  "We do what we must. Airfare was non-refundable.",
  "You've been busy. We appreciate that.",
]

async function advanceRotation(interval: number) {
  await act(async () => { vi.advanceTimersByTime(interval) })
  await act(async () => { vi.advanceTimersByTime(200) })
  await act(async () => { vi.advanceTimersByTime(50) })
}

describe('RotatingTagline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cycles back to first tagline after showing all', async () => {
    render(<RotatingTagline items={englishTaglines} interval={1000} />)

    for (let index = 1; index <= englishTaglines.length; index++) {
      await advanceRotation(index === 1 ? 1000 : 750)
      expect(screen.getByText(englishTaglines[index % englishTaglines.length])).toBeInTheDocument()
    }
  })
})
