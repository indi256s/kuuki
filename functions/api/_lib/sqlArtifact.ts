/** Literals and derived markers shared by private, reviewed migration artifacts. */
export function sqlLiteral(value: string | number | null): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Nonfinite SQL value')
    return String(value)
  }
  if (value.includes('\0')) throw new Error('NUL in SQL artifact value')
  return `'${value.replaceAll("'", "''")}'`
}

export function dirtyMarkerSql(userIds: string[]): string[] {
  const statements: string[] = []
  for (let i = 0; i < userIds.length; i += 100) {
    statements.push(`INSERT INTO user_derived_state (user_id, revision, published_revision)
SELECT id, 1, 0 FROM users WHERE id IN (${userIds.slice(i, i + 100).map(sqlLiteral).join(', ')})
ON CONFLICT(user_id) DO UPDATE SET revision = user_derived_state.revision + 1,
  last_error = NULL, updated_at = excluded.updated_at;`)
  }
  return statements
}
