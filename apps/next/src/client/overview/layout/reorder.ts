import type { SectionId } from '@kuuki/shared/overview/prefs'

/** toIndex is the final index, including after removal of the source. */
export function moveSection(order: SectionId[], id: SectionId, toIndex: number): SectionId[] {
  const from = order.indexOf(id)
  if (from < 0 || !Number.isFinite(toIndex)) return order
  const to = Math.max(0, Math.min(order.length - 1, Math.trunc(toIndex)))
  if (from === to) return order
  const next = [...order]
  next.splice(from, 1); next.splice(to, 0, id)
  return next
}
export function dropIndex(pointerY: number, rects: { id: string; top: number; bottom: number; left?: number; right?: number }[], pointerX?: number,
  bounds?: { left: number; right: number }): number {
  if (pointerX !== undefined && rects.length && rects.every(rect => rect.left !== undefined && rect.right !== undefined)) {
    const tops = rects.map(rect => rect.top)
    const preceding = tops.filter(top => top <= pointerY)
    const top = preceding.length ? Math.max(...preceding) : Math.min(...tops)
    const row = rects.filter(rect => Math.abs(rect.top - top) < 1)
    const left = bounds?.left ?? Math.min(...rects.map(rect => rect.left!))
    const right = bounds?.right ?? Math.max(...rects.map(rect => rect.right!))
    // The dragged card is excluded, so its neighbour can be the only remaining card in a grid row.
    if (row.length > 1 || row.some(rect => rect.left! > left + 1 || rect.right! < right - 1)) {
      if (pointerY < top) return rects.indexOf(row[0])
      if (pointerY > Math.max(...row.map(rect => rect.bottom))) return rects.indexOf(row.at(-1)!) + 1
      const target = row.find(rect => pointerX < (rect.left! + rect.right!) / 2)
      return target ? rects.indexOf(target) : rects.indexOf(row.at(-1)!) + 1
    }
  }
  const index = rects.findIndex(rect => pointerY < (rect.top + rect.bottom) / 2)
  return index < 0 ? rects.length : index
}
export type DropRect = { id: string; top: number; bottom: number; left: number; right: number }
/** Two-lane flow: the lane under the pointer comes from x, the slot from y among that lane's cards. `rects` excludes the dragged card and follows the saved order (the others never change relative order while one is dragged); `bounds` spans every lane. Returns the dragged card's final index, or null when nothing else is on screen. */
export function laneDrop(pointerX: number, pointerY: number, rects: DropRect[], bounds: { left: number; right: number }): number | null {
  if (!rects.length) return null
  const mid = (bounds.left + bounds.right) / 2, right = pointerX >= mid
  const lane = rects.filter(rect => (rect.left + rect.right) / 2 >= mid === right)
  const before = lane.find(rect => pointerY < (rect.top + rect.bottom) / 2)
  if (before) return rects.indexOf(before)
  const last = lane.at(-1)
  // An empty lane: the card lands first or last.
  return last ? rects.indexOf(last) + 1 : right ? rects.length : 0
}
