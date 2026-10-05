// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { useSettingsGuard } from './settings-guard'
const router = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
function Harness({ dirty = true }: { dirty?: boolean }) { const guard = useSettingsGuard(dirty, false, 'en'); return guard.dialog }
let index = 1
function pop(to: number) { index = to; history.replaceState({ __kuukiHistoryIndex: to, __NA: true }, '', '/settings'); act(() => window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }))) }
beforeEach(() => { index = 1; history.replaceState({ __kuukiHistoryIndex: 1, __NA: true }, '', '/settings'); vi.spyOn(history, 'go').mockImplementation(() => {}) })
afterEach(() => { vi.restoreAllMocks(); Object.defineProperty(window, 'navigation', { configurable: true, value: undefined }) })
describe.each([true, false])('Settings traversal with Navigation API %s', native => {
  beforeEach(() => Object.defineProperty(window, 'navigation', { configurable: true, value: native ? { get currentEntry() { return { index } } } : undefined }))
  it('restores Forward, stays without truncating history, and repeats the approved direction', () => {
    render(<Harness />)
    pop(2)
    expect(history.go).toHaveBeenLastCalledWith(-1)
    pop(1)
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    pop(2); pop(1)
    fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }))
    expect(history.go).toHaveBeenLastCalledWith(1)
  })
  it('tracks an approved traversal retained after interrupted RSC before guarding another Back', () => {
    render(<Harness />)
    pop(0); expect(history.go).toHaveBeenLastCalledWith(1)
    pop(1)
    fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }))
    pop(0) // The request fails: the Settings component remains mounted.
    pop(-1)
    expect(history.go).toHaveBeenLastCalledWith(1)
  })
  it('tracks a retained App Router push before later Back', () => {
    render(<Harness />)
    index = 2; history.replaceState({ __kuukiHistoryIndex: 2 }, '', '/settings')
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
  const push = history.pushState, replace = history.replaceState
  try {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    new Function(readFileSync('public/bootstrap.js', 'utf8'))()
    render(<Harness />)
    await act(async () => { window.location.hash = '#export'; await new Promise(resolve => setTimeout(resolve, 20)) })
    await waitFor(() => expect(history.state.__kuukiHistoryIndex).toBe(2))
    expect(history.go).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  } finally { history.pushState = push; history.replaceState = replace; vi.unstubAllGlobals() }
})
