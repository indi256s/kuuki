import { expect, it } from 'vitest'
import { DEFAULT_PREFS, normalizeLayout, overviewPrefsSchema, parsePrefs } from './prefs'

it('legacy prefs normalize without throwing', () => {
  const prefs = parsePrefs(JSON.stringify({ version: 1,
    filter: { manufacturers: ['Airbus'], bodyTypes: ['widebody'], airlines: ['TK'], unknown: ['x'] },
    layout: { order: ['records', 'rankings', 'bogus', 'records'], hidden: ['fleet', 'bogus', 'fleet'] },
    replayPaused: false, publicSections: { records: true, fleet: false } }))
  expect(prefs).toEqual({ version: 1, filter: { airlines: ['TK'] },
    layout: { order: ['records', 'rankings', 'manufacturers', 'fleet', 'clock', 'rhythm', 'timeline', 'crossings'], hidden: ['fleet'] },
    replayPaused: false, publicSections: { records: true, fleet: false } })
})

it('raw layouts drop malformed ids and append missing sections without sharing defaults', () => {
  expect(normalizeLayout({ order: [null, 'clock', 42, 'clock'], hidden: ['rhythm', null, 'rhythm'] }))
    .toEqual({ order: ['clock', 'rankings', 'records', 'manufacturers', 'fleet', 'rhythm', 'timeline', 'crossings'], hidden: ['rhythm'] })
  expect(normalizeLayout({ order: 'records', hidden: {} })).toEqual(DEFAULT_PREFS.layout)
  const prefs = parsePrefs(null)
  prefs.layout.order.reverse()
  expect(parsePrefs(null).layout.order[0]).toBe('rankings')
})

it('stored layouts from before the timeline section keep their order and gain it at the end', () => {
  const stored = { version: 1, filter: {}, layout: { order: ['crossings', 'rhythm', 'rankings', 'records', 'manufacturers', 'fleet', 'clock'], hidden: ['clock'] },
    replayPaused: false, publicSections: { records: false, fleet: false } }
  expect(overviewPrefsSchema.safeParse(stored).success).toBe(true)
  expect(parsePrefs(JSON.stringify(stored)).layout)
    .toEqual({ order: ['crossings', 'rhythm', 'rankings', 'records', 'manufacturers', 'fleet', 'clock', 'timeline'], hidden: ['clock'] })
})

it('stored invalid known facets default independently and stale string values survive', () => {
  expect(parsePrefs(JSON.stringify({ version: 1, filter: { airports: ['OBSOLETE'], families: ['old'],
    makers: ['invalid'], bodies: ['narrow'], depHours: [24], arrHours: [6], alliances: ['oneworld'] } })).filter)
    .toEqual({ airports: ['OBSOLETE'], families: ['old'], bodies: ['narrow'], arrHours: [6], alliances: ['oneworld'] })
})

it('persisted filter insertion order survives tolerant parsing without admitting invalid or unknown facets', () => {
  const prefs = parsePrefs(JSON.stringify({ version: 1, filter: {
    arrHours: [6], unknown: ['x'], airlines: ['TK'], makers: ['invalid'], countries: ['JP'], period: { years: [2026] },
  } }))
  expect(Object.keys(prefs.filter)).toEqual(['arrHours', 'airlines', 'countries', 'period'])
})

it('admits exact days and legacy month preferences without rewriting stored bounds', () => {
  for (const period of [{ from: '2024-02', to: '2024-03' }, { from: '2024-02-29', to: '2024-03-01' }, { from: '0099-01-01', to: '0099-01-01' }]) {
    const prefs = { ...DEFAULT_PREFS, filter: { period, countries: ['JP'] } }
    expect(overviewPrefsSchema.safeParse(prefs).success).toBe(true)
    expect(parsePrefs(JSON.stringify(prefs)).filter).toEqual(prefs.filter)
  }
  for (const period of [{ from: '2025-02-29', to: '2025-03-01' }, { from: '2024-03-01', to: '2024-02-29' }, { from: '2024-02', to: '2024-03-01' }]) {
    const prefs = { ...DEFAULT_PREFS, filter: { period, countries: ['JP'] } }
    expect(overviewPrefsSchema.safeParse(prefs).success).toBe(false)
    expect(parsePrefs(JSON.stringify(prefs)).filter).toEqual({ countries: ['JP'] })
  }
})
