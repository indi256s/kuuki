import { expect, it } from 'vitest'
import { DEFAULT_PREFS, normalizeLayout, parsePrefs } from './prefs'

it('legacy prefs normalize without throwing', () => {
  const prefs = parsePrefs(JSON.stringify({ version: 1,
    filter: { manufacturers: ['Airbus'], bodyTypes: ['widebody'], airlines: ['TK'], unknown: ['x'] },
    layout: { order: ['records', 'rankings', 'bogus', 'records'], hidden: ['fleet', 'bogus', 'fleet'] },
    replayPaused: false, publicSections: { records: true, fleet: false } }))
  expect(prefs).toEqual({ version: 1, filter: { airlines: ['TK'] },
    layout: { order: ['records', 'rankings', 'manufacturers', 'fleet', 'clock', 'rhythm', 'crossings'], hidden: ['fleet'] },
    replayPaused: false, publicSections: { records: true, fleet: false } })
})

it('raw layouts drop malformed ids and append missing sections without sharing defaults', () => {
  expect(normalizeLayout({ order: [null, 'clock', 42, 'clock'], hidden: ['rhythm', null, 'rhythm'] }))
    .toEqual({ order: ['clock', 'rankings', 'records', 'manufacturers', 'fleet', 'rhythm', 'crossings'], hidden: ['rhythm'] })
  expect(normalizeLayout({ order: 'records', hidden: {} })).toEqual(DEFAULT_PREFS.layout)
  const prefs = parsePrefs(null)
  prefs.layout.order.reverse()
  expect(parsePrefs(null).layout.order[0]).toBe('rankings')
})

it('stored invalid known facets default independently and stale string values survive', () => {
  expect(parsePrefs(JSON.stringify({ version: 1, filter: { airports: ['OBSOLETE'], families: ['old'],
    makers: ['invalid'], bodies: ['narrow'], depHours: [24], arrHours: [6], alliances: ['oneworld'] } })).filter)
    .toEqual({ airports: ['OBSOLETE'], families: ['old'], bodies: ['narrow'], arrHours: [6], alliances: ['oneworld'] })
})
