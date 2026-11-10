import { describe, expect, it } from 'vitest'
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
const places = (entries: Entry[], extra: Partial<LaneInput> = {}) =>
  model(entries, extra).trays.map((tray) => `${tray.id}:${tray.slot}:${tray.index}`)

describe('laneModel', () => {
  it('rests as a hero with one empty tray at the mouth', () => {
    expect(model([])).toEqual({
      trays: [{ id: 'idle', slot: 'mouth', index: 0, cargo: 'none', stubs: 0, rejected: null }],
      monitor: false,
      rollers: false,
      flaps: false,
      size: 'hero',
    })
  })

  it('lifts the flaps and turns the rollers only while a file is over the page', () => {
    expect(model([], { dragging: true })).toMatchObject({ flaps: true, rollers: true })
  })

  it('draws the first three of a queue of five, oldest first', () => {
    expect(places(['a', 'b', 'c', 'd', 'e'].map((id) => entry(id, 'queued')))).toEqual([
      'a:queue:0',
      'b:queue:1',
      'c:queue:2',
    ])
  })

  it('lights the monitor for online recognition, not for the local barcode read', () => {
    expect(model([entry('a', 'local')])).toMatchObject({ monitor: false, size: 'band' })
    expect(places([entry('a', 'local')])).toEqual(['a:frame:0'])
    expect(model([entry('a', 'online')]).monitor).toBe(true)
    expect(places([entry('a', 'online')])).toEqual(['a:tunnel:0'])
  })

  it('keeps the latest ready tray at the exit with its stubs and stacks the earlier one', () => {
    const { trays } = model([
      entry('a', 'ready', { drafts: 2 }),
      entry('b', 'ready', { drafts: 9 }),
    ])
    expect(trays).toEqual([
      { id: 'a', slot: 'stack', index: 0, cargo: 'none', stubs: 0, rejected: null },
      { id: 'b', slot: 'exit', index: 0, cargo: 'stubs', stubs: 4, rejected: null },
    ])
  })

  it('leaves an empty source at the exit with its document', () => {
    expect(model([entry('a', 'empty')]).trays[0]).toMatchObject({
      slot: 'exit',
      cargo: 'document',
    })
  })

  it('turns a file that is too big or of the wrong type back at the mouth', () => {
    const { trays } = model([
      entry('a', 'failed', { problem: 'size' }),
      entry('b', 'failed', { problem: 'type' }),
    ])
    // One tray per place: the later rejection.
    expect(trays).toEqual([
      { id: 'b', slot: 'mouth', index: 0, cargo: 'document', stubs: 0, rejected: 'type' },
    ])
    expect(model([entry('a', 'failed', { problem: 'size' })]).trays[0].rejected).toBe('size')
  })

  it('sends a recoverable failure to the side line', () => {
    for (const problem of ['read', 'recognition', 'partial', 'reselect'] as const)
      expect(places([entry('a', 'failed', { problem })])).toEqual(['a:side:0'])
  })

  it('stacks every tray, emptied, once everything is saved', () => {
    const { trays, monitor } = model(
      [entry('a', 'ready', { drafts: 1 }), entry('b', 'online'), entry('c', 'queued')],
      { saved: true },
    )
    expect(trays.map((tray) => [tray.slot, tray.index, tray.cargo])).toEqual([
      ['stack', 0, 'none'],
      ['stack', 1, 'none'],
      ['stack', 2, 'none'],
    ])
    expect(monitor).toBe(false)
  })

  it('puts the Flighty logbook on the inspection table as a band, then stacks its tray', () => {
    expect(model([], { history: 'reading' })).toEqual({
      trays: [
        { id: 'history', slot: 'table', index: 0, cargo: 'logbook', stubs: 0, rejected: null },
      ],
      monitor: false,
      rollers: false,
      flaps: false,
      size: 'band',
    })
    expect(places([], { history: 'done' })).toEqual(['history:stack:0'])
  })
})
