// The security lane figure shows where each import source is. This maps source phases to tray places; it knows nothing about drawing.
import type { SessionEntry } from '../unified-session'

export type LaneSlot = 'mouth' | 'queue' | 'frame' | 'tunnel' | 'exit' | 'side' | 'stack' | 'table'
export type LaneCargo = 'none' | 'document' | 'stubs' | 'logbook'
export interface LaneTray {
  /** The source id; 'idle' for the empty tray of a lane with no sources, 'history' for the Flighty logbook. */
  id: string
  slot: LaneSlot
  /** Place in the queue or the stack, otherwise 0. */
  index: number
  cargo: LaneCargo
  /** 0..4 */
  stubs: number
  rejected: 'size' | 'type' | null
}
export interface LaneModel {
  trays: LaneTray[]
  monitor: boolean
  rollers: boolean
  flaps: boolean
  size: 'hero' | 'band'
}
export interface LaneInput {
  entries: readonly {
    id: string
    phase: SessionEntry['phase']
    problem?: SessionEntry['problem']
    drafts: number
  }[]
  dragging: boolean
  history: 'idle' | 'reading' | 'done'
  saved: boolean
}

/** Trays past these counts are not drawn; the file list still shows every source. */
export const QUEUE_SLOTS = 3
export const STACK_SLOTS = 4
export const MAX_STUBS = 4

const tray = (id: string, slot: LaneSlot, cargo: LaneCargo = 'none'): LaneTray => ({
  id,
  slot,
  index: 0,
  cargo,
  stubs: 0,
  rejected: null,
})

type Entry = LaneInput['entries'][number]

function place(entry: Entry): LaneTray {
  switch (entry.phase) {
    case 'queued':
      return tray(entry.id, 'queue', 'document')
    case 'local':
      return tray(entry.id, 'frame', 'document')
    case 'online':
      return tray(entry.id, 'tunnel', 'document')
    case 'ready':
      return { ...tray(entry.id, 'exit', 'stubs'), stubs: Math.min(entry.drafts, MAX_STUBS) }
    case 'empty':
      return tray(entry.id, 'exit', 'document')
    case 'failed':
      return entry.problem === 'size' || entry.problem === 'type'
        ? { ...tray(entry.id, 'mouth', 'document'), rejected: entry.problem }
        : tray(entry.id, 'side', 'document')
  }
}

export function laneModel({ entries, dragging, history, saved }: LaneInput): LaneModel {
  let trays = entries.map(place)
  if (saved) trays = trays.map(({ id }) => tray(id, 'stack'))
  else {
    // One tray per place: the latest source there. Earlier settled trays return to the stack, emptied; the rest are not drawn.
    const latest = new Map<LaneSlot, string>()
    for (const { id, slot } of trays) latest.set(slot, id)
    trays = trays.flatMap((item) => {
      if (item.slot === 'queue' || latest.get(item.slot) === item.id) return [item]
      return item.slot === 'exit' ? [tray(item.id, 'stack')] : []
    })
  }
  if (history === 'reading') trays.push(tray('history', 'table', 'logbook'))
  if (history === 'done') trays.push(tray('history', 'stack'))

  // The stack keeps its newest trays; the queue its oldest, which are read next.
  const stacked = trays.filter((item) => item.slot === 'stack').slice(-STACK_SLOTS)
  let queued = 0
  trays = trays.flatMap((item) => {
    if (item.slot === 'stack') {
      const index = stacked.indexOf(item)
      return index < 0 ? [] : [{ ...item, index }]
    }
    if (item.slot === 'queue') return queued < QUEUE_SLOTS ? [{ ...item, index: queued++ }] : []
    return [item]
  })

  const idle = entries.length === 0 && history === 'idle'
  return {
    trays: idle ? [tray('idle', 'mouth')] : trays,
    monitor: !saved && entries.some((entry) => entry.phase === 'online'),
    rollers: dragging,
    flaps: dragging,
    size: idle ? 'hero' : 'band',
  }
}
