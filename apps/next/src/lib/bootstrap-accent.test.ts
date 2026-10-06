import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../../public/bootstrap.js', import.meta.url), 'utf8')

function bootstrap(cookie: string, legacy: string | null, storageThrows = false) {
  const document = {
    cookie,
    documentElement: { dataset: {} as Record<string, string>, style: {} as Record<string, string> },
  }
  const context = {
    document,
    history: { state: {}, replaceState() {}, pushState() {} },
    location: { pathname: '/', hash: '' },
    window: { addEventListener() {}, dispatchEvent() {} },
    Event,
    localStorage: { getItem: (key: string) => {
      if (storageThrows) throw new Error('Storage unavailable')
      return key === 'kuuki-accent-color' ? legacy : null
    } },
    navigator: { language: 'en' },
    matchMedia: () => ({ matches: false }),
  }
  vm.runInNewContext(source, context)
  return document
}

describe('bootstrap accent preference', () => {
  it('keeps a valid current cookie over a conflicting legacy color', () => {
    const result = bootstrap('kuuki_theme=light; kuuki_locale=en; kuuki_accent=sakura', 'teal')
    expect(result.documentElement.dataset.accent).toBe('sakura')
    expect(result.cookie).toContain('kuuki_accent=sakura')
  })

  it('migrates the legacy color when the current cookie is missing or invalid', () => {
    for (const cookie of ['kuuki_theme=light; kuuki_locale=en', 'kuuki_theme=light; kuuki_locale=en; kuuki_accent=bogus']) {
      const result = bootstrap(cookie, 'teal')
      expect(result.documentElement.dataset.accent).toBe('asagi')
      expect(result.cookie).toContain('kuuki_accent=asagi')
    }
  })

  it('maps every legacy color to a current accent', () => {
    const expected = { blue: 'ai', cyan: 'asagi', teal: 'asagi', yellow: 'terracotta', purple: 'sakura', coral: 'sakura', red: 'terracotta', orange: 'terracotta' }
    for (const [legacy, accent] of Object.entries(expected)) {
      expect(bootstrap('kuuki_theme=light; kuuki_locale=en', legacy).documentElement.dataset.accent, legacy).toBe(accent)
    }
  })

  it.each(['kincha', 'sumi'])('rewrites a stored %s cookie to terracotta, ignoring the legacy color', removed => {
    const result = bootstrap(`kuuki_theme=light; kuuki_locale=en; kuuki_accent=${removed}`, 'teal')
    expect(result.documentElement.dataset.accent).toBe('terracotta')
    expect(result.cookie).toContain('kuuki_accent=terracotta')
    expect(result.cookie).not.toContain(removed)
  })

  it('uses the cookie safely when storage is inaccessible', () => {
    expect(bootstrap('kuuki_theme=light; kuuki_locale=en; kuuki_accent=ai', null, true).documentElement.dataset.accent).toBe('ai')
  })
})
