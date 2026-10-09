/** Read-only, explicit-target validation after a separately approved remote transfer. */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assessSchemaAdmission, expectedSchemaRows } from './migration-target'
import { assertRemoteIds, openRemoteReader } from './migration-remote-reader'
import { validateTarget, type Manifest } from './validate'
import { ROOT, SCHEMA_SQL, requiredArg } from './_cli'

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const accountId = requiredArg(argv, '--account-id')
  const databaseId = requiredArg(argv, '--database-id')
  assertRemoteIds(accountId, databaseId)
  const snapshotAt = argv.indexOf('--snapshot-dir')
  const snapshotDir =
    snapshotAt < 0 ? join(ROOT, 'db', '_snapshot') : resolve(requiredArg(argv, '--snapshot-dir'))
  const manifest = JSON.parse(
    readFileSync(resolve(requiredArg(argv, '--manifest')), 'utf8'),
  ) as Manifest & {
    expectedFreshSchemaSha256: string
  }
  if (
    manifest.target !== 'remote' ||
    manifest.accountId !== accountId ||
    manifest.databaseId !== databaseId
  ) {
    throw new Error('Remote manifest target mismatch')
  }
  const admissionAt = argv.indexOf('--schema-admission')
  const admissionPath =
    admissionAt < 0 ? undefined : resolve(requiredArg(argv, '--schema-admission'))
  const reader = openRemoteReader(accountId, databaseId)
  try {
    const schema = assessSchemaAdmission(
      await reader.read(SCHEMA_SQL),
      await expectedSchemaRows(),
      { accountId, databaseId },
      admissionPath,
    )
    if (
      !schema.admitted ||
      schema.observedSha256 !== manifest.schemaSha256 ||
      schema.expectedSha256 !== manifest.expectedFreshSchemaSha256
    ) {
      throw new Error(
        `Remote schema/manifest admission failed: ${schema.reason ?? 'fingerprint-changed'}`,
      )
    }
    await validateTarget(reader, snapshotDir, manifest)
    console.log(
      JSON.stringify({
        result: 'PASS',
        target: 'remote',
        accountId,
        databaseId,
        observedSchemaSha256: schema.observedSha256,
        sourceSnapshotSha256: manifest.sourceSnapshotSha256,
        sourceFreshnessVerified: false,
        foreignKeyViolations: 0,
      }),
    )
  } finally {
    reader.dispose()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Remote validation failed: ${(error as Error).message}`)
    process.exitCode = 1
  })
}
