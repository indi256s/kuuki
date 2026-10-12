// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ patch: vi.fn() }))
vi.mock('@kuuki/client/apiClient', async (original) => ({
  ...(await original<typeof import('@kuuki/client/apiClient')>()),
  api: { patch: m.patch },
}))
vi.mock('./activity', () => ({ trackPrivateOperation: () => () => {} }))

import { reconcileAccent } from './appearance'

describe('reconcileAccent', () => {
  it('lets a canonical profile accent win and leaves the profile alone', () => {
    expect(reconcileAccent('ai', 'sakura')).toEqual({ device: 'ai', save: null })
  })
  it('adopts a retired profile name and rewrites it canonical', () => {
    expect(reconcileAccent('blue', 'sakura')).toEqual({ device: 'ai', save: 'ai' })
    expect(reconcileAccent('terracotta', 'matcha')).toEqual({ device: 'shu', save: 'shu' })
  })
  it.each([null, undefined, '', 'chartreuse'])(
    'keeps the device accent and saves it when the profile holds %j',
    (profile) => {
      expect(reconcileAccent(profile, 'matcha')).toEqual({ device: 'matcha', save: 'matcha' })
    },
  )
})

describe('AccentSync', () => {
  const root = document.documentElement
  let AccentSync: typeof import('./appearance').AccentSync
  beforeEach(async () => {
    // The last-saved accent is per page session; a fresh module is a fresh page load.
    vi.resetModules()
    ;({ AccentSync } = await import('./appearance'))
    m.patch.mockResolvedValue({})
    document.cookie = 'kuuki_accent=sakura; Path=/'
    root.dataset.accent = 'sakura'
  })
  afterEach(() => {
    vi.clearAllMocks()
    document.cookie = 'kuuki_accent=; Max-Age=0; Path=/'
    delete root.dataset.accent
    delete root.dataset.accentScope
  })

  it('adopts the profile accent on the device without writing it back', () => {
    render(<AccentSync profileAccent="ai" />)
    expect(root.dataset.accent).toBe('ai')
    expect(document.cookie).toContain('kuuki_accent=ai')
    expect(m.patch).not.toHaveBeenCalled()
  })

  it('sends the device accent to a profile that has none', () => {
    render(<AccentSync profileAccent={null} />)
    expect(root.dataset.accent).toBe('sakura')
    expect(m.patch).toHaveBeenCalledWith(
      '/api/profiles/me',
      { theme_color: 'sakura' },
      expect.anything(),
    )
  })

  it('reconciles once per mount', () => {
    const view = render(<AccentSync profileAccent={null} />)
    view.rerender(<AccentSync profileAccent="matcha" />)
    expect(m.patch).toHaveBeenCalledTimes(1)
    expect(root.dataset.accent).toBe('sakura')
  })

  it('keeps a pick made during the automatic save: sent after it, cached over it', async () => {
    const { persistAccent } = await import('./appearance')
    const sent: Array<{ accent: string; finish: () => void }> = []
    m.patch.mockImplementation(
      (_path: string, body: { theme_color: string }) =>
        new Promise((finish) => sent.push({ accent: body.theme_color, finish: () => finish({}) })),
    )
    const first = render(<AccentSync profileAccent={null} />)
    await vi.waitFor(() => expect(sent.map((request) => request.accent)).toEqual(['sakura']))
    const picked = persistAccent('asagi')
    // The pick waits for the automatic save instead of racing it to the server.
    expect(sent).toHaveLength(1)
    sent[0].finish()
    await vi.waitFor(() =>
      expect(sent.map((request) => request.accent)).toEqual(['sakura', 'asagi']),
    )
    sent[1].finish()
    await picked
    first.unmount()
    // The next shell mount still sees a profile without an accent; the cache holds the pick.
    document.cookie = 'kuuki_accent=sakura; Path=/'
    root.dataset.accent = 'sakura'
    render(<AccentSync profileAccent={null} />)
    expect(root.dataset.accent).toBe('asagi')
    expect(sent).toHaveLength(2)
  })

  it('caches the last successful write even when a later one fails', async () => {
    const { persistAccent } = await import('./appearance')
    // Matcha is saved; Ai lands, then Sakura fails: the server holds Ai.
    await persistAccent('matcha')
    await persistAccent('ai')
    m.patch.mockRejectedValueOnce(new Error('offline'))
    await expect(persistAccent('sakura')).rejects.toThrow('offline')
    root.dataset.accent = 'sakura'
    document.cookie = 'kuuki_accent=sakura; Path=/'
    render(<AccentSync profileAccent="matcha" />)
    expect(root.dataset.accent).toBe('ai')
    expect(m.patch).toHaveBeenCalledTimes(3)
  })

  it('keeps the next pick over a failed legacy rewrite', async () => {
    const { persistAccent, setAccent } = await import('./appearance')
    m.patch.mockRejectedValueOnce(new Error('offline'))
    render(<AccentSync profileAccent="blue" />)
    await vi.waitFor(() => expect(m.patch).toHaveBeenCalledTimes(1))
    await new Promise((settle) => setTimeout(settle))
    // The picker's own event must not re-run reconciliation with the stale profile value.
    setAccent('asagi')
    await persistAccent('asagi')
    expect(root.dataset.accent).toBe('asagi')
    expect(document.cookie).toContain('kuuki_accent=asagi')
    expect(m.patch.mock.calls.map((call) => call[1])).toEqual([
      { theme_color: 'ai' },
      { theme_color: 'asagi' },
    ])
  })

  it('waits out an owner scope, then reconciles when the scope ends', () => {
    root.dataset.accent = 'matcha'
    root.dataset.accentScope = 'owner'
    render(<AccentSync profileAccent="ai" />)
    expect(m.patch).not.toHaveBeenCalled()
    expect(document.cookie).toContain('kuuki_accent=sakura')
    delete root.dataset.accentScope
    window.dispatchEvent(new Event('kuuki:appearance'))
    expect(root.dataset.accent).toBe('ai')
    expect(document.cookie).toContain('kuuki_accent=ai')
  })
})
