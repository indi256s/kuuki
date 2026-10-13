// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { mountBench, type BenchInput } from './bench-live'

afterEach(() => {
  vi.unstubAllGlobals()
})

const INPUT: BenchInput = {
  open: true,
  ready: false,
  name: 'Mira Sato',
  locale: 'en',
  countries: [],
  flights: 3,
  copy: {
    cover: 'PASSPORT',
    foot: 'KUUKI',
    holder: 'HOLDER',
    placeholder: 'NAME',
    eyebrow: 'VISAS',
    visa: 'ENTRY',
  },
}

it('keeps a cleared entry stamp off when reduced motion snaps the bench', () => {
  let reduced = false
  let onMotion = () => {}
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduced
    },
    addEventListener: (_: string, listener: () => void) => (onMotion = listener),
    removeEventListener: () => {},
  }))
  let queued: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => queued.push(callback))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        queueMicrotask(() => callback([{ isIntersecting: true }]))
      }
      observe() {}
      disconnect() {}
    },
  )
  const stage = document.createElement('div')
  const bench = mountBench(stage, INPUT)
  return Promise.resolve().then(() => {
    bench.update({ ...INPUT, ready: true })
    // Run the bridge, the press and the scan to rest.
    for (let now = 16; queued.length && now < 20_000; now += 16) {
      const frames = queued
      queued = []
      frames.forEach((frame) => frame(now))
    }
    const entry = stage.querySelector('[data-entry]')!
    expect(entry.getAttribute('opacity')).toBe('1')
    bench.update({ ...INPUT, ready: false })
    expect(entry.getAttribute('opacity')).toBe('0')
    reduced = true
    onMotion()
    expect(entry.getAttribute('opacity')).toBe('0')
    bench.destroy()
  })
})
