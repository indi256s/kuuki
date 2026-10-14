import { expect, it } from 'vitest'
import { withReturn } from '../url'
import { safeReturn, savedHref } from './return-context'

it('keeps the list filters whether the link carries the list path or only its query', () => {
  const link = withReturn('/ground-travel/new?mode=rail', {
    mode: 'rail',
    cancelled: true,
    journey: null,
  })
  const fromList = new URL(link, 'https://kuuki.test').searchParams.get('return')
  expect(safeReturn(fromList ?? undefined)).toBe('/ground-travel?mode=rail&status=cancelled')
  expect(safeReturn('mode=road')).toBe('/ground-travel?mode=road')
  expect(safeReturn('/ground-travelling?mode=rail')).toBe('/ground-travel')
  expect(safeReturn('https://evil.test/ground-travel')).toBe('/ground-travel')
  expect(savedHref('/ground-travel?mode=rail', 'j1')).toBe('/ground-travel?mode=rail&journey=j1')
})
