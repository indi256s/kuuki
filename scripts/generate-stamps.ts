/**
 * Renders every engraved recipe in apps/next/src/lib/stamp-art/recipes to
 * apps/next/public/stamps/{iso2}.svg, writes the five per-shape impression textures, and removes stale files.
 * Run: pnpm generate:stamps
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stampFiles } from '../apps/next/src/lib/stamp-art/build'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const STAMPS_DIR = join(ROOT, 'apps', 'next', 'public', 'stamps')

mkdirSync(STAMPS_DIR, { recursive: true })
const files = stampFiles()
for (const [name, content] of Object.entries(files)) {
  const path = join(STAMPS_DIR, name)
  let current: string | null = null
  try {
    current = readFileSync(path, 'utf8')
  } catch {}
  if (current !== content) writeFileSync(path, content)
}
for (const name of readdirSync(STAMPS_DIR)) {
  if (!(name in files)) {
    rmSync(join(STAMPS_DIR, name))
    console.log(`removed stale ${name}`)
  }
}
console.log(`stamps: wrote ${Object.keys(files).length} files`)
