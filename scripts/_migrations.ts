// Single source of truth for applying db/migrations/*.sql to a D1 binding (tests, smoke, schema proofs).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { unstable_splitSqlQuery } from 'wrangler'
import { ROOT } from './_cli'

const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')

/** Apply every numbered migration, in filename order, to the given D1 database. */
export async function applyMigrations(db: D1Database): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR).filter(file => /^\d+.*\.sql$/.test(file)).sort()
  for (const file of files) {
    for (const statement of unstable_splitSqlQuery(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))) {
      await db.prepare(statement).run()
    }
  }
}
