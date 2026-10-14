import { beforeAll, describe, expect, it } from 'vitest'
import endonyms from '../../lib/stamp-art/ring-endonyms.json'
import { frames } from '../../lib/stamp-art/frame'
import { BUDGET, FS_FLOOR, bakeRing, initRingBake } from '../../lib/stamp-art/ring-bake'
import { stampCodes, stampMeta } from './stamp-meta'

const rows = endonyms as Record<string, { script: string }>
const CASED = new Set(['Latin', 'Cyrillic', 'Greek'])

beforeAll(initRingBake)

describe('baked ring text', () => {
  it('fits every country inside its own ring, at or above the font floor, without cutting a name', () => {
    for (const code of stampCodes()) {
      const shape = stampMeta(code).shape
      const { ring, family } = frames[shape]
      const baked = bakeRing(code, shape)
      for (const [name, fit, path] of [
        ['top', baked.top, ring.top],
        ['bottom', baked.bottom, ring.bottom],
      ] as const) {
        if (!fit) continue
        const label = `${shape} ${code} ${name} ${fit.text}`
        expect(fit.width, label).toBeLessThanOrEqual(path.length * BUDGET[family] + 0.01)
        expect(fit.fontSize, label).toBeGreaterThanOrEqual(fit.floor)
        expect(fit.text, label).not.toContain('…')
        if (CASED.has(rows[code].script) || name === 'bottom')
          expect(fit.fontSize, label).toBeGreaterThanOrEqual(FS_FLOOR)
      }
      expect(baked.svg).toMatch(/^<svg [^>]*><path d="m[^"]+"\/><\/svg>$/)
    }
  })

  it('shows the name in its own script on top and the English name below, or three dots when both are the same word', () => {
    const de = bakeRing('DE', stampMeta('DE').shape)
    expect([de.top.text, de.bottom?.text]).toEqual(['DEUTSCHLAND', 'GERMANY'])
    const gr = bakeRing('GR', stampMeta('GR').shape)
    expect([gr.top.text, gr.bottom?.text]).toEqual(['ΕΛΛΑΣ', 'GREECE'])
    const gb = bakeRing('GB', stampMeta('GB').shape)
    expect([gb.top.text, gb.bottom]).toEqual(['UNITED KINGDOM', null])
  })
})
