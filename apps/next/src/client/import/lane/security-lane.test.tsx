// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laneModel } from './lane-model'
import { SecurityLane } from './security-lane'

const idle = laneModel({ entries: [], dragging: false, history: 'idle' })
const reading = laneModel({
  entries: [{ id: 'a', phase: 'online', drafts: 0 }],
  dragging: true,
  history: 'idle',
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
    expect(lane(container).dataset).toMatchObject({ size: 'stage', flaps: 'true', rolling: 'true' })
    expect(lane(container).style.height).toBe('300px')
    expect(container.querySelector("[data-part='tray:a']")).not.toBeNull()
    expect(container.querySelector("[data-part='lit']")).not.toBeNull()
  })

  it('points the camera at the active tray, and lingers on the exit before becoming a band', () => {
    vi.useFakeTimers()
    try {
      const at = (phase: 'queued' | 'online' | 'ready') =>
        laneModel({
          entries: [{ id: 'a', phase, drafts: 2 }],
          dragging: false,
          history: 'idle',
        })
      const { container, rerender } = render(<SecurityLane model={at('queued')} />)
      const view = () => container.querySelector<HTMLElement>('.security-lane-view')!
      const camera = () =>
        ['--cam-x', '--cam-y'].map((name) => parseFloat(view().style.getPropertyValue(name)))
      const queue = camera()
      rerender(<SecurityLane model={at('online')} />)
      const tunnel = camera()
      expect(tunnel[0]).toBeLessThan(queue[0])
      expect(tunnel[1]).toBeGreaterThan(queue[1])
      rerender(<SecurityLane model={at('ready')} />)
      expect(lane(container).dataset.size).toBe('stage')
      expect(camera()[0]).toBeLessThanOrEqual(tunnel[0])
      act(() => vi.runAllTimers())
      expect(lane(container).dataset.size).toBe('band')
      expect(lane(container).style.height).toBe('120px')
    } finally {
      vi.useRealTimers()
    }
  })

  it('goes straight to a band when no new tray reaches the exit', () => {
    const at = (...entries: Parameters<typeof laneModel>[0]['entries']) =>
      laneModel({ entries, dragging: false, history: 'idle' })
    const done = { id: 'a', phase: 'ready', drafts: 1 } as const
    const { container, rerender } = render(
      <SecurityLane model={at(done, { id: 'b', phase: 'online', drafts: 0 })} />,
    )
    expect(lane(container).dataset.size).toBe('stage')
    rerender(
      <SecurityLane model={at(done, { id: 'b', phase: 'failed', problem: 'read', drafts: 0 })} />,
    )
    expect(lane(container).dataset.size).toBe('band')
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
      })
    try {
      const { rerender } = render(<SecurityLane model={rejected('a')} />)
      expect(animate).not.toHaveBeenCalled()
      rerender(<SecurityLane model={rejected('a', 'b')} />)
      expect(animate).toHaveBeenCalledTimes(2)
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
