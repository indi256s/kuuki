// Shared helpers for the migration and smoke CLI scripts.
import { existsSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const SCHEMA_SQL = `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`
export const MAX_REVIEW_AGE_MS = 24 * 60 * 60 * 1000

export function requiredArg(argv: string[], name: string): string {
  const at = argv.indexOf(name)
  if (at < 0 || !argv[at + 1] || argv[at + 1].startsWith('--')) throw new Error(`Required argument: ${name}`)
  return argv[at + 1]
}

export function privateOutputPath(raw: string): string {
  if (!isAbsolute(raw)) throw new Error('--output-sql must be an absolute path')
  const path = resolve(raw)
  const parent = realpathSync(dirname(path))
  const allowed = [realpathSync(tmpdir())]
  const snapshot = join(ROOT, 'db', '_snapshot')
  if (existsSync(snapshot)) allowed.push(realpathSync(snapshot))
  if (!allowed.some(base => parent === base || parent.startsWith(base + sep))) {
    throw new Error('--output-sql must be inside the temporary directory or gitignored db/_snapshot')
  }
  return path
}
