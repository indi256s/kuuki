// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { MarkScene } from '@tanstack/charts'
import { defineChart } from '@tanstack/charts/scene'
import { dot } from '@tanstack/charts/dot'
import { compositeMark } from '@tanstack/charts/mark/composite'
import { crosshair } from '@tanstack/charts/crosshair'
import { interactiveColorLegend } from '@tanstack/charts/legend'
import { barY } from '@tanstack/charts/bar'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { KuukiChart } from './kuuki-chart'
import { LazyChart } from './lazy-chart'
import { TableView } from './table-view'
import { MAKER_PALETTE } from './palettes'

const rows = [{ route: 'TBS–NRT', flights: 3 }]
const table = { caption: 'Flights by route', columns: [{ key: 'route', label: 'Route' }, { key: 'flights', label: 'Flights', numeric: true }], rows }
const definition = (data = rows) => defineChart({ marks: [barY(data, { x: 'route', y: 'flights' })], scales: { x: { scale: scaleBand }, y: { scale: scaleLinear } } })

beforeEach(() => {
  // jsdom has no SVG layout; keep real chart scene generation and event handling.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 640, bottom: 240, width: 640, height: 240, toJSON() {} })
  document.documentElement.lang = 'en'
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function select(container: HTMLElement, pointerType: string) {
  const svg = container.querySelector('svg')!
  const bar = svg.querySelector('circle') ?? svg.querySelector('rect[data-mark-id]') ?? svg.querySelector('rect')!
  const clientX = Number(bar.getAttribute('cx') ?? bar.getAttribute('x')) + Number(bar.getAttribute('width')) / 2
  const clientY = Number(bar.getAttribute('cy') ?? bar.getAttribute('y')) + Number(bar.getAttribute('height')) / 2
  const down = new MouseEvent('pointerdown', { bubbles: true, clientX, clientY })
  Object.defineProperty(down, 'pointerType', { value: pointerType })
  fireEvent(svg, down)
  fireEvent.click(svg, { clientX, clientY })
  return svg
}

it('server-renders real SVG with its accessible name and description', () => {
  const markup = renderToString(<KuukiChart definition={definition()} height={240} ariaLabel="Routes" ariaDescription="Flights per route" table={table} inView />)
  expect(markup).toContain('<svg')
  expect(markup).toContain('Routes')
  expect(markup).toContain('Flights per route')
  expect(markup).toContain('TBS–NRT')
})

it('mouse selection delivers the real datum to onPick', () => {
  const pick = vi.fn()
  const { container } = render(<KuukiChart definition={definition()} height={240} ariaLabel="Routes" table={table} inView onPick={pick} />)
  select(container, 'mouse')
  expect(pick).toHaveBeenCalledTimes(1)
  expect(pick.mock.calls[0][0].datum).toEqual(rows[0])
})

it('touch pins accessible portaled actions without picking, and an action runs once', () => {
  const pick = vi.fn(), run = vi.fn()
  const { container } = render(<KuukiChart definition={definition()} height={240} ariaLabel="Routes" table={table} inView onPick={pick} tip={points => <span>{points[0].datum.route}</span>} actions={() => [{ label: 'Add filter', run }]} />)
  select(container, 'touch')
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('TBS–NRT')).toBeVisible()
  const button = within(dialog).getByRole('button', { name: 'Add filter' })
  expect(button.closest('[aria-hidden="true"], [inert]')).toBeNull()
  expect(container.contains(dialog)).toBe(false)
  expect(pick).not.toHaveBeenCalled()
  fireEvent.pointerDown(button)
  fireEvent.click(button)
  expect(run).toHaveBeenCalledTimes(1)
  expect(pick).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('touch pins actions even without onPick and dismisses on Escape or outside tap', () => {
  const { container } = render(<KuukiChart definition={definition()} height={240} ariaLabel="Routes" table={table} inView actions={() => [{ label: 'Open flight', run() {} }]} />)
  select(container, 'touch')
  fireEvent.keyDown(screen.getByRole('button', { name: 'Open flight' }), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  select(container, 'touch')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it.each(['Enter', ' '])('keyboard %s after touch resets modality and picks the focused mark', key => {
  const pick = vi.fn()
  const { container } = render(<KuukiChart definition={definition()} height={240} ariaLabel="Routes" table={table} inView onPick={pick} actions={() => [{ label: 'Add filter', run() {} }]} />)
  const svg = select(container, 'touch')
  expect(pick).not.toHaveBeenCalled()
  fireEvent.keyDown(svg, { key })
  expect(pick).toHaveBeenCalledTimes(1)
  expect(pick.mock.calls[0][0].datum).toEqual(rows[0])
})

it('retains default tooltip values when no custom tip is supplied', () => {
  const { container } = render(<KuukiChart definition={definition()} height={240} ariaLabel="Routes" table={table} inView />)
  select(container, 'touch')
  expect(screen.getByRole('dialog')).toHaveTextContent('3')
})

it('touch actions survive Tab and ShiftTab navigation and compatible owner updates until activation', async () => {
  const pick = vi.fn(), run = vi.fn()
  const user = userEvent.setup()
  const actions = () => [{ label: 'Add filter', run }, { label: 'Open flight', run: vi.fn() }]
  const { container, rerender } = render(<KuukiChart definition={definition()} height={240} ariaLabel="Routes" table={table} inView onPick={pick} actions={actions} />)
  const svg = select(container, 'touch')
  act(() => svg.focus())
  await user.tab()
  expect(screen.getByRole('button', { name: 'View as table' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Add filter' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Open flight' })).toHaveFocus()
  await user.tab({ shift: true })
  const action = screen.getByRole('button', { name: 'Add filter' })
  expect(action).toHaveFocus()
  rerender(<KuukiChart definition={definition()} height={240} ariaLabel="Routes" ariaDescription="Updated description" table={table} inView={false} onPick={pick} actions={actions} />)
  expect(container.querySelector('svg')).toBe(svg)
  expect(screen.getByRole('button', { name: 'Add filter' })).toBe(action)
  expect(action).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(run).toHaveBeenCalledTimes(1)
  expect(pick).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(container.querySelector('svg')).toHaveFocus()
})

it.each(['keyboard', 'mouse'])('native popover touch actions survive %s input and a compatible update', async input => {
  // Supply only missing platform methods; the installed portal still owns DOM/events.
  Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value(this: HTMLElement) { this.style.display = 'block' } })
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value(this: HTMLElement) { this.style.display = 'none' } })
  try {
    const pick = vi.fn(), run = vi.fn()
    const user = userEvent.setup()
    const actions = () => [{ label: 'Add filter', run }]
    const { container, rerender } = render(<KuukiChart definition={definition()} height={240} ariaLabel="Routes" table={table} inView onPick={pick} actions={actions} />)
    const svg = select(container, 'touch')
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('popover', 'manual')
    expect(dialog).toHaveAttribute('data-ts-chart-tooltip-portal', 'popover')
    expect(container.querySelector('.ts-chart-surface')!.contains(dialog)).toBe(true)
    const action = within(dialog).getByRole('button', { name: 'Add filter' })
    act(() => action.focus())
    if (input === 'keyboard') await user.keyboard('[Space>]')
    else await user.pointer({ target: action, keys: '[MouseLeft>]' })
    expect(run).not.toHaveBeenCalled()
    rerender(<KuukiChart definition={definition()} height={240} ariaLabel="Routes" ariaDescription="Updated" table={table} inView onPick={pick} actions={actions} />)
    expect(container.querySelector('svg')).toBe(svg)
    expect(screen.getByRole('button', { name: 'Add filter' })).toBe(action)
    expect(action).toHaveFocus()
    if (input === 'keyboard') await user.keyboard('[/Space]')
    else await user.pointer({ target: action, keys: '[/MouseLeft]' })
    expect(run).toHaveBeenCalledTimes(1)
    expect(pick).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  } finally {
    Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
    Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
  }
})

it.each(['keyboard', 'mouse'])('touch actions survive interactive legend %s input and a compatible update', async input => {
  const pick = vi.fn(), run = vi.fn(), toggle = vi.fn()
  const user = userEvent.setup()
  const data = [{ route: 'TBS–NRT', flights: 3, series: 'First' }, { route: 'TBS–LHR', flights: 6, series: 'Second' }]
  const chart = defineChart({
    marks: [barY(data, { x: 'route', y: 'flights', key: 'route', color: 'series' })],
    scales: { x: { scale: scaleBand }, y: { scale: scaleLinear } },
    color: { legend: interactiveColorLegend({ hover: false, visible: { value: ['First', 'Second'], onChange: toggle }, itemAriaLabel: value => value }) },
  })
  const actions = () => [{ label: 'Add filter', run }]
  const { container, rerender } = render(<KuukiChart definition={chart} height={240} ariaLabel="Routes" table={table} inView onPick={pick} actions={actions} />)
  const svg = select(container, 'touch')
  const dialog = screen.getByRole('dialog')
  const action = within(dialog).getByRole('button', { name: 'Add filter' })
  expect(dialog).toHaveTextContent('TBS–NRT')
  const legend = screen.getByRole('button', { name: 'Second' })
  expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-pressed', 'true')
  expect(legend).toHaveAttribute('aria-pressed', 'true')
  expect(container.querySelector('.ts-chart-surface')!.contains(legend)).toBe(true)
  expect(legend.closest('.kc-tooltip')).toBeNull()
  act(() => legend.focus())
  if (input === 'keyboard') await user.keyboard('[Space>]')
  else await user.pointer({ target: legend, keys: '[MouseLeft>]' })
  expect(toggle).not.toHaveBeenCalled()
  rerender(<KuukiChart definition={chart} height={240} ariaLabel="Routes" ariaDescription="Updated" table={table} inView onPick={pick} actions={actions} />)
  expect(container.querySelector('svg')).toBe(svg)
  expect(screen.getByRole('dialog')).toBe(dialog)
  expect(dialog).toHaveTextContent('TBS–NRT')
  expect(screen.getByRole('button', { name: 'Add filter' })).toBe(action)
  expect(action).toBeVisible()
  expect(legend).toHaveFocus()
  if (input === 'keyboard') await user.keyboard('[/Space]')
  else await user.pointer({ target: legend, keys: '[/MouseLeft]' })
  expect(toggle).toHaveBeenCalledTimes(1)
  await user.click(action)
  expect(run).toHaveBeenCalledTimes(1)
  expect(pick).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('carries category colors to both the chart and its fallback portal while values stay readable', () => {
  const { container } = render(<KuukiChart definition={definition()} height={240} ariaLabel="Routes" table={table} palette={MAKER_PALETTE} inView />)
  expect(container.firstElementChild).toHaveStyle({ '--ts-chart-1': 'var(--cat-maker-airbus)', '--ts-chart-6': 'var(--cat-maker-unknown)' })
  select(container, 'touch')
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent('3')
  expect(dialog.querySelector('.ts-chart-tooltip__body')?.firstElementChild).toHaveStyle({ '--ts-chart-1': 'var(--cat-maker-airbus)' })
})

const timing = { transition: { type: 'tween' as const, duration: 300 } }
const motionDefinition = (flights: number, local = false, responsive = false) => {
  const spec = {
    marks: [barY([{ route: 'TBS–NRT', flights }], { x: 'route', y: 'flights', ...(local ? { motion: timing } : {}) })],
    scales: { x: { scale: scaleBand }, y: { scale: scaleLinear().domain([0, 10]) } },
  }
  return responsive ? defineChart(() => spec, { motion: timing }) : defineChart(spec, { motion: timing })
}

it.each([[false, false], [true, false], [true, true]])('preserves in-view motion and snaps offscreen data updates (mark-local: %s, responsive: %s)', (local, responsive) => {
  const { container, rerender } = render(<KuukiChart definition={motionDefinition(3, local, responsive)} height={240} ariaLabel="Routes" table={table} inView />)
  const barHeight = () => Number(container.querySelector('rect')!.getAttribute('height'))
  const startHeight = barHeight()
  expect(startHeight).toBeGreaterThan(0)
  rerender(<KuukiChart definition={motionDefinition(4, local, responsive)} height={240} ariaLabel="Routes" table={table} inView />)
  expect(barHeight()).toBeCloseTo(startHeight)
  rerender(<KuukiChart definition={motionDefinition(6, local, responsive)} height={240} ariaLabel="Routes" table={table} inView={false} />)
  expect(barHeight()).toBeCloseTo(startHeight * 2)
  rerender(<KuukiChart definition={motionDefinition(8, local, responsive)} height={240} ariaLabel="Routes" table={table} inView />)
  expect(barHeight()).toBeCloseTo(startHeight * 2)
})

const stateDefinition = (flights: number, layout = false, responsive = false, composite = false) => {
  const child = dot([{ route: 'TBS–NRT', flights }], {
    x: 'route', y: 'flights', key: 'route', r: 5, motion: false,
    states: [{ when: { focus: 'primary' }, style: { r: 12 }, transition: { type: 'tween', duration: 300, respectReducedMotion: false } }],
  })
  const mark = composite ? compositeMark([child]) : child
  const spec = {
    marks: [layout ? { ...mark, initialize: (context: Parameters<typeof mark.initialize>[0]) => {
      const initialized = mark.initialize(context)
      return { ...initialized, states: undefined, resolveLayout: () => ({ render: initialized.render, states: initialized.states }) }
    } } : mark],
    scales: { x: { scale: scaleBand }, y: { scale: scaleLinear().domain([0, 10]) } },
  }
  return responsive ? defineChart(() => spec) : defineChart(spec)
}

it.each([[false, false, false], [true, false, false], [true, true, false], [false, false, true], [true, true, true]])('retains keyed pinned state styles, snapping offscreen and preserving in-view timing (layout: %s, responsive: %s, composite: %s)', async (layout, responsive, composite) => {
  const actions = () => [{ label: 'Add filter', run() {} }]
  const { container, rerender } = render(<KuukiChart definition={stateDefinition(3, layout, responsive, composite)} height={240} ariaLabel="Routes" table={table} inView actions={actions} />)
  const svg = select(container, 'touch')
  const radius = () => Number(container.querySelector('circle')!.getAttribute('r'))
  expect(radius()).toBe(5)
  await waitFor(() => expect(radius()).toBe(12))
  rerender(<KuukiChart definition={stateDefinition(6, layout, responsive, composite)} height={240} ariaLabel="Routes" table={table} inView={false} actions={actions} />)
  expect(container.querySelector('svg')).toBe(svg)
  expect(screen.getByRole('button', { name: 'Add filter' })).toBeVisible()
  expect(radius()).toBe(12)
  rerender(<KuukiChart definition={stateDefinition(8, layout, responsive, composite)} height={240} ariaLabel="Routes" table={table} inView actions={actions} />)
  expect(radius()).toBe(5)
  await waitFor(() => expect(radius()).toBe(12))
})

it.each([false, true])('reduced motion snaps keyed focus state despite an authored state opt-out (composite: %s)', composite => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
  const { container, rerender } = render(<KuukiChart definition={stateDefinition(3, true, true, composite)} height={240} ariaLabel="Routes" table={table} inView />)
  const svg = select(container, 'touch')
  expect(Number(container.querySelector('circle')!.getAttribute('r'))).toBe(12)
  rerender(<KuukiChart definition={stateDefinition(6, true, true, composite)} height={240} ariaLabel="Routes" table={table} inView />)
  expect(container.querySelector('svg')).toBe(svg)
  expect(Number(container.querySelector('circle')!.getAttribute('r'))).toBe(12)
})

it.each([[false, false], [true, false], [true, true]])('retains pinned crosshair geometry, snapping offscreen and preserving authored in-view timing (layout: %s, post-domain: %s)', async (layout, postDomain) => {
  const guides = (flights: number) => {
    const guide = crosshair({ x: false, y: true, marker: true, motion: timing })
    return defineChart({
      marks: [dot([{ route: 'TBS–NRT', flights }], { x: 'route', y: 'flights', key: 'route', motion: false }),
        layout ? { ...guide, initialize: (context: Parameters<typeof guide.initialize>[0]) => {
          const initialized = guide.initialize(context)
          return { ...initialized, resolveLayout: () => ({
            render: initialized.render,
            ...(postDomain ? { postDomain: (scene: MarkScene) => ({ ...scene, focusGuides: scene.focusGuides?.map(guide => ({ ...guide, motion: timing })) }) } : {}),
          }) }
        } } : guide],
      scales: { x: { scale: scaleBand }, y: { scale: scaleLinear().domain([0, 10]) } },
    })
  }
  const actions = () => [{ label: 'Add filter', run() {} }]
  const { container, rerender } = render(<KuukiChart definition={guides(3)} height={240} ariaLabel="Routes" table={table} inView actions={actions} />)
  const svg = select(container, 'touch')
  const pointY = () => Number(container.querySelector('circle:not(.ts-chart__crosshair-marker)')!.getAttribute('cy'))
  const guideY = () => Number(container.querySelector('.ts-chart__crosshair-rule--y')!.getAttribute('y1'))
  const markerY = () => Number(container.querySelector('.ts-chart__crosshair-marker')!.getAttribute('cy'))
  await waitFor(() => expect(guideY()).toBeCloseTo(pointY()))
  const oldY = guideY()
  rerender(<KuukiChart definition={guides(6)} height={240} ariaLabel="Routes" table={table} inView={false} actions={actions} />)
  expect(container.querySelector('svg')).toBe(svg)
  expect(screen.getByRole('button', { name: 'Add filter' })).toBeVisible()
  expect(pointY()).toBeLessThan(oldY)
  expect(guideY()).toBeCloseTo(pointY())
  expect(markerY()).toBeCloseTo(pointY())
  const snappedY = guideY()
  rerender(<KuukiChart definition={guides(8)} height={240} ariaLabel="Routes" table={table} inView actions={actions} />)
  expect(pointY()).toBeLessThan(snappedY)
  expect(guideY()).toBeCloseTo(snappedY)
  await waitFor(() => expect(guideY()).toBeCloseTo(pointY()))
  expect(markerY()).toBeCloseTo(pointY())
})

it('snaps authored axis and tick-label timings offscreen while retaining them in view', () => {
  const guides = (maximum: number) => defineChart({
    marks: [barY(rows, { x: 'route', y: 'flights' })],
    scales: {
      x: { scale: scaleBand },
      y: { scale: scaleLinear().domain([0, maximum]), axis: { motion: timing, ticks: { values: [5], motion: timing }, tickLabels: { motion: timing }, label: { text: 'Flights', motion: timing } } },
    },
  })
  const { container, rerender } = render(<KuukiChart definition={guides(10)} height={240} ariaLabel="Routes" table={table} inView />)
  const tickY = () => Number(Array.from(container.querySelectorAll('svg text')).find(node => node.textContent === '5')!.getAttribute('y'))
  const startY = tickY()
  const baselineY = Number(container.querySelector('rect')!.getAttribute('y')) + Number(container.querySelector('rect')!.getAttribute('height'))
  expect(startY).toBeLessThan(baselineY)
  rerender(<KuukiChart definition={guides(15)} height={240} ariaLabel="Routes" table={table} inView />)
  expect(tickY()).toBeCloseTo(startY)
  rerender(<KuukiChart definition={guides(20)} height={240} ariaLabel="Routes" table={table} inView={false} />)
  expect(tickY()).toBeCloseTo((startY + baselineY) / 2)
})

it('snaps in-view updates under reduced motion', () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
  const { container, rerender } = render(<KuukiChart definition={motionDefinition(3)} height={240} ariaLabel="Routes" table={table} inView />)
  const startHeight = Number(container.querySelector('rect')!.getAttribute('height'))
  rerender(<KuukiChart definition={motionDefinition(6)} height={240} ariaLabel="Routes" table={table} inView />)
  expect(Number(container.querySelector('rect')!.getAttribute('height'))).toBeCloseTo(startHeight * 2)
})

it('empty data server-renders an SVG and an empty accessible table safely', () => {
  expect(renderToString(<KuukiChart definition={definition([])} height={240} ariaLabel="Routes" table={{ ...table, rows: [] }} inView={false} />)).toContain('<svg')
  render(<TableView table={{ ...table, rows: [] }} />)
  fireEvent.click(screen.getByRole('button', { name: 'View as table' }))
  expect(screen.getByRole('table', { name: table.caption })).toBeVisible()
  expect(screen.getAllByRole('row')).toHaveLength(1)
})

it.each([['en', 'View as table'], ['ru', 'Показать таблицу']])('table disclosure uses %s copy and shows caption, headers and rows', (locale, label) => {
  document.documentElement.lang = locale
  render(<TableView table={table} />)
  const toggle = screen.getByRole('button', { name: label })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(toggle)
  const visibleTable = screen.getByRole('table', { name: table.caption })
  expect(within(visibleTable).getByRole('columnheader', { name: 'Flights' })).toBeInTheDocument()
  expect(within(visibleTable).getByRole('cell', { name: '3' })).toBeInTheDocument()
  fireEvent.click(toggle)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it('lazy mounting reserves height, uses the preload margin, tracks actual visibility and cleans observers', () => {
  const observers: { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; disconnect: ReturnType<typeof vi.fn> }[] = []
  vi.stubGlobal('IntersectionObserver', class {
    disconnect = vi.fn()
    observe = vi.fn()
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) { observers.push({ callback, options, disconnect: this.disconnect }) }
  })
  const { container, unmount } = render(<LazyChart height={240} label="Loading routes">{inView => <span>{inView ? 'Animating' : 'Snapped'}</span>}</LazyChart>)
  expect(screen.getByRole('region', { name: 'Loading routes' })).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('region', { name: 'Loading routes' })).toHaveStyle({ height: '240px' })
  const preload = observers.find(observer => observer.options?.rootMargin === '200px')!
  const visibility = observers.find(observer => observer.options?.rootMargin !== '200px')!
  const notify = (observer: typeof preload, isIntersecting: boolean) => act(() => observer.callback([{ target: container.firstElementChild!, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver))
  notify(preload, true)
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(screen.getByText('Snapped')).toBeInTheDocument()
  expect(container.firstElementChild).toHaveStyle({ height: '240px' })
  notify(visibility, true)
  expect(screen.getByText('Animating')).toBeInTheDocument()
  notify(visibility, false)
  expect(screen.getByText('Snapped')).toBeInTheDocument()
  unmount()
  expect(observers.every(observer => observer.disconnect.mock.calls.length > 0)).toBe(true)
})

it('mounts a visible chart when IntersectionObserver is unavailable', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  render(<LazyChart height={240} label="Loading routes">{inView => <span>{inView ? 'Ready' : 'Offscreen'}</span>}</LazyChart>)
  expect(screen.getByText('Ready')).toBeInTheDocument()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})
