/** Airport label collision gate: labels appear only from `LABEL_MIN_ZOOM`, and never overlap each other or leave the canvas. */
export const LABEL_MIN_ZOOM = 2.5
/** The rendered label box (renderer.tsx applies it inline): three IATA glyphs at .7rem with room to spare. */
export const LABEL_SIZE = { width: 34, height: 18 }
const GAP = 2

export type LabelCandidate = { id: string; x: number; y: number; priority: number }
export type PlacedLabel = { id: string; x: number; y: number }

/**
 * Greedy placement by priority (busiest airport first, then code): a label is centred above its point and
 * dropped when its box would overlap an already placed one or fall outside the viewport.
 */
export function placeLabels(
  candidates: LabelCandidate[],
  zoom: number,
  viewport: { width: number; height: number },
  limit = 40,
): PlacedLabel[] {
  if (zoom < LABEL_MIN_ZOOM) return []
  const placed: { id: string; x: number; y: number; box: [number, number, number, number] }[] = []
  const ordered = [...candidates].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  )
  for (const candidate of ordered) {
    if (placed.length >= limit) break
    const left = candidate.x - LABEL_SIZE.width / 2,
      top = candidate.y - LABEL_SIZE.height - 6
    const box: [number, number, number, number] = [
      left,
      top,
      left + LABEL_SIZE.width,
      top + LABEL_SIZE.height,
    ]
    if (box[0] < 0 || box[1] < 0 || box[2] > viewport.width || box[3] > viewport.height) continue
    if (
      placed.some(
        ({ box: other }) =>
          box[0] < other[2] + GAP &&
          other[0] < box[2] + GAP &&
          box[1] < other[3] + GAP &&
          other[1] < box[3] + GAP,
      )
    )
      continue
    placed.push({ id: candidate.id, x: left, y: top, box })
  }
  return placed.map(({ id, x, y }) => ({ id, x, y }))
}
