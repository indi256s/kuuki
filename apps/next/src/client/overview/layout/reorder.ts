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
export function dropIndex(pointerY: number, rects: { id: string; top: number; bottom: number }[]): number {
  const index = rects.findIndex(rect => pointerY < (rect.top + rect.bottom) / 2)
  return index < 0 ? rects.length : index
}
