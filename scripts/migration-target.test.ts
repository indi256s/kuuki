import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assessSchemaAdmission, schemaRowsSha256 } from './migration-target'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('schema admission', () => {
  it('refuses changed whitespace inside schema default and CHECK literals', () => {
    const expected = [
      {
        type: 'table',
        name: 'settings',
        tbl_name: 'settings',
        sql: "CREATE TABLE settings (value TEXT DEFAULT 'a  b' CHECK(value != 'x  y'))",
      },
    ]
    const observed = [
      {
        ...expected[0],
        sql: "CREATE TABLE settings (value TEXT DEFAULT 'a b' CHECK(value != 'x y'))",
      },
    ]
    expect(schemaRowsSha256(observed)).not.toBe(schemaRowsSha256(expected))
    expect(
      assessSchemaAdmission(observed, expected, {
        accountId: 'a'.repeat(32),
        databaseId: 'b'.repeat(36),
      }),
    ).toMatchObject({
      admitted: false,
      reason: 'unreviewed-schema-variant',
    })
  })

  it('admits only a pinned, recent and complete alternate schema review', () => {
    const expected = [
      { type: 'table', name: 'users', tbl_name: 'users', sql: 'CREATE TABLE users(id TEXT)' },
    ]
    const observed = [{ ...expected[0], sql: 'CREATE TABLE users (id TEXT)' }]
    const target = { accountId: 'a'.repeat(32), databaseId: 'b'.repeat(36) }
    expect(assessSchemaAdmission(observed, expected, target).admitted).toBe(false)
    expect(
      assessSchemaAdmission(
        [
          ...observed,
          {
            type: 'table',
            name: 'unexpected',
            tbl_name: 'unexpected',
            sql: 'CREATE TABLE unexpected(id)',
          },
        ],
        expected,
        target,
      ).reason,
    ).toBe('application-object-inventory-mismatch')
    expect(
      assessSchemaAdmission(
        observed,
        [
          ...expected,
          {
            type: 'table',
            name: '_cf_METADATA',
            tbl_name: '_cf_METADATA',
            sql: 'CREATE TABLE _cf_METADATA(key)',
          },
        ],
        target,
      ).reason,
    ).toBe('unreviewed-schema-variant')
    const dir = mkdtempSync(join(tmpdir(), 'kuuki-schema-review-'))
    dirs.push(dir)
    const path = join(dir, 'review.json')
    writeFileSync(
      path,
      JSON.stringify({
        ...target,
        observedApplicationSchemaSha256: schemaRowsSha256(observed),
        expectedFreshSchemaSha256: schemaRowsSha256(expected),
        reviewedAt: new Date().toISOString(),
        semanticReview: true,
        reviewedDimensions: [
          'columns',
          'defaults',
          'primaryKeys',
          'foreignKeys',
          'uniqueIndexes',
          'indexes',
          'checks',
        ],
      }),
      { mode: 0o600 },
    )
    expect(assessSchemaAdmission(observed, expected, target, path).admitted).toBe(true)
  })
})
