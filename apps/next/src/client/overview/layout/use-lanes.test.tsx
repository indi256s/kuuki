// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { laneSpan, useLanes } from './use-lanes'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function Flow({ ids }: { ids: string[] }) {
  const ref = useLanes(ids.join(','))
  return <div ref={ref} data-testid="flow">{ids.map(id => <section key={id} data-id={id} />)}</div>
}

it('spans each card by its height plus the 16px gap in 4px rows and re-measures when a card resizes', () => {
  const callbacks: ResizeObserverCallback[] = []
  vi.stubGlobal('ResizeObserver', class { constructor(cb: ResizeObserverCallback) { callbacks.push(cb) } observe() {} disconnect() {} })
  const heights: Record<string, number> = { a: 100, b: 41 }
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return heights[this.dataset.id ?? ''] ?? 0 })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1400)
  const { getByTestId, container } = render(<Flow ids={['a', 'b']} />)
  const card = (id: string) => container.querySelector<HTMLElement>(`[data-id=${id}]`)!
  expect(getByTestId('flow').dataset.lanes).toBe('2')
  expect(card('a').style.getPropertyValue('--ov-span')).toBe('29')
  expect(card('b').style.getPropertyValue('--ov-span')).toBe('15')
  act(() => callbacks[0]([{ target: card('b'), borderBoxSize: [{ blockSize: 200, inlineSize: 0 }] } as unknown as ResizeObserverEntry], {} as ResizeObserver))
  expect(card('b').style.getPropertyValue('--ov-span')).toBe(String(laneSpan(200)))
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1279)
  act(() => callbacks[0]([{ target: getByTestId('flow') } as unknown as ResizeObserverEntry], {} as ResizeObserver))
  expect(getByTestId('flow').dataset.lanes).toBe('1')
})
