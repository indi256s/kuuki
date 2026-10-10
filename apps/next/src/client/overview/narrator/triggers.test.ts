import { expect, it } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { CORPUS } from './corpus'
import { pickLine } from './pick'
import { TRIGGERS } from './triggers'

const payload = fixture as OverviewPayload
const scope = computeOverview(payload, {})

it('keeps a corpus triple for every trigger and only the removed slots are gone', () => {
  for (const trigger of TRIGGERS) expect(CORPUS[trigger.id], trigger.id).toHaveLength(3)
  const slots = new Set<string>(TRIGGERS.map((trigger) => trigger.slot))
  for (const gone of ['manufacturers', 'fleet', 'timeline'])
    expect(slots.has(gone), gone).toBe(false)
  for (const kept of ['routes', 'aircraft', 'rhythm']) expect(slots.has(kept), kept).toBe(true)
})

it('every line uses only placeholders its trigger supplies', () => {
  const routes = TRIGGERS.filter((trigger) => trigger.slot === 'routes' && trigger.priority > 10)
  expect(routes.map((trigger) => trigger.id).sort()).toEqual([
    'routes:commuter',
    'routes:explorer',
    'routes:home',
    'routes:top-repeat',
  ])
  const params: Record<string, string[]> = {
    'routes:commuter': ['flights', 'distinct'],
    'routes:explorer': ['flights', 'distinct'],
    'routes:top-repeat': ['route', 'count'],
    'routes:home': ['percent'],
  }
  for (const [id, keys] of Object.entries(params))
    for (const line of CORPUS[id])
      for (const text of [line.en, line.ru])
        for (const [, key] of text.matchAll(/\{(\w+)\}/g))
          expect(keys, `${id}: ${text}`).toContain(key)
})

it('fires routes lines from the routes figures', () => {
  if (scope.routes.status !== 'ready') throw new Error('Board must satisfy Routes minimum')
  const data = scope.routes.value
  const expected = TRIGGERS.filter(
    (trigger) => trigger.slot === 'routes' && trigger.when(scope, scope) !== null,
  )
  expect(expected.length).toBeGreaterThan(0)
  const en = pickLine('routes', scope, scope, 'owner', 'en'),
    ru = pickLine('routes', scope, scope, 'owner', 'ru')
  expect(en).toBeTruthy()
  expect(ru).toMatch(/[а-я]/i)
  expect(en).not.toMatch(/\{\w+\}/)
  expect(ru).not.toMatch(/\{\w+\}/)
  if (data.top) expect(expected.map((trigger) => trigger.id)).toContain('routes:top-repeat')
})

it('keeps aircraft lines on the merged slot', () => {
  expect(pickLine('aircraft', scope, scope, 'owner', 'en')).toBeTruthy()
})
