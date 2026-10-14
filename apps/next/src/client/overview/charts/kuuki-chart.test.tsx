// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { Sheet } from '../../ui/sheet'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { KuukiChart, type ChartPoint, type KuukiChartProps } from './kuuki-chart'
import { ArcLine } from './arc-line'
import { ArcBrush } from './arc-brush'
import { LazyChart } from './lazy-chart'
import { TableView } from './table-view'
import { MAKER_PALETTE } from './palettes'

const rows = [
  { route: 'TBS–NRT', flights: 3 },
  { route: 'NRT–TBS', flights: 2 },
]
const points = rows.map((datum) => ({ key: datum.route, datum, label: datum.route }))
const table = {
  caption: 'Flights by route',
  columns: [
    { key: 'route', label: 'Route' },
    { key: 'flights', label: 'Flights', numeric: true },
  ],
  rows,
}
function Chart(props: Partial<Omit<KuukiChartProps<(typeof rows)[number]>, 'children'>> = {}) {
  return (
    <KuukiChart points={points} height={240} ariaLabel="Routes" table={table} inView {...props}>
      {(mark) =>
        (props.points ?? points).map((point) => (
          <g {...mark(point)} key={point.key}>
            <rect width={40} height={40} />
          </g>
        ))
      }
    </KuukiChart>
  )
}
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 40,
    bottom: 40,
    width: 40,
    height: 40,
    toJSON() {},
  })
  document.documentElement.lang = 'en'
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function select(mark: Element, pointerType: string) {
  const down = new MouseEvent('pointerdown', { bubbles: true })
  Object.defineProperty(down, 'pointerType', { value: pointerType })
  fireEvent(mark, down)
  fireEvent.click(mark)
}

it('server-renders an accessible SVG with its description and handles empty data', () => {
  const markup = renderToString(<Chart ariaDescription="Flights per route" />)
  expect(markup).toContain('<svg')
  expect(markup).toContain('Flights per route')
  expect(markup).toContain('TBS–NRT')
  expect(renderToString(<Chart points={[]} table={{ ...table, rows: [] }} />)).toContain('<svg')
})
it('mouse and keyboard select the focused real datum after arrow and boundary navigation', () => {
  const pick = vi.fn()
  render(<Chart onPick={pick} />)
  const first = screen.getByRole('button', { name: rows[0].route }),
    second = screen.getByRole('button', { name: rows[1].route })
  select(first, 'mouse')
  expect(pick).toHaveBeenLastCalledWith(points[0])
  fireEvent.keyDown(first, { key: 'ArrowRight' })
  expect(second).toHaveFocus()
  fireEvent.keyDown(second, { key: 'Enter' })
  expect(pick).toHaveBeenLastCalledWith(points[1])
  fireEvent.keyDown(second, { key: 'Home' })
  expect(first).toHaveFocus()
  fireEvent.keyDown(first, { key: ' ' })
  expect(pick).toHaveBeenCalledTimes(3)
  fireEvent.keyDown(screen.getByRole('group', { name: 'Routes' }), { key: 'End' })
  fireEvent.keyDown(screen.getByRole('group', { name: 'Routes' }), { key: 'Enter' })
  expect(pick).toHaveBeenLastCalledWith(points[1])
})
it('identifies the first point on keyboard entry before filtering it', async () => {
  const user = userEvent.setup(),
    pick = vi.fn()
  render(<Chart onPick={pick} />)
  await user.tab()
  expect(screen.getByRole('button', { name: rows[0].route })).toHaveFocus()
  expect(screen.getByRole('tooltip', { name: rows[0].route })).toBeInTheDocument()
  await user.keyboard('{Enter}')
  expect(pick).toHaveBeenCalledExactlyOnceWith(points[0])
})
it('allows backward tab navigation out of the chart', async () => {
  const user = userEvent.setup()
  render(
    <>
      <button>Before chart</button>
      <Chart />
    </>,
  )
  await user.tab()
  await user.tab()
  expect(screen.getByRole('button', { name: rows[0].route })).toHaveFocus()
  await user.tab({ shift: true })
  expect(screen.getByRole('button', { name: 'Before chart' })).toHaveFocus()
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})
it('opens secondary actions by keyboard and returns focus after an action', async () => {
  const user = userEvent.setup(),
    run = vi.fn(),
    pick = vi.fn()
  render(
    <Chart
      onPick={pick}
      actions={(point) => [{ label: 'Open flight', run: () => run(point.key) }]}
    />,
  )
  await user.tab()
  await user.keyboard('{Shift>}{F10}{/Shift}')
  const action = within(screen.getByRole('dialog', { name: rows[0].route })).getByRole('button', {
    name: 'Open flight',
  })
  expect(action).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(run).toHaveBeenCalledExactlyOnceWith(points[0].key)
  expect(pick).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: rows[0].route })).toHaveFocus()
})
it('dismisses keyboard tooltips when focus leaves the chart', async () => {
  const user = userEvent.setup()
  render(
    <>
      <Chart />
      <button type="button">Next card</button>
    </>,
  )
  fireEvent.keyDown(screen.getByRole('group', { name: 'Routes' }), { key: 'Home' })
  expect(screen.getByRole('tooltip')).toBeInTheDocument()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Next card' })).toHaveFocus()
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})
it('touch pins portaled actions without direct selection and keeps focused actions on current data', () => {
  const pick = vi.fn(),
    oldRun = vi.fn(),
    newRun = vi.fn()
  const { container, rerender } = render(
    <Chart
      onPick={pick}
      palette={MAKER_PALETTE}
      actions={() => [{ label: 'Add filter', run: oldRun }]}
    />,
  )
  select(screen.getByRole('button', { name: rows[0].route }), 'touch')
  const dialog = screen.getByRole('dialog'),
    action = within(dialog).getByRole('button', { name: 'Add filter' })
  expect(container.contains(dialog)).toBe(false)
  expect(dialog.style.getPropertyValue('--kc-chart-1')).toBe('var(--cat-maker-airbus)')
  expect(action).toHaveFocus()
  const refreshed: ChartPoint<(typeof rows)[number]>[] = [
    { ...points[0], datum: { ...rows[0], flights: 9 } },
    points[1],
  ]
  rerender(
    <Chart
      points={refreshed}
      onPick={pick}
      actions={(point) => [{ label: 'Add filter', run: () => newRun(point.datum.flights) }]}
    />,
  )
  expect(action).toHaveFocus()
  fireEvent.click(action)
  expect(newRun).toHaveBeenCalledWith(9)
  expect(oldRun).not.toHaveBeenCalled()
  expect(pick).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: rows[0].route })).toHaveFocus()
})
it('with tapPicks a touch tap picks the point and opens no pinned tooltip; the context menu still pins', () => {
  const pick = vi.fn()
  render(
    <Chart
      onPick={pick}
      tapPicks
      selected={(point) => point.key === rows[1].route}
      actions={() => [{ label: 'Add filter', run: vi.fn() }]}
    />,
  )
  const [first, second] = rows.map((row) => screen.getByRole('button', { name: row.route }))
  expect(second).toHaveAttribute('aria-current', 'true')
  expect(second).toHaveAttribute('data-picked', 'true')
  expect(first).not.toHaveAttribute('data-picked')
  select(first, 'touch')
  expect(pick).toHaveBeenCalledWith(points[0])
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.contextMenu(first)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
it('hover, focus and pin only mark the point: colors stay, nothing is dimmed or filtered', () => {
  const pick = vi.fn()
  render(
    <KuukiChart
      points={points}
      height={240}
      ariaLabel="Routes"
      table={table}
      inView
      onPick={pick}
      applied={(point) => point.key === rows[1].route}
      actions={() => [{ label: 'Add filter', run: pick }]}
    >
      {(mark) =>
        points.map((point, index) => (
          <g {...mark(point)} key={point.key}>
            <rect width={40} height={40} fill={`var(--kc-chart-${index + 1})`} />
          </g>
        ))
      }
    </KuukiChart>,
  )
  const marks = () => rows.map((row) => screen.getByRole('button', { name: row.route }))
  const look = () =>
    marks().map((mark) => [mark.querySelector('rect')!.getAttribute('fill'), mark.style.opacity])
  const before = look()
  const [first, second] = marks()
  expect(second).toHaveAttribute('aria-pressed', 'true')
  expect(second).toHaveAttribute('data-filtered', 'true')
  expect(first).toHaveAttribute('aria-pressed', 'false')
  fireEvent.pointerEnter(first, { pointerType: 'mouse' })
  expect(first).toHaveAttribute('data-selected', 'true')
  expect(look()).toEqual(before)
  fireEvent.pointerLeave(first)
  fireEvent.focus(first)
  expect(first).toHaveAttribute('data-selected', 'true')
  expect(first).not.toHaveAttribute('data-pinned')
  expect(look()).toEqual(before)
  select(first, 'touch')
  expect(first).toHaveAttribute('data-pinned', 'true')
  expect(look()).toEqual(before)
  expect(pick).not.toHaveBeenCalled()
})
it('pinned selection dismisses on Escape, outside input, and disappearing data', () => {
  const { rerender } = render(
    <>
      <Chart />
      <button>Outside</button>
    </>,
  )
  const pin = () => select(screen.getByRole('button', { name: rows[0].route }), 'touch')
  pin()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  pin()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  pin()
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  pin()
  rerender(<Chart points={[points[1]]} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('keeps touch actions and dismissal inside the real Sheet focus scope', async () => {
  const user = userEvent.setup(),
    run = vi.fn(),
    changed = vi.fn()
  function SheetChart() {
    const [open, setOpen] = useState(false)
    return (
      <Sheet
        open={open}
        onOpenChange={(next) => {
          changed(next)
          setOpen(next)
        }}
        title="Chart sheet"
        trigger={<button>Open chart sheet</button>}
        closeLabel="Close sheet"
      >
        <Chart actions={() => [{ label: 'Open flight', run }]} />
      </Sheet>
    )
  }
  render(<SheetChart />)
  await user.click(screen.getByRole('button', { name: 'Open chart sheet' }))
  const sheet = await screen.findByRole('dialog', { name: 'Chart sheet' })
  const mark = within(sheet).getByRole('button', { name: rows[0].route })
  const pin = () => select(mark, 'touch')
  pin()
  const tip = within(sheet).getByRole('dialog', { name: rows[0].route })
  const action = within(tip).getByRole('button', { name: 'Open flight' })
  expect(action).toHaveFocus()
  await user.click(within(tip).getByRole('button', { name: 'Close' }))
  expect(sheet).toBeInTheDocument()
  expect(mark).toHaveFocus()
  pin()
  await user.keyboard('{Escape}')
  expect(within(sheet).queryByRole('dialog')).not.toBeInTheDocument()
  expect(sheet).toBeInTheDocument()
  expect(mark).toHaveFocus()
  pin()
  await user.click(
    within(within(sheet).getByRole('dialog')).getByRole('button', { name: 'Open flight' }),
  )
  expect(run).toHaveBeenCalledTimes(1)
  expect(mark).toHaveFocus()
  expect(changed).toHaveBeenCalledExactlyOnceWith(true)
})
it('line geometry spaces actual UTC dates and renders a finite zero-valued area on the server', () => {
  const day = 86_400_000,
    start = Date.UTC(2026, 0, 1)
  const linePoints = [0, 1, 10].map((offset, index) => ({
    key: String(index),
    label: String(index),
    datum: index,
    x: start + offset * day,
    y: 0,
  }))
  const { container } = render(
    <svg>
      <ArcLine
        points={linePoints}
        height={80}
        xDomain={[start, start + 10 * day]}
        yDomain={[0, 0]}
        stepAfter
        area
      />
    </svg>,
  )
  const positions = [...container.querySelectorAll('g')].map((point) =>
    Number(point.querySelector('circle')!.getAttribute('cx')),
  )
  // One day must occupy one tenth of the full ten-day interval, rather than index spacing.
  expect(positions[1] - positions[0]).toBeCloseTo((positions[2] - positions[0]) / 10)
  expect(positions[2]).toBeGreaterThan(positions[1])
  expect(container.querySelector('path[stroke]')).not.toHaveAttribute('d', '')
  const markup = renderToString(
    <svg>
      <ArcLine
        points={linePoints}
        height={80}
        xDomain={[start, start + 10 * day]}
        yDomain={[0, 0]}
        stepAfter
        area
      />
    </svg>,
  )
  expect(markup).not.toMatch(/NaN|Infinity/)
})
it('hydrates the real SVG adapters without replacing server marks and keeps real flight touch actions', async () => {
  const start = Date.UTC(2026, 0, 1),
    flight = { key: 'flight:42', label: 'TBS–NRT flight', datum: { flightId: 42 } },
    open = vi.fn(),
    recover = vi.fn()
  const fixture = (
    <>
      <KuukiChart
        points={[flight]}
        height={80}
        ariaLabel="Flight cells"
        table={table}
        inView
        actions={(point) => [{ label: 'Open flight', run: () => open(point.datum.flightId) }]}
      >
        {(mark) => (
          <>
            <ArcLine
              points={[{ ...flight, x: start, y: 1 }]}
              xDomain={[start, start + 86_400_000]}
              yDomain={[0, 1]}
              height={80}
              mark={mark}
            />
          </>
        )}
      </KuukiChart>
      <ArcBrush
        bounds={[start, start + 86_400_000]}
        value={[start, start]}
        fromLabel="From"
        toLabel="To"
        onChange={() => {}}
        onCommit={() => {}}
      />
    </>
  )
  const container = document.createElement('div')
  container.innerHTML = renderToString(fixture)
  document.body.appendChild(container)
  const serverSvg = container.querySelector('svg'),
    serverMark = container.querySelector('[data-kc-key]')!
  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    await act(async () => {
      root = hydrateRoot(container, fixture, { onRecoverableError: recover })
    })
    expect(recover).not.toHaveBeenCalled()
    expect(container.querySelector('svg')).toBe(serverSvg)
    expect(container.querySelector('[data-kc-key]')).toBe(serverMark)
    select(serverMark, 'touch')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Open flight' }))
    expect(open).toHaveBeenCalledExactlyOnceWith(42)
  } finally {
    await act(async () => root?.unmount())
    container.remove()
  }
})
it('brush updates a UTC draft and commits once at pointer or keyboard completion, including a single day', () => {
  const start = Date.UTC(2026, 0, 1),
    day = 86_400_000,
    changed = vi.fn(),
    committed = vi.fn()
  function Brush() {
    const [range, setRange] = useState<readonly [number, number]>([start, start + 10 * day])
    return (
      <ArcBrush
        bounds={[start, start + 10 * day]}
        value={range}
        fromLabel="From"
        toLabel="To"
        onChange={(value) => {
          changed(value)
          setRange(value)
        }}
        onCommit={committed}
      />
    )
  }
  render(<Brush />)
  const from = screen.getByRole('slider', { name: 'From' }),
    to = screen.getByRole('slider', { name: 'To' })
  fireEvent.change(from, { target: { value: start + 2 * day } })
  expect(changed).toHaveBeenLastCalledWith([start + 2 * day, start + 10 * day])
  expect(committed).not.toHaveBeenCalled()
  fireEvent.pointerUp(from)
  fireEvent.blur(from)
  expect(committed).toHaveBeenCalledTimes(1)
  fireEvent.change(to, { target: { value: start + 2 * day } })
  fireEvent.keyUp(to, { key: 'ArrowLeft' })
  fireEvent.blur(to)
  expect(committed).toHaveBeenCalledTimes(2)
  expect(committed).toHaveBeenLastCalledWith([start + 2 * day, start + 2 * day])
  expect(
    renderToString(
      <ArcBrush
        bounds={[start, start]}
        value={[start, start]}
        fromLabel="From"
        toLabel="To"
        onChange={() => {}}
        onCommit={() => {}}
      />,
    ),
  ).not.toMatch(/NaN|Infinity/)
})
it('keeps caption, headers and chart data accessible without a table toggle', () => {
  render(<TableView table={table} />)
  const accessibleTable = screen.getByRole('table', { name: table.caption })
  expect(within(accessibleTable).getByRole('columnheader', { name: 'Flights' })).toBeInTheDocument()
  expect(within(accessibleTable).getByRole('cell', { name: '3' })).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('lazy charts mount near the viewport but animate only while visible, and clean observers', () => {
  const observers: {
    callback: IntersectionObserverCallback
    options?: IntersectionObserverInit
    disconnect: ReturnType<typeof vi.fn>
  }[] = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      disconnect = vi.fn()
      observe = vi.fn()
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observers.push({ callback, options, disconnect: this.disconnect })
      }
    },
  )
  const { container, unmount } = render(
    <LazyChart height={240} label="Loading routes">
      {(inView) => <span>{inView ? 'Animating' : 'Snapped'}</span>}
    </LazyChart>,
  )
  expect(screen.getByRole('region', { name: 'Loading routes' })).toHaveAttribute(
    'aria-busy',
    'true',
  )
  const preload = observers.find((observer) => observer.options?.rootMargin !== undefined)!
  const visibility = observers.find((observer) => observer.options?.rootMargin === undefined)!
  const notify = (observer: typeof preload, isIntersecting: boolean) =>
    act(() =>
      observer.callback(
        [{ target: container.firstElementChild!, isIntersecting } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    )
  notify(preload, true)
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(screen.getByText('Snapped')).toBeInTheDocument()
  notify(visibility, true)
  expect(screen.getByText('Animating')).toBeInTheDocument()
  notify(visibility, false)
  expect(screen.getByText('Snapped')).toBeInTheDocument()
  unmount()
  expect(observers.every((observer) => observer.disconnect.mock.calls.length > 0)).toBe(true)
})

it('mounts a visible chart when IntersectionObserver is unavailable', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  render(
    <LazyChart height={240} label="Loading routes">
      {(inView) => <span>{inView ? 'Ready' : 'Offscreen'}</span>}
    </LazyChart>,
  )
  expect(screen.getByText('Ready')).toBeInTheDocument()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})

it('scrolls overflowing count-driven charts to the latest data when requested', () => {
  const hostWidth = 200,
    naturalWidth = 300
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(hostWidth)
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(naturalWidth)
  const view = render(<Chart fit={() => naturalWidth} scrollEnd />)
  const host = screen.getByRole('group', { name: 'Routes' }).parentElement!
  expect(host.scrollLeft).toBe(naturalWidth)
  view.unmount()
  render(<Chart fit={() => hostWidth} scrollEnd />)
  expect(screen.getByRole('group', { name: 'Routes' }).parentElement!.scrollLeft).toBe(0)
})
