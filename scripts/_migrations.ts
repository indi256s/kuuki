// Single source of truth for applying db/migrations/*.sql to a D1 binding (tests, smoke, schema proofs).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { unstable_splitSqlQuery } from 'wrangler'
import { ROOT } from './_cli'

const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')

/** Numbered migration files in apply order. */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter(file => /^\d+.*\.sql$/.test(file)).sort()
}

/** The statements of one migration file, split exactly as wrangler splits them. */
export function migrationStatements(file: string): string[] {
  return unstable_splitSqlQuery(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
}

/**
 * Apply every numbered migration, in filename order, to the given D1 database. `after` and
 * `through` bound the range by numeric prefix (e.g. through '0005' stops before 0006).
 */
export async function applyMigrations(db: D1Database, range: { after?: string; through?: string } = {}): Promise<void> {
  for (const file of migrationFiles()) {
    const number = file.slice(0, 4)
    if (range.after !== undefined && number <= range.after) continue
    if (range.through !== undefined && number > range.through) continue
    // One batch per file: a single round trip, applied atomically.
    await db.batch(migrationStatements(file).map(statement => db.prepare(statement)))
  }
}
