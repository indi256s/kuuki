// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { lazy, Suspense, type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { Deferred } from './deferred'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('keeps a cold child loading locally without hiding the surrounding page', async () => {
  let reveal!: () => void
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(notify: (entries: { isIntersecting: boolean }[]) => void) {
        reveal = () => notify([{ isIntersecting: true }])
      }
      observe() {}
      disconnect() {}
    },
  )
  let finish!: (module: { default: () => ReactNode }) => void
  const pending = new Promise<{ default: () => ReactNode }>((resolve) => {
    finish = resolve
  })
  const Content = lazy(() => pending)
  render(
    <Suspense fallback={<p>Page loading</p>}>
      <h1>Passport</h1>
      <Deferred fallback={<p role="status">Achievements loading</p>}>
        <Content />
      </Deferred>
    </Suspense>,
  )
  act(reveal)
  expect(screen.getByText('Passport')).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('Achievements loading')
  await act(async () => finish({ default: () => <p>Earned achievements</p> }))
  expect(screen.getByText('Earned achievements')).toBeVisible()
  expect(screen.queryByRole('status')).toBeNull()
})
