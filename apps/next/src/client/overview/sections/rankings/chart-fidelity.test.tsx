import { expect, it } from 'vitest'
import { airlineBrand, airlineColor } from '../../../../lib/airline'

it('keeps JetBlue navy even though the seed reused it for unknown airline colors', () => {
  expect(airlineBrand('b6')).toBe('#003876')
  expect(airlineColor('B6')).not.toBe('var(--mark-ghost)')
})
