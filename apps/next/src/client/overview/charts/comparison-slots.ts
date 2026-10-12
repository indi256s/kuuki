import { useEffect, useSyncExternalStore } from 'react'

/** Bump when the comparison palette changes: a new version starts a new storage namespace. */
export const SLOT_PALETTE_VERSION = 'v1'
export const SLOT_COUNT = 5

/** Stable per-slot cues. Colour alone never separates two series: dash and marker travel with the slot. */
export type SlotMarker = 'circle' | 'square' | 'diamond' | 'triangle' | 'ring'
export type SlotCue = { color: string; dash: string | undefined; marker: SlotMarker }
export const SLOT_CUES: readonly SlotCue[] = [
  { color: 'var(--cmp-1)', dash: undefined, marker: 'circle' },
  { color: 'var(--cmp-2)', dash: '6 4', marker: 'square' },
  { color: 'var(--cmp-3)', dash: '2 3', marker: 'diamond' },
  { color: 'var(--cmp-4)', dash: '10 3 2 3', marker: 'triangle' },
  { color: 'var(--cmp-5)', dash: '1 4', marker: 'ring' },
]
export const slotCue = (slot: number): SlotCue => SLOT_CUES[slot] ?? SLOT_CUES[0]

/** Path around the origin for a marker of radius `r`. Draw with `fillRule="evenodd"` (the ring is a hole). */
export function markerPath(marker: SlotMarker, r: number): string {
  switch (marker) {
    case 'square':
      return `M${-r},${-r}H${r}V${r}H${-r}Z`
    case 'diamond': {
      const d = r * 1.25
      return `M0,${-d}L${d},0L0,${d}L${-d},0Z`
    }
    case 'triangle': {
      const h = r * 1.2
      return `M0,${-h}L${h},${h * 0.8}L${-h},${h * 0.8}Z`
    }
    case 'ring': {
      const hole = r * 0.45
      return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0ZM${-hole},0a${hole},${hole} 0 1,1 ${2 * hole},0a${hole},${hole} 0 1,1 ${-2 * hole},0Z`
    }
    default:
      return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`
  }
}

export type SlotStorage = Pick<Storage, 'getItem' | 'setItem'>
type Stored = Readonly<Record<string, number>>
const EMPTY: Stored = Object.freeze({})
const INDEXES = Array.from({ length: SLOT_COUNT }, (_, index) => index)

export const slotStorageKey = (ownerId: string, analysis: string) =>
  `kuuki:cmp:${SLOT_PALETTE_VERSION}:${ownerId}:${analysis}`

const validSlot = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < SLOT_COUNT

function parse(raw: string | null): Stored {
  if (!raw) return EMPTY
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY
    const entries = Object.entries(value).filter(([, slot]) => validSlot(slot))
    return entries.length ? (Object.fromEntries(entries) as Stored) : EMPTY
  } catch {
    return EMPTY
  }
}

/** Assignments that `setItem` refused (quota, private mode); kept so keys stay put for the page's lifetime. */
const spill = new Map<string, string>()

/** Stored entries win; spilled ones only fill keys storage lost. */
function merge(stored: Stored, spilled: Stored): Stored {
  if (spilled === EMPTY) return stored
  return stored === EMPTY ? spilled : { ...spilled, ...stored }
}

function read(storage: SlotStorage | null, key: string): Stored {
  if (!storage) return EMPTY
  let stored = EMPTY
  try {
    stored = parse(storage.getItem(key))
  } catch {}
  return merge(stored, parse(spill.get(key) ?? null))
}

/** Device-local storage; absent or blocked storage falls back to the caller's choice. */
function browserStorage(): SlotStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Stand-in that keeps assignments stable for the page's lifetime when `localStorage` is unavailable. */
const memory = new Map<string, string>()
const memoryStorage: SlotStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => void memory.set(key, value),
}

/**
 * Places keys on slots 0..4 without ever moving a stored key.
 * A new key takes the first slot unused by every stored key, else the first slot unused by the
 * visible keys, else the least-used visible slot (lowest index on ties).
 * While nothing is stored, the whole-journal leaders (`seedOrder`) stand in as stored, so
 * server and first client render agree and an unfiltered view starts on slots 0..4 in order.
 */
export function resolveSlots(
  stored: Stored,
  seedOrder: readonly string[],
  visibleKeys: readonly string[],
): Map<string, number> {
  const known = new Map<string, number>(Object.entries(stored))
  if (known.size === 0) {
    for (const key of seedOrder) {
      if (known.size >= SLOT_COUNT) break
      if (!known.has(key)) known.set(key, known.size)
    }
  }
  const result = new Map<string, number>()
  for (const key of visibleKeys) {
    const slot = known.get(key)
    if (slot !== undefined) result.set(key, slot)
  }
  for (const key of visibleKeys) {
    if (result.has(key)) continue
    const stable = new Set(known.values())
    const onScreen = new Set(result.values())
    let slot = INDEXES.find((index) => !stable.has(index))
    slot ??= INDEXES.find((index) => !onScreen.has(index))
    if (slot === undefined) {
      const uses = new Array<number>(SLOT_COUNT).fill(0)
      for (const used of result.values()) uses[used]++
      slot = uses.indexOf(Math.min(...uses))
    }
    result.set(key, slot)
    known.set(key, slot)
  }
  return result
}

/**
 * Resolves against what storage holds right now and records the keys that have no slot yet.
 * Slots rendered from an older snapshot (the seed, before mount) are never written over stored ones.
 */
function settle(
  storage: SlotStorage,
  key: string,
  seedOrder: readonly string[],
  visibleKeys: readonly string[],
): { slots: Map<string, number>; changed: boolean } {
  const fresh = read(storage, key)
  const slots = resolveSlots(fresh, seedOrder, visibleKeys)
  const added = [...slots].filter(([id]) => fresh[id] === undefined)
  if (!added.length) return { slots, changed: false }
  const next = JSON.stringify({ ...fresh, ...Object.fromEntries(added) })
  try {
    storage.setItem(key, next)
    spill.delete(key)
  } catch {
    spill.set(key, next)
  }
  return { slots, changed: true }
}

export type AssignSlots = {
  /** Comparison family, e.g. `airports`, `routes`, `airlines-cues`. */
  analysis: string
  ownerId: string
  visibleKeys: readonly string[]
  /** Whole-journal ranking order for this analysis, unfiltered. */
  seedOrder: readonly string[]
  /** Default: `localStorage`. `null` resolves from the seed alone and stores nothing. */
  storage?: SlotStorage | null
}

/** Slot index per visible key; new assignments are stored. */
export function assignSlots({
  analysis,
  ownerId,
  visibleKeys,
  seedOrder,
  storage,
}: AssignSlots): Map<string, number> {
  const store = storage === undefined ? browserStorage() : storage
  const key = slotStorageKey(ownerId, analysis)
  return store
    ? settle(store, key, seedOrder, visibleKeys).slots
    : resolveSlots(EMPTY, seedOrder, visibleKeys)
}

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith('kuuki:cmp:')) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
const snapshots = new Map<string, { raw: string | null; spilled: string | null; value: Stored }>()
function snapshot(storage: SlotStorage, key: string): Stored {
  let raw: string | null = null
  try {
    raw = storage.getItem(key)
  } catch {}
  const spilled = spill.get(key) ?? null
  const cached = snapshots.get(key)
  if (cached && cached.raw === raw && cached.spilled === spilled) return cached.value
  const value = merge(parse(raw), parse(spilled))
  snapshots.set(key, { raw, spilled, value })
  return value
}

/**
 * Slots for a rendered chart. The server and the hydrating client render from the seed; stored
 * assignments are read right after mount, and new ones are written once they are on screen.
 */
export function useComparisonSlots(args: Omit<AssignSlots, 'storage'>): Map<string, number> {
  const { analysis, ownerId, visibleKeys, seedOrder } = args
  const key = slotStorageKey(ownerId, analysis)
  const storage = browserStorage() ?? memoryStorage
  const stored = useSyncExternalStore(
    subscribe,
    () => snapshot(storage, key),
    () => EMPTY,
  )
  const slots = resolveSlots(stored, seedOrder, visibleKeys)
  const request = JSON.stringify([seedOrder, visibleKeys])
  useEffect(() => {
    const [seed, visible]: [string[], string[]] = JSON.parse(request)
    if (settle(storage, key, seed, visible).changed) for (const listener of listeners) listener()
  }, [storage, key, request])
  return slots
}
