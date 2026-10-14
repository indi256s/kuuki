import { describe, expect, it } from 'vitest'
import { sketchOf, SKETCH_HEIGHT, SKETCH_WIDTH } from './route-sketch'
import { baku, kars, nowhere, tbilisi } from './test-fixtures'

describe('route sketch', () => {
  it('joins a loop back to its first dot and keeps every dot inside the box', () => {
    const sketch = sketchOf([tbilisi, kars, baku, tbilisi])
    expect(sketch.dots).toHaveLength(3)
    expect(sketch.segments).toEqual([[0, 1, 2, 0]])
    for (const dot of sketch.dots) {
      expect(dot.x).toBeGreaterThanOrEqual(0)
      expect(dot.x).toBeLessThanOrEqual(SKETCH_WIDTH)
      expect(dot.y).toBeGreaterThanOrEqual(0)
      expect(dot.y).toBeLessThanOrEqual(SKETCH_HEIGHT)
    }
  })

  it('never plots a place without coordinates at the origin; it names it instead', () => {
    const sketch = sketchOf([tbilisi, nowhere, kars])
    expect(sketch.dots).toHaveLength(2)
    expect(sketch.missing.map((item) => item.name)).toEqual(['Nowhere'])
    expect(sketchOf([nowhere]).dots).toEqual([])
  })

  it('breaks the line at a place without coordinates instead of joining across it', () => {
    const sketch = sketchOf([tbilisi, kars, nowhere, baku, tbilisi])
    expect(sketch.segments).toEqual([
      [0, 1],
      [2, 0],
    ])
  })

  it('centres a single place', () => {
    const [dot] = sketchOf([tbilisi]).dots
    expect(dot.x).toBe(SKETCH_WIDTH / 2)
    expect(dot.y).toBe(SKETCH_HEIGHT / 2)
  })

  it('keeps an eastbound connection across the date line in one Pacific view', () => {
    const west = { ...tbilisi, id: 'west', lat: -16, lon: 179 }
    const east = { ...kars, id: 'east', lat: -16, lon: -179 }
    const map = sketchOf([west, east])
    expect(map.dots[0].x).toBeLessThan(map.dots[1].x)
    expect(map.dots[0].y).toBe(map.dots[1].y)
  })
})
