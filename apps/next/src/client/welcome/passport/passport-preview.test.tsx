// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PassportPreview as Preview } from '../types'
import { PassportPreview } from './passport-preview'

const base: Preview = {
  step: 'name',
  name: '',
  found: { flights: 0, countries: [] },
  open: false,
  reading: false,
}

// A desktop viewport with motion allowed, so the bench loads; jsdom never intersects, so nothing animates.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width'),
    addEventListener() {},
    removeEventListener() {},
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const phone = () =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))

const drawing = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('.wp-bench svg')).not.toBeNull())
  return container.querySelector('.wp-bench svg') as SVGSVGElement
}
const stamp = (svg: SVGSVGElement, slot: number) =>
  svg.querySelector(`[data-slot="${slot}"]`) as SVGGElement | null

describe('PassportPreview', () => {
  it('prints the name on the cover and the strip, with a placeholder while empty', async () => {
    const { container, rerender } = render(<PassportPreview preview={base} />)
    const svg = await drawing(container)
    const cover = () => svg.querySelector('[data-cover-name]') as SVGTextElement
    const strip = () => container.querySelector('.wp-strip-name') as HTMLElement
    expect(cover()).toHaveTextContent('Your name')
    expect(cover()).toHaveAttribute('data-empty')
    expect(strip()).toHaveTextContent('Your name')
    rerender(<PassportPreview preview={{ ...base, name: ' Alex   Mor ' }} />)
    expect(cover()).toHaveTextContent('Alex Mor')
    expect(cover()).not.toHaveAttribute('data-empty')
    expect(strip()).toHaveTextContent('Alex Mor')
    expect(strip()).toHaveAttribute('dir', 'auto')
  })

  it('draws a decorative figure with nothing to focus', async () => {
    const { container } = render(<PassportPreview preview={base} />)
    const svg = await drawing(container)
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
    expect(svg.querySelector('a, [tabindex], [role]')).toBeNull()
  })

  it('keeps the counts in the caption, out of the drawing', async () => {
    const preview: Preview = {
      step: 'review',
      name: 'Alex Mor',
      open: true,
      reading: false,
      found: {
        flights: 41,
        countries: ['JP', 'PT', 'GE', 'TR', 'DE', 'GB'],
        km: 182410,
        since: 2016,
      },
    }
    const { container } = render(<PassportPreview preview={preview} />)
    const svg = await drawing(container)
    expect(svg.querySelectorAll('[data-slot]')).toHaveLength(6)
    expect(svg.textContent).not.toMatch(/182[,\s]410|2016/)
    expect(screen.getByText('6 countries. The passport grows with you.')).toBeInTheDocument()
  })

  it('stamps what a resume already holds without replaying it, and presses only later arrivals', async () => {
    const found = { flights: 12, countries: ['JP', 'PT'] }
    const preview: Preview = { step: 'flights', name: 'Alex', open: true, reading: false, found }
    const { container, rerender } = render(<PassportPreview preview={preview} />)
    const svg = await drawing(container)
    expect(stamp(svg, 0)).toHaveAttribute('opacity', '1')
    expect(stamp(svg, 1)).toHaveAttribute('opacity', '1')
    rerender(
      <PassportPreview
        preview={{ ...preview, found: { flights: 14, countries: ['GE', 'JP', 'PT'] } }}
      />,
    )
    // The new country waits for the bridge's press; the two already there stay inked.
    expect(stamp(svg, 2)).toHaveTextContent('GE')
    expect(stamp(svg, 2)).toHaveAttribute('opacity', '0')
    expect(stamp(svg, 0)).toHaveAttribute('opacity', '1')
  })

  it('keeps arriving countries visible when Back interrupts their queued presses', async () => {
    const preview: Preview = { ...base, step: 'flights', open: true }
    const { container, rerender } = render(<PassportPreview preview={preview} />)
    const svg = await drawing(container)
    const found = { flights: 1, countries: ['JP'] }
    rerender(<PassportPreview preview={{ ...preview, found }} />)
    expect(stamp(svg, 0)).toHaveAttribute('opacity', '0')
    rerender(<PassportPreview preview={{ ...base, found }} />)
    rerender(<PassportPreview preview={{ ...preview, found }} />)
    expect(stamp(svg, 0)).toHaveAttribute('opacity', '1')
  })

  it('restores the printed MRZ when Back interrupts its ready scan', async () => {
    const preview: Preview = { ...base, step: 'review', open: true, name: 'Alex' }
    let intersect: ((entries: { isIntersecting: boolean }[]) => void) | undefined
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof intersect) {
          intersect = callback
        }
        observe() {}
        disconnect() {}
      },
    )
    const { container, rerender } = render(<PassportPreview preview={preview} />)
    const svg = await drawing(container)
    const mrz = svg.querySelector('[data-mrz="0"]')!
    const printed = mrz.textContent
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), 16),
    )
    vi.stubGlobal('cancelAnimationFrame', clearTimeout)
    act(() => intersect?.([{ isIntersecting: true }]))
    rerender(<PassportPreview preview={{ ...preview, step: 'ready' }} />)
    const scan = svg.querySelector('[data-scan]')!
    for (let frame = 0; frame < 400 && scan.getAttribute('opacity') === '0'; frame++) {
      act(() => vi.advanceTimersByTime(16))
    }
    expect(scan.getAttribute('opacity')).not.toBe('0')
    expect(mrz.textContent).not.toBe(printed)
    rerender(<PassportPreview preview={preview} />)
    expect(mrz.textContent).toBe(printed)
  })

  it('ready: the WELCOME stamp has fixed English text and today’s date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 11, 12))
    const { container } = render(
      <PassportPreview
        locale="ru"
        preview={{
          step: 'ready',
          name: 'Alex',
          open: true,
          reading: false,
          found: { flights: 3, countries: ['JP'] },
        }}
      />,
    )
    const svg = await drawing(container)
    const entry = svg.querySelector('[data-entry]') as SVGGElement
    expect(entry).toHaveTextContent('KUUKI · ENTRY')
    expect(entry).toHaveTextContent('WELCOME')
    expect(entry).toHaveTextContent('11 OCT 2026')
    expect(entry).toHaveAttribute('opacity', '1')
    expect(svg.querySelector('[data-mrz="0"]')).toHaveTextContent('P<KUU<ALEX<<<<')
    expect(
      screen.getByText('Штамп поставлен. Карточка растворится в вашем журнале.'),
    ).toBeInTheDocument()
  })

  it('on a phone, brings the bench in for a batch being read and for the reveal, not for the other steps', async () => {
    phone()
    const { container, rerender } = render(<PassportPreview preview={base} />)
    const passport = container.querySelector('.welcome-passport')!
    const idle: Preview[] = [
      base,
      { ...base, step: 'flights', open: true },
      { ...base, step: 'review', open: true },
    ]
    for (const preview of idle) {
      rerender(<PassportPreview preview={preview} />)
      expect(passport).not.toHaveAttribute('data-bench')
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container.querySelector('.wp-bench svg')).toBeNull()
    rerender(<PassportPreview preview={{ ...base, step: 'flights', open: true, reading: true }} />)
    expect(passport).toHaveAttribute('data-bench')
    await drawing(container)
    // Once mounted it stays, but the strip stands alone again when the batch is no longer being read.
    rerender(<PassportPreview preview={{ ...base, step: 'review', open: true }} />)
    expect(passport).not.toHaveAttribute('data-bench')
    expect(container.querySelector('.wp-bench svg')).not.toBeNull()
    rerender(<PassportPreview preview={{ ...base, step: 'ready', open: true }} />)
    expect(passport).toHaveAttribute('data-bench')
  })
})
