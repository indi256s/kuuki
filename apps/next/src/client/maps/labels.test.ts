import { describe, expect, it } from 'vitest'
import { LABEL_MIN_ZOOM, LABEL_SIZE, placeLabels } from './labels'

const view = { width: 400, height: 300 }

describe('placeLabels', () => {
  it('shows no airport labels below the label zoom', () => {
    expect(placeLabels([{ id: 'JFK', x: 100, y: 100, priority: 5 }], LABEL_MIN_ZOOM - 0.1, view)).toEqual([])
  })

  it('keeps the busier airport when two labels would collide', () => {
    const placed = placeLabels([
      { id: 'LGA', x: 100, y: 100, priority: 1 },
      { id: 'JFK', x: 110, y: 104, priority: 9 },
      { id: 'BOS', x: 300, y: 100, priority: 2 },
    ], 4, view)
    expect(placed.map(label => label.id)).toEqual(['JFK', 'BOS'])
  })

  it('never returns overlapping boxes or boxes outside the canvas, and respects the limit', () => {
    const candidates = Array.from({ length: 200 }, (_, i) => ({ id: `A${i}`, x: (i * 37) % 420, y: (i * 53) % 320, priority: i % 7 }))
    const placed = placeLabels(candidates, 5, view, 25)
    expect(placed.length).toBeLessThanOrEqual(25)
    for (const a of placed) {
      expect(a.x).toBeGreaterThanOrEqual(0)
      expect(a.y).toBeGreaterThanOrEqual(0)
      expect(a.x + LABEL_SIZE.width).toBeLessThanOrEqual(view.width)
      for (const b of placed) if (a !== b) {
        const overlap = a.x < b.x + LABEL_SIZE.width && b.x < a.x + LABEL_SIZE.width && a.y < b.y + LABEL_SIZE.height && b.y < a.y + LABEL_SIZE.height
        expect(overlap, `${a.id}/${b.id}`).toBe(false)
      }
    }
  })
})
