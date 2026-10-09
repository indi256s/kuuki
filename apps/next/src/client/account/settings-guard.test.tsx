// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { useSettingsGuard } from './settings-guard'
const router = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
function Harness({ dirty = true, busy = false }: { dirty?: boolean; busy?: boolean }) {
  const guard = useSettingsGuard(dirty, busy, 'en')
  return guard.dialog
}

function installBootstrap() {
  const push = history.pushState,
    replace = history.replaceState
  const registered: Array<
    [string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]
  > = []
  const add = window.addEventListener.bind(window)
  const spy = vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    registered.push([type, listener, options])
    add(type, listener, options)
  })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  try {
    new Function(readFileSync('public/bootstrap.js', 'utf8'))()
  } finally {
    spy.mockRestore()
  }
  const earlyPop = registered.find(([type]) => type === 'popstate')![1] as EventListener
  return {
    earlyPop,
    replace,
    cleanup: () => {
      for (const [type, listener, options] of registered)
        window.removeEventListener(type, listener, options)
      history.pushState = push
      history.replaceState = replace
      delete (window as Window & { __kuukiHistoryGate?: boolean }).__kuukiHistoryGate
      vi.unstubAllGlobals()
    },
  }
}

let index = 1
function pop(to: number) {
  index = to
  history.replaceState({ __kuukiHistoryIndex: to, __NA: true }, '', '/settings')
  act(() => window.dispatchEvent(new PopStateEvent('popstate', { state: history.state })))
}
beforeEach(() => {
  index = 1
  history.replaceState({ __kuukiHistoryIndex: 1, __NA: true }, '', '/settings')
  vi.spyOn(history, 'go').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(window, 'navigation', { configurable: true, value: undefined })
})
describe.each([true, false])('Settings traversal with Navigation API %s', (native) => {
  beforeEach(() =>
    Object.defineProperty(window, 'navigation', {
      configurable: true,
      value: native
        ? {
            get currentEntry() {
              return { index }
            },
          }
        : undefined,
    }),
  )
  it('restores Forward, stays without truncating history, and repeats the approved direction', () => {
    render(<Harness />)
    pop(2)
    expect(history.go).toHaveBeenLastCalledWith(-1)
    pop(1)
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    pop(2)
    pop(1)
    fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }))
    expect(history.go).toHaveBeenLastCalledWith(1)
  })
  it('tracks an approved traversal retained after interrupted RSC before guarding another Back', () => {
    render(<Harness />)
    pop(0)
    expect(history.go).toHaveBeenLastCalledWith(1)
    pop(1)
    fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }))
    pop(0) // The request fails: the Settings component remains mounted.
    pop(-1)
    expect(history.go).toHaveBeenLastCalledWith(1)
  })
  it('tracks a retained App Router push before later Back', () => {
    render(<Harness />)
    index = 2
    history.replaceState({ __kuukiHistoryIndex: 2 }, '', '/settings')
    act(() => window.dispatchEvent(new Event('kuuki:history-index')))
    pop(1)
    expect(history.go).toHaveBeenLastCalledWith(1)
  })
  it('tracks clean same-component history before later unsaved changes', () => {
    const view = render(<Harness dirty={false} />)
    pop(2)
    view.rerender(<Harness />)
    pop(1)
    expect(history.go).toHaveBeenLastCalledWith(1)
  })
})

it('keeps a real native hash entry usable without a leave prompt before bootstrap tags it', async () => {
  Object.defineProperty(window, 'navigation', { configurable: true, value: undefined })
  const bootstrap = installBootstrap()
  try {
    render(<Harness />)
    await act(async () => {
      window.location.hash = '#export'
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    await waitFor(() => expect(history.state.__kuukiHistoryIndex).toBe(2))
    expect(history.go).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  } finally {
    bootstrap.cleanup()
  }
})

describe.each([true, false])('early native traversal gate with Navigation API %s', (native) => {
  it.each([0, 2])(
    'restores dirty traversal to index %s before an earlier Next listener can unmount Settings',
    (destination) => {
      Object.defineProperty(window, 'navigation', {
        configurable: true,
        value: native
          ? {
              get currentEntry() {
                return { index }
              },
            }
          : undefined,
      })
      const bootstrap = installBootstrap()
      let view: ReturnType<typeof render>
      const next = vi.fn(() => view.unmount())
      // Runtime evidence invokes bootstrap, then Next, and removes the late Settings listener.
      // Dispatching a synthetic DOM pop instead would incorrectly prioritize capture in jsdom.
      window.addEventListener('popstate', next)
      try {
        view = render(<Harness />)
        const traverse = (to: number) => {
          index = to
          bootstrap.replace.call(
            history,
            { __kuukiHistoryIndex: to, __NA: true },
            '',
            to === 1 ? '/settings' : '/journal',
          )
          const event = new PopStateEvent('popstate', { state: history.state })
          const stopped = vi.spyOn(event, 'stopImmediatePropagation')
          act(() => {
            bootstrap.earlyPop(event)
            if (!stopped.mock.calls.length) next()
          })
        }
        traverse(destination)
        expect(next).not.toHaveBeenCalled()
        expect(history.go).toHaveBeenLastCalledWith(1 - destination)
        expect(screen.getByRole('button', { name: 'Stay' })).toBeVisible()
        traverse(1)
        expect(next).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }))
        expect(history.go).toHaveBeenLastCalledWith(destination - 1)
        traverse(destination)
        expect(next).toHaveBeenCalledTimes(1)
        const afterUnmount = new Event('kuuki:before-popstate', { cancelable: true })
        window.dispatchEvent(afterUnmount)
        expect(afterUnmount.defaultPrevented).toBe(false)
      } finally {
        window.removeEventListener('popstate', next)
        bootstrap.cleanup()
      }
    },
  )
})
it('blocks the early native traversal while Settings is busy without opening a leave dialog', () => {
  const bootstrap = installBootstrap()
  const view = render(<Harness dirty={false} busy />)
  try {
    bootstrap.replace.call(history, { __kuukiHistoryIndex: 0, __NA: true }, '', '/journal')
    const event = new PopStateEvent('popstate', { state: history.state })
    const stopped = vi.spyOn(event, 'stopImmediatePropagation')
    act(() => bootstrap.earlyPop(event))
    expect(stopped).toHaveBeenCalledOnce()
    expect(history.go).toHaveBeenLastCalledWith(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  } finally {
    view.unmount()
    bootstrap.cleanup()
  }
})
