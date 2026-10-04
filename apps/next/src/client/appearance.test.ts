// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setAccent } from './appearance'
import type { Accent } from '../lib/theme-colors'

describe('setAccent', () => {
  let writes: string[]
  beforeEach(() => {
    writes = []
    delete document.documentElement.dataset.accent
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!
    vi.spyOn(document, 'cookie', 'set').mockImplementation(value => { writes.push(value); original.set!.call(document, value) })
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('writes the cookie in the bootstrap.js format and sets data-accent', () => {
    setAccent('matcha')
    expect(writes).toEqual(['kuuki_accent=matcha; Path=/; Max-Age=31536000; SameSite=Lax'])
    expect(document.documentElement.dataset.accent).toBe('matcha')
  })

  it('uses the same cookie template as public/bootstrap.js', () => {
    const bootstrap = readFileSync(join(__dirname, '../../public/bootstrap.js'), 'utf8')
    expect(bootstrap).toContain('`kuuki_accent=${accent}; Path=/; Max-Age=31536000; SameSite=Lax`')
  })

  it('ignores unknown names: no cookie write, dataset unchanged', () => {
    setAccent('sakura')
    writes.length = 0
    setAccent('blue' as Accent)
    expect(writes).toEqual([])
    expect(document.documentElement.dataset.accent).toBe('sakura')
  })
})
