// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { useProgressiveCount } from './progressive'

function List({ total }: { total: number }) {
  const count = useProgressiveCount(total, 60, 150)
  return <p data-testid="count">{count}</p>
}
const shown = () => Number(screen.getByTestId('count').textContent)
const drain = async () => {
  for (let i = 0; i < 20; i++)
    await act(async () => {
      vi.runOnlyPendingTimers()
    })
}

afterEach(() => {
  vi.useRealTimers()
})

it('renders the first rows on the server and on hydration, then mounts the rest in chunks', async () => {
  expect(renderToString(<List total={1000} />)).toContain('>60<')
  vi.useFakeTimers()
  render(<List total={1000} />)
  expect(shown()).toBe(60)
  await act(async () => {
    vi.runOnlyPendingTimers()
  })
  expect(shown()).toBe(210)
  await drain()
  expect(shown()).toBe(1000)
})

it('shows a sort or a small change at once, and grows a large widening from what is mounted', async () => {
  vi.useFakeTimers()
  const view = render(<List total={1000} />)
  await drain()
  view.rerender(<List total={1000} />)
  expect(shown()).toBe(1000)
  view.rerender(<List total={62} />)
  expect(shown()).toBe(62)
  view.rerender(<List total={150} />)
  expect(shown()).toBe(150)
  view.rerender(<List total={1000} />)
  expect(shown()).toBe(150)
  await drain()
  expect(shown()).toBe(1000)
})
