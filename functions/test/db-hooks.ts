// Test-only D1 instrumentation: records every statement's SQL and lets a test interleave a write between a
// handler's read and its batch, which is how the concurrency races are exercised in-process.

export interface DbHooks {
  /** Every SQL string passed to `prepare`, in call order. */
  sql: string[]
  /** Runs before the matching batch executes, with the SQL of each statement in it. Fires at most `times` times. */
  beforeBatch(
    match: (sql: string[]) => boolean,
    run: (sql: string[]) => Promise<void>,
    times?: number,
  ): void
  /** Runs after the matching batch executed (committed), before the handler sees its results. */
  afterBatch(
    match: (sql: string[]) => boolean,
    run: (sql: string[]) => Promise<void>,
    times?: number,
  ): void
  /** Makes the matching batch throw instead of executing. */
  failBatch(match: (sql: string[]) => boolean, times?: number): void
}

type Rule = {
  match: (sql: string[]) => boolean
  run?: (sql: string[]) => Promise<void>
  fail?: boolean
  left: number
}

/** Workerd hands out RPC stubs for statements, so the SQL is tracked by wrapping them and unwrapping inside `batch`. */
class Tracked {
  constructor(
    readonly real: D1PreparedStatement,
    readonly sql: string,
  ) {}
  bind(...values: unknown[]) {
    return new Tracked(this.real.bind(...values), this.sql)
  }
  first(...args: unknown[]) {
    return (this.real.first as (...a: unknown[]) => unknown)(...args)
  }
  all() {
    return this.real.all()
  }
  run() {
    return this.real.run()
  }
  raw(...args: unknown[]) {
    return (this.real.raw as (...a: unknown[]) => unknown)(...args)
  }
}

export function instrumentDb(db: D1Database): { db: D1Database; hooks: DbHooks } {
  const before: Rule[] = []
  const after: Rule[] = []
  const hooks: DbHooks = {
    sql: [],
    beforeBatch: (match, run, times = 1) => {
      before.push({ match, run, left: times })
    },
    afterBatch: (match, run, times = 1) => {
      after.push({ match, run, left: times })
    },
    failBatch: (match, times = 1) => {
      before.push({ match, fail: true, left: times })
    },
  }
  const fire = async (rules: Rule[], sql: string[]) => {
    for (const rule of rules) {
      if (rule.left > 0 && rule.match(sql)) {
        rule.left -= 1
        if (rule.fail) throw new Error('injected batch failure')
        await rule.run!(sql)
      }
    }
  }
  const proxy = new Proxy(db, {
    get(target, property) {
      if (property === 'prepare') {
        return (sql: string) => {
          hooks.sql.push(sql)
          return new Tracked(target.prepare(sql), sql)
        }
      }
      if (property === 'batch') {
        return async (statements: Array<Tracked | D1PreparedStatement>) => {
          const sql = statements.map((statement) =>
            statement instanceof Tracked ? statement.sql : '',
          )
          await fire(before, sql)
          const results = await target.batch(
            statements.map((statement) =>
              statement instanceof Tracked ? statement.real : statement,
            ),
          )
          await fire(after, sql)
          return results
        }
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  return { db: proxy as D1Database, hooks }
}

export const hasSql =
  (...needles: string[]) =>
  (sql: string[]) =>
    needles.every((needle) => sql.some((entry) => entry.includes(needle)))
