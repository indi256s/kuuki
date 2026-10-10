// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { DEFAULT_ORDER } from '@kuuki/shared/overview/prefs'
import { SECTIONS } from './registry'

it('has one entry per section id, in the default order', () => {
  expect(Object.keys(SECTIONS)).toEqual([...DEFAULT_ORDER])
  expect(SECTIONS.routes.title).toEqual({ en: 'Routes', ru: 'Маршруты' })
  expect(SECTIONS.aircraft.title).toEqual({ en: 'Aircraft', ru: 'Самолёты' })
  expect(SECTIONS.rhythm.title).toEqual({ en: 'Rhythm', ru: 'Ритм' })
})
