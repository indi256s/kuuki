import { describe, expect, it } from 'vitest'
import type { IsoNode } from '../../overview/iso/scene'
import { buildLane } from './lane-figure'
import { laneModel, type LaneInput } from './lane-model'

type Entry = LaneInput['entries'][number]
const entry = (id: string, phase: Entry['phase'], extra: Partial<Entry> = {}): Entry => ({
  id,
  phase,
  drafts: 0,
  ...extra,
})
const model = (entries: Entry[], extra: Partial<LaneInput> = {}) =>
  laneModel({ entries, dragging: false, history: 'idle', saved: false, ...extra })

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
  model([entry('a', 'ready', { drafts: 2 })], { saved: true }),
  model([], { history: 'reading' }),
  model([], { history: 'done' }),
]
const BOXES = [
  { w: 560, h: 216 },
  { w: 560, h: 120 },
  { w: 328, h: 168 },
  { w: 328, h: 96 },
]

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
  it('fits its box and keeps one viewBox whatever the trays do', () => {
    for (const box of BOXES) {
      const figures = STATES.map((state) => buildLane(box, state))
      expect(new Set(figures.map((figure) => figure.viewBox)).size).toBe(1)
      expect(figures[0].width).toBeLessThanOrEqual(box.w)
      expect(figures[0].height).toBeLessThanOrEqual(box.h)
    }
  })

  it('lights one part, the monitor screen, and only during online recognition', () => {
    for (const state of STATES) {
      const lit = parts(buildLane(BOXES[0], state).nodes).filter((part) => part === 'lit')
      expect(lit).toHaveLength(state.monitor ? 1 : 0)
      let glows = 0
      walk(buildLane(BOXES[0], state).nodes, (node) => {
        if (node.kind === 'glow') glows++
      })
      expect(glows).toBe(state.monitor ? 1 : 0)
    }
  })

  it('carries no text', () => {
    for (const state of STATES)
      walk(buildLane(BOXES[0], state).nodes, (node) => expect(node.kind).not.toBe('text'))
  })

  it('is deterministic', () => {
    for (const state of STATES)
      expect(buildLane(BOXES[1], state)).toEqual(buildLane(BOXES[1], structuredClone(state)))
  })

  it('draws exactly the trays of the model', () => {
    for (const state of STATES) {
      const drawn = parts(buildLane(BOXES[0], state).nodes).filter((part) =>
        part.startsWith('tray:'),
      )
      expect(drawn).toEqual(state.trays.map((tray) => `tray:${tray.id}`))
    }
  })
})
