import { beforeAll, describe, expect, it } from 'vitest'
import endonyms from '../../lib/stamp-art/ring-endonyms.json'
import { frames } from '../../lib/stamp-art/frame'
import { FS_FLOOR, bakeRing, initRingBake, ringBudget } from '../../lib/stamp-art/ring-bake'
import { stampCodes, stampMeta } from './stamp-meta'

const rows = endonyms as Record<string, { script: string }>
const CASED = new Set(['Latin', 'Cyrillic', 'Greek'])

beforeAll(initRingBake)

describe('baked ring text', () => {
  it('fits every country inside its own ring, at or above the font floor, without cutting a name', () => {
    for (const code of stampCodes()) {
      const shape = stampMeta(code).shape
      const { ring } = frames[shape]
      const baked = bakeRing(code, shape)
      for (const [name, fit, path] of [
        ['top', baked.top, ring.top],
        ['bottom', baked.bottom, ring.bottom],
      ] as const) {
        if (!fit) continue
        const label = `${shape} ${code} ${name} ${fit.text}`
        expect(fit.width, label).toBeLessThanOrEqual(ringBudget(shape, path) + 0.01)
        expect(fit.fontSize, label).toBeGreaterThanOrEqual(fit.floor)
        expect(fit.text, label).not.toContain('…')
        if (CASED.has(rows[code].script) || name === 'bottom')
          expect(fit.fontSize, label).toBeGreaterThanOrEqual(FS_FLOOR)
      }
      expect(baked.svg).toMatch(/^<svg [^>]*><path d="m[^"]+"\/><\/svg>$/)
    }
  })

  it('shows the name in its own script on top and the English name below, which stays empty when both are the same name', () => {
    const de = bakeRing('DE', stampMeta('DE').shape)
    expect([de.top.text, de.bottom?.text]).toEqual(['DEUTSCHLAND', 'GERMANY'])
    const gr = bakeRing('GR', stampMeta('GR').shape)
    expect([gr.top.text, gr.bottom?.text]).toEqual(['ΕΛΛΑΣ', 'GREECE'])
    const gb = bakeRing('GB', stampMeta('GB').shape)
    expect([gb.top.text, gb.bottom]).toEqual(['UNITED KINGDOM', null])
    // Names that differ only in accents, SAINT/ST or the word for "and" are the same name.
    for (const code of ['CC', 'BL', 'PM', 'WF', 'ST', 'GW', 'SJ'])
      expect(bakeRing(code, stampMeta(code).shape).bottom, code).toBeNull()
  })

  it('opens a short name in a free-standing script across its ring, and sizes a headline script by its core glyph', () => {
    const cn = bakeRing('CN', stampMeta('CN').shape)
    expect(cn.top.width / frames[stampMeta('CN').shape].ring.top.length).toBeGreaterThan(0.3)
    expect(bakeRing('IN', stampMeta('IN').shape).top.fontSize).toBeGreaterThan(15)
  })
})
