// Shared helpers for the migration and smoke CLI scripts.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const SCHEMA_SQL = `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`
export const MAX_REVIEW_AGE_MS = 24 * 60 * 60 * 1000

export function requiredArg(argv: string[], name: string): string {
  const at = argv.indexOf(name)
  if (at < 0 || !argv[at + 1] || argv[at + 1].startsWith('--')) throw new Error(`Required argument: ${name}`)
  return argv[at + 1]
}
