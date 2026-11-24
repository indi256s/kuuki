import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { unstable_splitSqlQuery } from 'wrangler'
import { ROOT } from './_cli'

const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort()
}

export function migrationStatements(file: string): string[] {
  return unstable_splitSqlQuery(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
}

export async function applyMigrations(
  db: D1Database,
  range: { after?: string; through?: string } = {},
): Promise<void> {
  for (const file of migrationFiles()) {
    const number = file.slice(0, 4)
    if (range.after !== undefined && number <= range.after) continue
    if (range.through !== undefined && number > range.through) continue
    await db.batch(migrationStatements(file).map((statement) => db.prepare(statement)))
  }
}
