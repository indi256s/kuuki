// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { useReorder } from './use-reorder'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
// Reduced motion makes the settle instant, which is what jsdom (no animation clock) can observe.
const reduced = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'),
    addEventListener() {},
    removeEventListener() {},
  }))

const ids = ['rankings', 'fleet', 'crossings'] as SectionId[]
function Flow({
  onCommit,
  announce,
}: {
  onCommit: (id: SectionId, index: number) => void
  announce: () => void
}) {
  const reorder = useReorder({ ids, onCommit, announce })
  return (
    <div data-testid="flow">
      {ids.map((id, i) => {
        const b = reorder.bindings(id)
        return (
          <section
            key={id}
            ref={b.ref}
            data-id={id}
            data-row={i}
            data-dragging={b.active || undefined}
          >
            <header onPointerDown={b.onPointerDown}>{id}</header>
            <p id={`body-${id}`}>body</p>
          </section>
        )
      })}
    </div>
  )
}
// Cards stack 100px apart; row i spans [i*100, i*100+90].
function stack() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const row = Number(
      this.closest<HTMLElement>('[data-row]')?.dataset.row ?? this.dataset.row ?? 0,
    )
    return {
      left: 0,
      right: 400,
      top: row * 100,
      bottom: row * 100 + 90,
      width: 400,
      height: 90,
      x: 0,
      y: row * 100,
      toJSON() {},
    } as DOMRect
  })
}
const drag = (header: Element, to: number) => {
  fireEvent.pointerDown(header, {
    button: 0,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'mouse',
    clientX: 10,
    clientY: 10,
  })
  fireEvent.pointerMove(window, { pointerId: 1, clientX: 12, clientY: 20 })
  fireEvent.pointerMove(window, { pointerId: 1, clientX: 12, clientY: to })
}

it('lifts a hidden-from-AT copy, previews the new slot with CSS order and commits once on release', () => {
  stack()
  reduced()
  const onCommit = vi.fn(),
    announce = vi.fn()
  const { container } = render(<Flow onCommit={onCommit} announce={announce} />)
  drag(container.querySelector('header')!, 260)
  const ghost = container.querySelector('.ov3-ghost')!
  expect(ghost.getAttribute('aria-hidden')).toBe('true')
  expect(ghost.hasAttribute('inert')).toBe(true)
  expect(ghost.querySelector('[id]')).toBeNull()
  expect(
    [...container.querySelectorAll<HTMLElement>('[data-testid=flow] > section')].map(
      (card) => card.style.order,
    ),
  ).toEqual(['2', '0', '1'])
  expect(onCommit).not.toHaveBeenCalled()
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 12, clientY: 260 })
  expect(onCommit).toHaveBeenCalledOnce()
  expect(onCommit).toHaveBeenCalledWith('rankings', 2)
  expect(announce).toHaveBeenCalledOnce()
  expect(container.querySelector('.ov3-ghost')).toBeNull()
})

it('Escape reverts the preview without committing and removes the ghost', () => {
  stack()
  reduced()
  const onCommit = vi.fn()
  const { container } = render(<Flow onCommit={onCommit} announce={vi.fn()} />)
  drag(container.querySelector('header')!, 260)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onCommit).not.toHaveBeenCalled()
  expect(container.querySelector('.ov3-ghost')).toBeNull()
  expect(
    [...container.querySelectorAll<HTMLElement>('[data-testid=flow] > section')].map(
      (card) => card.style.order,
    ),
  ).toEqual(['', '', ''])
  fireEvent.pointerUp(window, { pointerId: 1 })
  expect(onCommit).not.toHaveBeenCalled()
})
