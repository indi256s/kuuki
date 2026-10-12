// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthCardFrame } from './auth-card'

const model = vi.hoisted(() => ({ set: vi.fn(), events: () => [], destroy: vi.fn() }))
vi.mock('./concorde/concorde.generated', () => ({ CONCORDE: { html: '<svg />', data: {} } }))
vi.mock('./concorde/turn.generated.js', () => ({ TURN: { mount: () => model } }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each([false, true])(
  'keeps the turn paused after blur, visibility changes and remount until explicitly resumed (storage writes blocked: %s)',
  async (blocked) => {
    localStorage.clear()
    if (blocked)
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Storage full', 'QuotaExceededError')
      })
    const frames = new Map<number, FrameRequestCallback>()
    let id = 0
    let now = 0
    let intersect!: (entries: { isIntersecting: boolean }[]) => void
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
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
    vi.stubGlobal(
      'MessageChannel',
      class {
        port1 = { onmessage: null, close() {} }
        port2 = { postMessage() {} }
      },
    )
    const advance = () =>
      act(() => {
        for (let i = 0; i < 120; i++) {
          now += 16
          const pending = [...frames.values()]
          frames.clear()
          pending.forEach((callback) => callback(now))
        }
      })
    const card = (locale: 'en' | 'ru' = 'en') => (
      <AuthCardFrame locale={locale}>
        <input aria-label="Email" />
      </AuthCardFrame>
    )
    const user = userEvent.setup()
    const first = render(card())
    await waitFor(() => expect(intersect).toBeTypeOf('function'))
    act(() => intersect([{ isIntersecting: true }]))
    advance()
    expect(model.set.mock.lastCall?.[0].model).toBeGreaterThan(0)
    const pause = screen.getByRole('button', { name: 'Pause animation' })
    await user.click(pause)
    expect(pause).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByLabelText('Email'))
    await user.tab()
    act(() => {
      intersect([{ isIntersecting: false }])
      document.dispatchEvent(new Event('visibilitychange'))
      intersect([{ isIntersecting: true }])
    })
    advance()
    const stopped = model.set.mock.lastCall?.[0].model
    advance()
    expect(model.set.mock.lastCall?.[0].model).toBe(stopped)
    expect(frames.size).toBe(0)
    first.unmount()
    render(card('ru'))
    const savedPause = screen.getByRole('button', { name: 'Приостановить анимацию' })
    expect(savedPause).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(document.querySelector('.auth-concorde[data-ready]')).not.toBeNull())
    act(() => intersect([{ isIntersecting: true }]))
    advance()
    expect(frames.size).toBe(0)
    await user.click(savedPause)
    advance()
    expect(savedPause).toHaveAttribute('aria-pressed', 'false')
    expect(frames.size).toBe(1)
    expect(model.set.mock.lastCall?.[0].model).toBeGreaterThan(0)
  },
)
