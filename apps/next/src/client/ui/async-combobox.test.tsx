// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { AsyncCombobox } from './combobox'

type Item = { key: string; label: string }
const toOption = (item: Item) => ({ key: item.key, label: item.label, detail: 'Region · Country' })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})
afterEach(() => vi.useRealTimers())

function setup(search: (query: string) => Promise<Item[]>) {
  const onSelect = vi.fn()
  render(
    <>
      <AsyncCombobox<Item>
        label="City"
        locale="en"
        selected={null}
        search={(query) => search(query)}
        toOption={toOption}
        onSelect={onSelect}
        minChars={2}
      />
      <button type="button">elsewhere</button>
    </>,
  )
  return { onSelect, input: screen.getByRole('combobox', { name: 'City' }) }
}

const type = async (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300)
  })
}

describe('AsyncCombobox', () => {
  it('drops a late response for an older query', async () => {
    const first = deferred<Item[]>()
    const second = deferred<Item[]>()
    const search = vi.fn((query: string) => (query === 'tbi' ? first.promise : second.promise))
    const { input } = setup(search)
    await type(input, 'tbi')
    await type(input, 'tbil')
    // The older answer arrives after the newer request started.
    await act(async () => first.resolve([{ key: 'old', label: 'Old result' }]))
    expect(screen.queryByText('Old result')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Searching…')
    await act(async () => second.resolve([{ key: 'new', label: 'Tbilisi' }]))
    expect(screen.getByRole('option', { name: /Tbilisi/ })).toBeTruthy()
    expect(screen.queryByText('Old result')).toBeNull()
  })

  it('does not commit the only match when focus leaves the field', async () => {
    const { input, onSelect } = setup(async () => [{ key: 'one', label: 'Kars' }])
    input.focus()
    await type(input, 'kars')
    expect(screen.getByRole('option', { name: /Kars/ })).toBeTruthy()
    fireEvent.blur(input, { relatedTarget: screen.getByText('elsewhere') })
    expect(onSelect).not.toHaveBeenCalled()
    // Closed, and the typed query is dropped rather than turned into a choice.
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('chooses with Enter only on a highlighted option, and reports a failed search with retry', async () => {
    let fail = true
    const { input, onSelect } = setup(async () => {
      if (fail) throw new Error('down')
      return [{ key: 'one', label: 'Kars' }]
    })
    await type(input, 'kars')
    expect(screen.getByRole('status').textContent).toBe('Search failed.')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith({ key: 'one', label: 'Kars' })
  })
  it('keeps the typed text as an unresolved query after Escape or blur, without choosing', async () => {
    const { input, onSelect } = setup(async () => [{ key: 'one', label: 'Kars' }])
    input.focus()
    await type(input, 'kar')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('option')).toBeNull()
    expect((input as HTMLInputElement).value).toBe('kar')
    fireEvent.blur(input, { relatedTarget: screen.getByText('elsewhere') })
    expect((input as HTMLInputElement).value).toBe('kar')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('keeps focus on Retry until the click lands', async () => {
    const { input } = setup(async () => {
      throw new Error('down')
    })
    await type(input, 'kars')
    // preventDefault on mousedown is what stops the browser moving focus (and the blur closing the list).
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Retry' }))).toBe(false)
  })

  it('keeps the previous results on screen while a new query loads, but never lets one be chosen', async () => {
    const next = deferred<Item[]>()
    const { input, onSelect } = setup(async (query) =>
      query === 'kars' ? [{ key: 'one', label: 'Kars' }] : next.promise,
    )
    input.focus()
    await type(input, 'kars')
    await type(input, 'karsx')
    const stale = screen.getByRole('option', { name: /Kars/ })
    expect(stale).toHaveAttribute('aria-disabled', 'true')
    expect(stale).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('status').textContent).toBe('Searching…')
    fireEvent.click(stale)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()
    await act(async () => next.resolve([{ key: 'two', label: 'Karsx' }]))
    expect(screen.queryByRole('option', { name: /^Kars\b(?!x)/ })).toBeNull()
    expect(screen.getByRole('option', { name: /Karsx/ })).not.toHaveAttribute('aria-disabled')
  })
})
