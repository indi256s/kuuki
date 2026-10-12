// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { OwnerAccent } from './owner-accent'

const root = document.documentElement
let writes: string[]
beforeEach(() => {
  document.cookie = 'kuuki_accent=sakura; Path=/'
  root.dataset.accent = 'sakura'
  root.dataset.theme = 'dark'
  writes = []
  const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!
  vi.spyOn(document, 'cookie', 'set').mockImplementation((value) => {
    writes.push(value)
    descriptor.set!.call(document, value)
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  document.cookie = 'kuuki_accent=; Max-Age=0; Path=/'
  delete root.dataset.accent
  delete root.dataset.accentScope
  delete root.dataset.theme
})

it('shows the owner accent without touching cookies or mode, then restores the visitor accent on leave', () => {
  const view = render(<OwnerAccent accent="matcha" />)
  expect(root.dataset.accent).toBe('matcha')
  expect(root.dataset.accentScope).toBe('owner')
  expect(root.dataset.theme).toBe('dark')
  view.unmount()
  expect(root.dataset.accent).toBe('sakura')
  expect(root.dataset.accentScope).toBeUndefined()
  expect(root.dataset.theme).toBe('dark')
  expect(writes).toEqual([])
})

it('emits the parse-time script for a hard load', () => {
  const view = render(<OwnerAccent accent="asagi" />)
  const source = view.container.querySelector('script')!.textContent!
  root.dataset.accent = 'sakura'
  delete root.dataset.accentScope
  new Function(source)()
  expect(root.dataset.accent).toBe('asagi')
  expect(root.dataset.accentScope).toBe('owner')
  expect(writes).toEqual([])
})

it('moves between owners without leaving the scope', () => {
  const view = render(<OwnerAccent accent="matcha" />)
  view.rerender(<OwnerAccent accent="ai" />)
  expect(root.dataset.accent).toBe('ai')
  expect(root.dataset.accentScope).toBe('owner')
})
