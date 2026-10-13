import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import { formatNumber, type Locale } from '../../../lib/format'
import { fill } from '../copy'
import { CORPUS } from './corpus'
import { TRIGGERS } from './triggers'

const fixtures = join(__dirname, '../../../../../../packages/shared/src/overview/__fixtures__')
const load = (name: string) =>
  JSON.parse(readFileSync(join(fixtures, `${name}.json`), 'utf8')) as OverviewPayload

// Synthetic small journals and coverage gaps use the board's rows, never private prod rows.
const board = load('board')
const counted = board.rows
  .filter((row) => row.state === 'logged' || row.state === 'awaiting')
  .sort((a, b) => (a.date < b.date ? -1 : 1))
const shaped = (rows: typeof counted): OverviewPayload => ({ ...board, rows })
const uniqueRoutes = [
  ...new Map(counted.map((row) => [[row.origin, row.destination].sort().join('-'), row])).values(),
]
const journals: Record<string, { payload: OverviewPayload; filter: OverviewFilter }> = {
  ...Object.fromEntries(
    readdirSync(fixtures)
      .filter((file) => file.endsWith('.json'))
      .map((file) => [file.slice(0, -5), { payload: load(file.slice(0, -5)), filter: {} }]),
  ),
  'prod:three': { payload: shaped(counted.slice(0, 3)), filter: {} },
  'prod:eight': { payload: shaped(counted.slice(0, 8)), filter: {} },
  'prod:half-untyped': {
    payload: shaped(counted.map((row, i) => (i % 20 < 9 ? { ...row, aircraft: null } : row))),
    filter: {},
  },
  'prod:mostly-untimed': {
    payload: shaped(
      counted.map((row, i) => (i % 4 ? { ...row, depMinute: null, departureUtc: null } : row)),
    ),
    filter: {},
  },
  'prod:mostly-untyped': {
    payload: shaped(counted.map((row, i) => (i % 4 ? { ...row, aircraft: null } : row))),
    filter: {},
  },
  'board:one-airline': { payload: board, filter: { airlines: ['EK'] } },
  'board:no-match': { payload: board, filter: { airlines: ['ZZ'] } },
  'scenario:widebody-minority': {
    payload: shaped(
      counted.map((row, i) => ({
        ...row,
        aircraft: i < 2 ? null : i % 10 === 0 ? 'B77W' : 'A320',
      })),
    ),
    filter: {},
  },
  'scenario:mixed-routes': {
    payload: shaped(
      [...uniqueRoutes.slice(0, 15), ...uniqueRoutes.slice(0, 5)].map((row, i) => ({
        ...row,
        id: i + 1,
      })),
    ),
    filter: {},
  },
  'scenario:home-on-margin': {
    payload: { ...board, homeOverride: 'AKL' },
    filter: {},
  },
  'scenario:short-haul': {
    payload: shaped(counted.map((row) => ({ ...row, distanceKm: 1000 }))),
    filter: {},
  },
  'scenario:arrival-peak': {
    payload: shaped(
      counted.map((row, i) => ({ ...row, depMinute: i % 2 ? 600 : 900, arrMinute: 600 })),
    ),
    filter: {},
  },
  'scenario:no-july-or-august': {
    payload: shaped(
      counted.map((row) => ({
        ...row,
        date: `${row.date.slice(0, 4)}-${['07', '08'].includes(row.date.slice(5, 7)) ? '06' : row.date.slice(5, 7)}-01`,
      })),
    ),
    filter: {},
  },
  'scenario:airline-leader': {
    payload: shaped(counted.map((row, i) => ({ ...row, airline: i % 5 ? 'EK' : 'TK' }))),
    filter: {},
  },
  'scenario:new-airline-leader': {
    payload: shaped(
      counted.map((row, i) => ({
        ...row,
        date: i < 8 ? '2025-01-01' : '2024-01-01',
        airline: i < 8 ? 'TK' : 'EK',
      })),
    ),
    filter: {},
  },
  'scenario:two-airline-split': {
    payload: shaped(counted.map((row, i) => ({ ...row, airline: i % 2 ? 'EK' : 'TK' }))),
    filter: {},
  },
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(([, key]) => key).sort()
// A full stop after an abbreviation (мес., сут.) is followed by lowercase, so it does not end a sentence.
const sentences = (text: string) => text.match(/[.!?…](?=\s+[A-ZА-ЯЁ{«"]|\s*$)/gu)?.length ?? 1
// Two lines at the 60ch measure, which is also about three lines at a 390px viewport.
const MAX_FILLED = 120

describe('corpus lint', () => {
  it('pairs every trigger with a triple and leaves no orphan lines', () => {
    const ids = new Set(TRIGGERS.map((trigger) => trigger.id))
    for (const id of ids) expect(CORPUS[id], id).toHaveLength(3)
    for (const id of Object.keys(CORPUS)) expect(ids.has(id), `orphan ${id}`).toBe(true)
  })

  for (const [id, triple] of Object.entries(CORPUS))
    it(`${id} keeps one placeholder set, no literals and at most two sentences`, () => {
      const expected = placeholders(triple[0].en)
      for (const line of triple)
        for (const locale of ['en', 'ru'] as const) {
          const text = line[locale]
          expect(placeholders(text), text).toEqual(expected)
          expect(text.replace(/\{\w+\}/g, ''), text).not.toMatch(/\d/)
          expect(sentences(text), text).toBeLessThanOrEqual(2)
        }
      for (const { ru } of triple) {
        expect(ru, ru).toMatch(/[а-яё]/i)
        expect(ru, ru).not.toMatch(/(^|[^а-яё])(ты|тебя|тебе|твой|твоя|твои)([^а-яё]|$)/i)
      }
    })
})

describe('trigger simulation', () => {
  const scopes = Object.fromEntries(
    Object.entries(journals).map(([name, { payload, filter }]) => [
      name,
      {
        scope: computeOverview(payload, filter),
        all: computeOverview(payload, {}),
      },
    ]),
  )

  it('fills every variant of every firing trigger cleanly in both locales', () => {
    for (const [name, { scope, all }] of Object.entries(scopes))
      for (const trigger of TRIGGERS) {
        const params = trigger.when(scope, all)
        if (params === null) continue
        for (const key of placeholders(CORPUS[trigger.id][0].en))
          expect(Object.keys(params), `${name} ${trigger.id} lacks {${key}}`).toContain(key)
        for (const locale of ['en', 'ru'] as Locale[]) {
          const values = Object.fromEntries(
            Object.entries(params).map(([key, value]) => [
              key,
              typeof value === 'number' ? formatNumber(locale, value) : value,
            ]),
          )
          for (const line of CORPUS[trigger.id]) {
            const text = fill(line[locale], values)
            const where = `${name} ${trigger.id} ${locale}: ${text}`
            expect(text, where).not.toMatch(/\{\w+\}|NaN|undefined|null|Infinity/)
            expect(text.length, where).toBeLessThanOrEqual(MAX_FILLED)
          }
        }
      }
  })

  it('fires every trigger for some journal', () => {
    const fired = new Set<string>()
    for (const { scope, all } of Object.values(scopes))
      for (const trigger of TRIGGERS) if (trigger.when(scope, all) !== null) fired.add(trigger.id)
    const unfired = TRIGGERS.map((trigger) => trigger.id).filter((id) => !fired.has(id))
    expect(unfired).toEqual([])
  })
})
