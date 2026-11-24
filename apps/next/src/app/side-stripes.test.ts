import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const src = fileURLToPath(new URL('..', import.meta.url))

const STRIPE = [
  /border-(?:left|right|inline-start|inline-end):\s*(?:[2-9]|\d{2,})(?:\.\d+)?px\s+solid/,
  /inset\s+-?[1-9]\d*(?:\.\d+)?px\s+0\s+0[\s;,)]/,
]

const ALLOWED: Record<string, string> = {
  'client/welcome/passport/passport.css': 'the passport cover spine shading',
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(path)
    return entry.name.endsWith('.css') ? [path] : []
  })
}

it('draws no coloured side stripes on cards, rows or notes', () => {
  const offenders = cssFiles(src)
    .map((path) => relative(src, path))
    .filter((path) => !(path in ALLOWED))
    .filter((path) => {
      const css = readFileSync(join(src, path), 'utf8')
      return STRIPE.some((pattern) => pattern.test(css))
    })
  expect(offenders).toEqual([])
})
