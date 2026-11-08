import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { LABEL_FONT, LABEL_FONT_FACES } from './label-font'

it('gives map labels the same Commissioner SemiBold subsets and unicode ranges as the page', () => {
  const css = readFileSync(new URL('../../../app/styles.css', import.meta.url), 'utf8')
  const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].flatMap(([, body]) => {
    const url = /url\('([^']*Commissioner-SemiBold-[^']*)'\)/.exec(body)?.[1]
    const ranges = /unicode-range:([^;]*);/.exec(body)?.[1]
    return url && ranges
      ? [{ url, 'unicode-range': ranges.split(',').map((range) => range.trim()) }]
      : []
  })
  expect(faces).toHaveLength(2)
  expect(LABEL_FONT_FACES[LABEL_FONT]).toEqual(expect.arrayContaining(faces))
})
