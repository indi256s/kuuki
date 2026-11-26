import { describe, expect, it } from 'vitest'
import type { IsoFigureData, IsoNode } from '../../overview/iso/scene'
import { buildLane, focusOf, type LaneBox } from './lane-figure'
import { laneModel, type LaneInput, type LaneModel } from './lane-model'

type Entry = LaneInput['entries'][number]
const entry = (id: string, phase: Entry['phase'], extra: Partial<Entry> = {}): Entry => ({
  id,
  phase,
  drafts: 0,
  ...extra,
})
const model = (entries: Entry[], extra: Partial<LaneInput> = {}) =>
  laneModel({ entries, dragging: false, history: 'idle', ...extra })

const STATES = [
  model([]),
  model([], { dragging: true }),
  model(['a', 'b', 'c', 'd'].map((id) => entry(id, 'queued'))),
  model([entry('a', 'online'), entry('b', 'local'), entry('c', 'queued')]),
  model([
    entry('a', 'ready', { drafts: 3 }),
    entry('b', 'ready', { drafts: 1 }),
    entry('c', 'empty'),
  ]),
  model([entry('a', 'failed', { problem: 'size' }), entry('b', 'failed', { problem: 'partial' })]),
  model([entry('a', 'failed', { problem: 'type' })]),
  model([entry('a', 'ready', { drafts: 2 })], { finished: true }),
  model([], { history: 'reading' }),
  model([], { history: 'done' }),
]
const BOXES = [
  { w: 560, h: 216 },
  { w: 560, h: 120 },
  { w: 358, h: 224 },
  { w: 288, h: 224 },
  { w: 328, h: 96 },
]
const STAGES = [
  { w: 560, h: 300 },
  { w: 358, h: 232 },
  { w: 288, h: 232 },
]
const flat = (state: LaneModel): LaneModel => ({ ...state, size: 'band' })

const walk = (nodes: readonly IsoNode[], visit: (node: IsoNode) => void) => {
  for (const node of nodes) {
    visit(node)
    if (node.kind === 'group' || node.kind === 'glow') walk(node.children, visit)
  }
}
const parts = (nodes: readonly IsoNode[]) => {
  const out: string[] = []
  walk(nodes, (node) => {
    if (node.kind === 'group') out.push(node.part)
  })
  return out
}

describe('buildLane', () => {
  it('fits its box at rest, centred, and keeps one viewBox whatever the trays do', () => {
    for (const box of BOXES) {
      const figures = STATES.map((state) => buildLane(box, flat(state)))
      expect(new Set(figures.map(({ figure }) => figure.viewBox)).size).toBe(1)
      const [{ figure, camera }] = figures
      expect(figure.width).toBeLessThanOrEqual(box.w)
      expect(figure.height).toBeLessThanOrEqual(box.h)
      expect(camera).toEqual([
        Math.round((box.w - figure.width) / 2),
        Math.round((box.h - figure.height) / 2),
      ])
    }
  })

  it('lights one part, the monitor screen, and only during online recognition', () => {
    for (const state of STATES) {
      const { nodes } = buildLane(BOXES[0], state).figure
      expect(parts(nodes).filter((part) => part === 'lit')).toHaveLength(state.monitor ? 1 : 0)
      let glows = 0
      walk(nodes, (node) => {
        if (node.kind === 'glow') glows++
      })
      expect(glows).toBe(state.monitor ? 1 : 0)
    }
  })

  it('carries no text', () => {
    for (const box of [BOXES[0], STAGES[1]])
      for (const state of STATES)
        walk(buildLane(box, state).figure.nodes, (node) => expect(node.kind).not.toBe('text'))
  })

  it('is deterministic', () => {
    for (const state of STATES)
      expect(buildLane(BOXES[1], state)).toEqual(buildLane(BOXES[1], structuredClone(state)))
  })

  it('draws exactly the trays of the model', () => {
    for (const state of STATES) {
      const drawn = parts(buildLane(BOXES[0], state).figure.nodes).filter((part) =>
        part.startsWith('tray:'),
      )
      expect(drawn).toEqual(state.trays.map((tray) => `tray:${tray.id}`))
    }
  })
})

const trayGroup = (nodes: readonly IsoNode[], id: string) => {
  let found: Extract<IsoNode, { kind: 'group' }> | undefined
  walk(nodes, (node) => {
    if (node.kind === 'group' && node.part === `tray:${id}`) found ??= node
  })
  return found!
}
const bounds = (figure: IsoFigureData, id: string, [dx, dy]: readonly number[] = [0, 0]) => {
  const tray = trayGroup(figure.nodes, id)
  const x = parseFloat(tray.vars!['--tray-x']) + dx
  const y = parseFloat(tray.vars!['--tray-y']) + dy
  const xs: number[] = []
  const ys: number[] = []
  walk(tray.children, (node) => {
    if (node.kind !== 'polygon') return
    for (const pair of node.points.split(' ')) {
      const [a, b] = pair.split(',').map(Number)
      xs.push(a + x)
      ys.push(b + y)
    }
  })
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  }
}
const onScreen = (box: LaneBox, state: LaneModel, id: string) => {
  const { figure, camera } = buildLane(box, state)
  const [x0, y0] = figure.viewBox.split(' ').map(Number)
  return bounds(figure, id, [camera[0] - x0, camera[1] - y0])
}

describe('the stage', () => {
  const reading = (phase: Entry['phase']) => model([entry('a', phase)])

  it('draws at a larger scale than the fit, so the rig overflows the camera box', () => {
    for (const box of STAGES) {
      const { figure } = buildLane(box, reading('online'))
      const fit = buildLane(box, flat(reading('online'))).figure
      expect(figure.width).toBeGreaterThan(box.w)
      expect(figure.width).toBeGreaterThan(fit.width * 1.5)
    }
  })

  it('follows the most advanced tray in flight: tunnel, then frame, then queue', () => {
    const many = model([
      entry('q', 'queued'),
      entry('f', 'local'),
      entry('t', 'online'),
      entry('r', 'ready', { drafts: 2 }),
    ])
    expect(focusOf(many)).toBe('tunnel')
    expect(focusOf(model([entry('q', 'queued'), entry('f', 'local')]))).toBe('frame')
    expect(focusOf(model([entry('q', 'queued'), entry('r', 'ready')]))).toBe('queue')
    expect(focusOf(model([entry('r', 'ready', { drafts: 1 })]))).toBe('exit')
  })

  it('frames the active tray whole and large, and pans as it moves down the lane', () => {
    for (const box of STAGES) {
      let last = Infinity
      for (const phase of ['queued', 'local', 'online'] as const) {
        const state = reading(phase)
        const tray = onScreen(box, state, 'a')
        expect(tray.left).toBeGreaterThanOrEqual(0)
        expect(tray.right).toBeLessThanOrEqual(box.w)
        expect(tray.top).toBeGreaterThanOrEqual(0)
        expect(tray.bottom).toBeLessThanOrEqual(box.h)
        const fit = bounds(buildLane(box, flat(state)).figure, 'a')
        expect(tray.right - tray.left).toBeGreaterThan(1.6 * (fit.right - fit.left))
        const [x] = buildLane(box, state).camera
        expect(x).toBeLessThan(last)
        last = x
      }
    }
  })

  it('keeps the camera inside the drawing', () => {
    for (const box of STAGES)
      for (const slot of ['mouth', 'queue', 'frame', 'tunnel', 'exit', 'table'] as const) {
        const state: LaneModel = {
          ...reading('online'),
          trays: [{ id: 'a', slot, index: 0, cargo: 'none', stubs: 0, rejected: null }],
        }
        const { figure, camera } = buildLane(box, state)
        expect(camera[0]).toBeLessThanOrEqual(0)
        expect(camera[0]).toBeGreaterThanOrEqual(box.w - figure.width)
        expect(camera[1]).toBeLessThanOrEqual(0)
        expect(camera[1]).toBeGreaterThanOrEqual(box.h - figure.height)
      }
  })

  it('shows the stubs at the exit whole while it lingers there', () => {
    const state = { ...model([entry('a', 'ready', { drafts: 3 })]), size: 'stage' as const }
    for (const box of STAGES) {
      const tray = onScreen(box, state, 'a')
      expect(tray.left).toBeGreaterThanOrEqual(0)
      expect(tray.right).toBeLessThanOrEqual(box.w)
      expect(tray.top).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('the finish', () => {
  it('sends the tray at the exit off the end of the lane and fades it, leaving the rest', () => {
    const ready = [entry('a', 'ready', { drafts: 1 }), entry('b', 'ready', { drafts: 2 })]
    const before = buildLane(BOXES[0], model(ready)).figure
    const after = buildLane(BOXES[0], model(ready, { finished: true })).figure
    expect(after.viewBox).toBe(before.viewBox)
    const [x0, , width] = after.viewBox.split(' ').map(Number)
    const exit = trayGroup(after.nodes, 'b').vars!
    expect(exit['--tray-o']).toBe('0')
    expect(bounds(after, 'b').left).toBeGreaterThan(x0 + width)
    expect(bounds(before, 'b').right).toBeLessThan(x0 + width)
    expect(trayGroup(after.nodes, 'a').vars).toEqual(trayGroup(before.nodes, 'a').vars)
    expect(trayGroup(before.nodes, 'b').vars!['--tray-o']).toBeUndefined()
  })
})
