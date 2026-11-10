// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laneModel } from './lane-model'
import { SecurityLane } from './security-lane'

const idle = laneModel({ entries: [], dragging: false, history: 'idle', saved: false })
const reading = laneModel({
  entries: [{ id: 'a', phase: 'online', drafts: 0 }],
  dragging: true,
  history: 'idle',
  saved: false,
})
const lane = (container: HTMLElement) => container.querySelector<HTMLElement>('.security-lane')!

afterEach(() => vi.unstubAllGlobals())

describe('SecurityLane', () => {
  it('is hidden from assistive technology and offers nothing to focus', () => {
    const { container } = render(<SecurityLane model={reading} />)
    expect(lane(container).getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0)
    expect(container.querySelector('text')).toBeNull()
  })

  it('follows the model: size, raised flaps, running rollers and a tray per source', () => {
    const { container, rerender } = render(<SecurityLane model={idle} />)
    expect(lane(container).dataset).toMatchObject({ size: 'hero' })
    expect(lane(container).dataset.flaps).toBeUndefined()
    expect(lane(container).style.height).toBe('216px')
    rerender(<SecurityLane model={reading} />)
    expect(lane(container).dataset).toMatchObject({ size: 'band', flaps: 'true', rolling: 'true' })
    expect(lane(container).style.height).toBe('120px')
    expect(container.querySelector("[data-part='tray:a']")).not.toBeNull()
    expect(container.querySelector("[data-part='lit']")).not.toBeNull()
  })

  it('plays the wrong-type bump once per source, and never for one already there on arrival', () => {
    const animate = vi.fn()
    const element = SVGElement.prototype as unknown as { animate?: unknown }
    element.animate = animate
    const rejected = (...ids: string[]) =>
      laneModel({
        entries: ids.map((id) => ({ id, phase: 'failed', problem: 'type', drafts: 0 })),
        dragging: false,
        history: 'idle',
        saved: false,
      })
    try {
      const { rerender } = render(<SecurityLane model={rejected('a')} />)
      expect(animate).not.toHaveBeenCalled()
      // Both copies of the tray move together.
      rerender(<SecurityLane model={rejected('a', 'b')} />)
      expect(animate).toHaveBeenCalledTimes(2)
      // Only the latest rejection is drawn: with b removed, a is drawn again and stays put.
      rerender(<SecurityLane model={rejected('a')} />)
      expect(animate).toHaveBeenCalledTimes(2)
      rerender(<SecurityLane model={rejected('a', 'c')} />)
      expect(animate).toHaveBeenCalledTimes(4)
    } finally {
      delete element.animate
    }
  })

  it('marks itself still under reduced motion, which turns its transitions off', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const { container } = render(<SecurityLane model={reading} />)
    expect(lane(container).dataset.still).toBe('true')
  })
})
