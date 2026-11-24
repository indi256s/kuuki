import { expect, test } from 'vitest'
import { FIGURE_GAP, READING_COLUMN, STAGE_BOX, WIDE_MIN, cardLayout } from './figure-box'

test('the figure box never outgrows the room its layout leaves it', () => {
  for (let width = 600; width <= 1400; width++) {
    const { wide, box } = cardLayout(width)
    expect(wide).toBe(width >= WIDE_MIN)
    if (box === STAGE_BOX) continue
    const room = wide ? width - READING_COLUMN - FIGURE_GAP : width - 24 - STAGE_BOX.width
    expect(box.width).toBeLessThanOrEqual(room)
  }
})
