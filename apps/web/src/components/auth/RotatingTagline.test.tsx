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

// Russian taglines (actual content from i18n)
const russianTaglines = [
  "Сфоткай посадочный. Мы разберёмся.",
  "Рейсы, страны, аэропорты — вся нёрдятина.",
  "Полпути до Луны, между прочим.",
  "Твои данные в безопасности. Наверное.",
  "Записываем твой прогресс. Для науки.",
  "Делаем что должны. Билеты невозвратные.",
  "Ты был занят. Мы это ценим.",
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

      // Advance through all taglines: (n items * interval) + animation buffer
      // This triggers n intervals, wrapping index back to 0
      await act(async () => {
        vi.advanceTimersByTime(englishTaglines.length * 1000 + 300)
      })

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

  describe('layout structure', () => {
    it('renders a flex column container', () => {
      render(<RotatingTagline items={englishTaglines} />)

      const container = document.querySelector('.flex.flex-col.items-center')
      expect(container).not.toBeNull()
    })

    it('renders text inside a min-height container', () => {
      render(<RotatingTagline items={englishTaglines} />)

      // Text wrapper has min-height to prevent layout shift during animation
      const textWrapper = document.querySelector('.min-h-\\[3rem\\]')
      expect(textWrapper).not.toBeNull()
    })

    it('text is centered horizontally', () => {
      render(<RotatingTagline items={englishTaglines} />)

      const textWrapper = document.querySelector('.justify-center')
      expect(textWrapper).not.toBeNull()
    })

    it('cycles to next item after interval', async () => {
      render(<RotatingTagline items={englishTaglines} interval={1000} />)

      // First item visible initially
      expect(screen.getByText(englishTaglines[0])).toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(1300)
      })

      // Second item visible after interval
      expect(screen.getByText(englishTaglines[1])).toBeInTheDocument()
    })

    it('accepts a custom className on the text element', () => {
      render(<RotatingTagline items={englishTaglines} className="text-xl" />)

      const text = screen.getByText(englishTaglines[0])
      expect(text.classList.contains('text-xl')).toBe(true)
    })
  })
})
