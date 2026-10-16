import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const src = fileURLToPath(new URL('..', import.meta.url))

/**
 * Feature CSS that may pin something to the viewport. Everything else floats through a shared primitive (Toast,
 * ToastSlot, Popover, Sheet, Dialog, Menu) so it joins the shell's layer order instead of guessing a z-index.
 */
const ALLOWED: Record<string, string> = {
  'app/shell.css': 'the shell itself: header, tab bar and menu shield',
  'client/auth-card/ring-backdrop.css': 'sign-in backdrop behind the card',
  'client/welcome/flights/flights.css': 'whole-window file drop overlay',
  'client/account/settings.css': 'settings save bar (DESIGN.md, Settings)',
  'client/overview/layout/layout.css': 'drag ghost that follows the pointer',
  'client/overview/charts/chart-theme.css': 'chart tooltip anchored to a data point',
  'client/kuukies.css':
    'first-visit cookie notice, above the action bar (40) and below dialogs (50)',
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(path)
    return entry.name.endsWith('.css') ? [path] : []
  })
}

it('keeps viewport-fixed surfaces inside the shared primitives', () => {
  const offenders = cssFiles(src)
    .map((path) => relative(src, path))
    .filter((path) => !path.startsWith('client/ui/') && !(path in ALLOWED))
    .filter((path) => /position:\s*fixed/.test(readFileSync(join(src, path), 'utf8')))
  expect(offenders).toEqual([])
})
