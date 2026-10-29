import { describe, expect, it } from 'vitest'
import { comparisonScale, scaleBar, type DrawingPanel } from './scale'

describe('comparison drawing scale', () => {
  it('derives the shared physical scale from unequal drawable areas and airport aspect ratios', () => {
    const panels: DrawingPanel[] = [
      { width: 600, height: 300, boundsM: [-1000, -500, 1000, 500] },
      { width: 400, height: 500, boundsM: [-3000, -2000, 3000, 2000] },
    ]
    const ppm = comparisonScale(panels)
    // BER-like wide extent is constrained to 400/6000, including the smaller panel.
    expect(ppm).toBeCloseTo(1 / 15)
    for (const panel of panels) {
      expect(1000 * ppm).toBeCloseTo(200 / 3)
      expect((panel.boundsM[2] - panel.boundsM[0]) * ppm).toBeLessThanOrEqual(panel.width)
      expect((panel.boundsM[3] - panel.boundsM[1]) * ppm).toBeLessThanOrEqual(panel.height)
      const bar = scaleBar(ppm, panel.width)
      expect(bar.pixels / bar.metres).toBe(ppm)
      expect(bar.pixels).toBeLessThanOrEqual(Math.min(140, panel.width * 0.4))
    }
    // Stacked mobile panels retain the same metre size despite different heights.
    expect(comparisonScale(panels.map((panel) => ({ ...panel, width: 320 })))).toBeCloseTo(
      320 / 6000,
    )
    expect(comparisonScale([{ ...panels[0]!, width: 0 }, panels[1]!])).toBe(0)
  })
})
