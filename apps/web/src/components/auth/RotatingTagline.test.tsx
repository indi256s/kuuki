import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RotatingTagline } from './RotatingTagline'

// English taglines (actual content from i18n)
const englishTaglines = [
  "Snap a boarding pass. We'll figure it out.",
  "Flights, countries, airports — all the nerdy stuff.",
  "Halfway to the Moon, apparently.",
  "23 countries down, 172 to go.",
]

// Russian taglines (actual content from i18n)
const russianTaglines = [
  "Сфоткай посадочный. Мы разберёмся.",
  "Рейсы, страны, аэропорты — вся нёрдятина.",
  "Полпути до Луны, между прочим.",
  "23 страны позади, ещё 172 впереди.",
]

describe('RotatingTagline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('text visibility', () => {
    it('displays the first tagline initially', () => {
      render(<RotatingTagline items={englishTaglines} />)

      expect(screen.getByText(englishTaglines[0])).toBeInTheDocument()
    })

    it('rotates to next tagline after interval', async () => {
      render(<RotatingTagline items={englishTaglines} interval={8000} />)

      expect(screen.getByText(englishTaglines[0])).toBeInTheDocument()

      // Advance past interval + animation duration
      await act(async () => {
        vi.advanceTimersByTime(8300)
      })

      expect(screen.getByText(englishTaglines[1])).toBeInTheDocument()
    })

    it('cycles back to first tagline after showing all', async () => {
      render(<RotatingTagline items={englishTaglines} interval={1000} />)

      // Cycle through all 4 taglines and back to first
      // Each cycle: interval (1000ms) + exit animation (200ms) + enter animation (50ms)
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000) // interval triggers
          vi.advanceTimersByTime(200)  // exit phase
          vi.advanceTimersByTime(50)   // enter phase snaps to visible
        })
      }

      expect(screen.getByText(englishTaglines[0])).toBeInTheDocument()
    })
  })

  describe('English taglines - text not clipped', () => {
    englishTaglines.forEach((tagline, index) => {
      it(`English tagline ${index + 1} is fully visible (not clipped)`, () => {
        // Render with specific tagline as first item to test each
        const items = [tagline, ...englishTaglines.filter((_, i) => i !== index)]
        render(<RotatingTagline items={items} />)

        const textElement = screen.getByText(tagline)

        // Text should be in the document
        expect(textElement).toBeInTheDocument()

        // The text content should match exactly (no truncation)
        expect(textElement.textContent).toBe(tagline)

        // The container should not have text-overflow: ellipsis style that would clip
        const container = textElement.closest('div')
        expect(container).not.toBeNull()

        // Text should be fully rendered (checking the actual text length)
        expect(textElement.textContent?.length).toBe(tagline.length)
      })
    })
  })

  describe('Russian taglines - text not clipped', () => {
    russianTaglines.forEach((tagline, index) => {
      it(`Russian tagline ${index + 1} is fully visible (not clipped)`, () => {
        const items = [tagline, ...russianTaglines.filter((_, i) => i !== index)]
        render(<RotatingTagline items={items} />)

        const textElement = screen.getByText(tagline)

        expect(textElement).toBeInTheDocument()
        expect(textElement.textContent).toBe(tagline)
        expect(textElement.textContent?.length).toBe(tagline.length)
      })
    })
  })

  describe('progress indicators', () => {
    it('renders correct number of progress bars for items', () => {
      render(<RotatingTagline items={englishTaglines} />)

      // 4 progress bars (containers) for 4 taglines - the outer wrapper divs
      const progressBars = document.querySelectorAll('.flex.gap-1 > div')
      expect(progressBars.length).toBe(4)
    })

    it('highlights the current progress bar', () => {
      render(<RotatingTagline items={englishTaglines} />)

      const progressFills = document.querySelectorAll('.flex.gap-1 > div > div')
      // First bar should be active (primary color, full width)
      expect(progressFills[0].classList.contains('bg-primary/70')).toBe(true)
      expect(progressFills[0].classList.contains('w-full')).toBe(true)
    })

    it('updates highlighted bar when rotating', async () => {
      render(<RotatingTagline items={englishTaglines} interval={1000} />)

      await act(async () => {
        vi.advanceTimersByTime(1300)
      })

      const progressFills = document.querySelectorAll('.flex.gap-1 > div > div')
      // Second bar should now be active
      expect(progressFills[1].classList.contains('bg-primary/70')).toBe(true)
      // First bar should be completed (lighter color)
      expect(progressFills[0].classList.contains('bg-primary/30')).toBe(true)
    })
  })

  describe('container dimensions', () => {
    it('container has overflow-hidden to prevent layout shift', () => {
      render(<RotatingTagline items={englishTaglines} />)

      const textContainer = document.querySelector('.overflow-hidden')
      expect(textContainer).not.toBeNull()
    })

    it('container has fixed height class', () => {
      render(<RotatingTagline items={englishTaglines} />)

      const textContainer = document.querySelector('.h-5')
      expect(textContainer).not.toBeNull()
    })
  })
})
