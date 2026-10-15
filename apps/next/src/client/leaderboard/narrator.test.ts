import { expect, it } from 'vitest'
import { narrate, narratorCopy, type NarratorState } from './narrator'

// Digit-free params: any digit in a line would be a literal in the copy, not a fact from the payload.
const params = {
  place: '#P',
  name: 'olga',
  gap: 'G flights',
  value: 'V flights',
  have: 'H',
  need: 'N',
  places: 'L',
}

it('has an EN and an RU line for every narrator state, with every number from the params', () => {
  for (const state of Object.keys(narratorCopy) as NarratorState[]) {
    for (const locale of ['en', 'ru'] as const) {
      const { text, link } = narrate(state, params, locale)
      expect(text, `${state} ${locale}`).toMatch(/\S/)
      expect(text, `${state} ${locale}`).not.toContain('undefined')
      expect(text, `${state} ${locale}`).not.toMatch(/\d/)
      if (link) expect(link.label, `${state} ${locale}`).toMatch(/\S/)
    }
  }
})

it('links trust states to Settings and the guest line to sign-in', () => {
  expect(narrate('blocked', {}, 'ru').link?.href).toBe('/settings')
  expect(narrate('off', {}, 'en').link?.href).toBe('/settings')
  expect(narrate('guest', params, 'en').link?.href).toBe('/signin')
  expect(narrate('leader', {}, 'en').link).toBeNull()
})
