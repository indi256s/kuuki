import { expect, it } from 'vitest'
import { composeScene } from './render'

it('keeps the horizon behind a lit subject', () => {
  const scene = composeScene({
    iso2: 'AA',
    tier: 'engraved',
    shape: 'rectangle',
    horizon: 0.5,
    backdrop: [{ module: 'ground', box: [40, 60, 120, 90] }],
    layers: [{ module: 'platform', box: [80, 90, 40, 40] }],
  })
  const crossesSubject = scene.nodes.some((node) => {
    if (node.kind !== 'stroke' || !node.bg) return false
    return node.pts.some((a, i) => {
      const b = node.pts[i + 1]
      return (
        b && a[1] === 100 && b[1] === 100 && Math.min(a[0], b[0]) < 110 && Math.max(a[0], b[0]) > 90
      )
    })
  })
  expect(crossesSubject).toBe(false)
})
