import { describe, expect, it } from 'vitest'
import registry from '../../lib/stamp-art/registry.json'
import { SHAPE_NAMES, frames } from '../../lib/stamp-art/frame'
import type { Locale } from '../../lib/format'
import { stampCodes, stampMeta, stampNames } from './stamp-meta'
import { ringNames } from './country-stamp'
import { BUDGET, FS_FLOOR, fitRing } from './ring-fit'

const codes = (registry as { iso2: string }[]).map((r) => r.iso2)

describe('ring fitting', () => {
  it.each(['en', 'ru'] as Locale[])(
    'keeps every %s catalog name inside its ring on every shape, at or above the font floor',
    (locale) => {
      for (const shape of SHAPE_NAMES) {
        const { ring, family } = frames[shape]
        for (const code of codes) {
          const fit = fitRing(ringNames(code, locale), ring.top.length, family)
          const label = `${shape} ${locale} ${code} ${fit.text}`
          expect(fit.width, label).toBeLessThanOrEqual(ring.top.length * BUDGET[family] + 0.01)
          expect(fit.fontSize, label).toBeGreaterThanOrEqual(FS_FLOOR)
        }
      }
    },
  )

  it.each(['en', 'ru'] as Locale[])(
    'shows every %s name untruncated in its own shape',
    (locale) => {
      const cut = stampCodes().filter((code) => {
        const { ring, family } = frames[stampMeta(code).shape]
        return fitRing(ringNames(code, locale), ring.top.length, family).source === 'truncated'
      })
      expect(cut).toEqual([])
    },
  )

  it('cuts at a word boundary and drops a dangling connector before the ellipsis', () => {
    const { ring, family } = frames.rectangle
    const fit = fitRing(['SOUTH GEORGIA & SOUTH SANDWICH ISLANDS'], ring.top.length, family)
    expect(fit.source).toBe('truncated')
    expect(fit.text).toMatch(/^SOUTH GEORGIA…$/)
    const ru = fitRing(['БОСНИЯ И ГЕРЦЕГОВИНА И ДРУГИЕ ТЕРРИТОРИИ ЮЖНЫЕ'], 90, family)
    expect(ru.text).not.toMatch(/(?:\sИ|-|&)…$/)
  })

  it('cuts a name that cannot fit at the floor size with an ellipsis, and leaves short names whole', () => {
    const { ring, family } = frames.octagon
    const name = stampNames('GS', 'ru').name.toLocaleUpperCase('ru')
    expect(fitRing([name], ring.top.length, family).text.endsWith('…')).toBe(true)
    const short = fitRing(['JAPAN'], ring.top.length, family)
    expect(short.text).toBe('JAPAN')
    expect(short.source).toBe('full')
  })
})
