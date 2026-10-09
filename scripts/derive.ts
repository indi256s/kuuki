/** Publish derived state for imported users only. Never clears another user's rows. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { repairUserDerivedState } from '../functions/api/_services/derivedState'
import { openLocalTarget, parseLocalTarget } from './migration-target'
import { inspectSnapshotImport } from './sb-to-d1'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseLocalTarget(argv)
  const index = argv.indexOf('--snapshot-dir')
  const snapshotDir = index < 0 ? join(ROOT, 'db', '_snapshot') : resolve(argv[index + 1])
  const manifest = JSON.parse(
    readFileSync(join(snapshotDir, '_migration-manifest.json'), 'utf8'),
  ) as {
    databaseId: string
    schemaSha256: string
    sourceSnapshotSha256: string
    sourceFiles: { profiles: { sha256: string; rows: number } }
    visitEvidence: { raw: number }
  }
  if (manifest.databaseId !== options.databaseId)
    throw new Error('Import manifest target differs from explicit target')
  const profileText = readFileSync(join(snapshotDir, 'profiles.json'), 'utf8')
  const profileHash = createHash('sha256').update(profileText).digest('hex')
  if (profileHash !== manifest.sourceFiles.profiles.sha256)
    throw new Error('Profiles source changed since import plan')
  const profiles = JSON.parse(profileText) as Array<{ id: string }>
  if (
    profiles.length !== manifest.sourceFiles.profiles.rows ||
    new Set(profiles.map((p) => p.id)).size !== profiles.length
  ) {
    throw new Error('Source profile IDs are not unique or changed')
  }

  const target = await openLocalTarget(options)
  try {
    if (target.schemaSha256 !== manifest.schemaSha256)
      throw new Error('Import manifest schema differs from target')
    const imported = await inspectSnapshotImport(target.db, snapshotDir)
    if (imported.manifest.sourceSnapshotSha256 !== manifest.sourceSnapshotSha256) {
      throw new Error('Source changed since import')
    }
    const incomplete = imported.prepared.filter((table) => table.missing.length > 0)
    if (incomplete.length)
      throw new Error(`Canonical import incomplete in ${incomplete.length} tables`)
    let ready = 0
    for (const { id } of profiles) {
      const result = await repairUserDerivedState(target.db, id)
      if (result.derived_state !== 'ready')
        throw new Error('Scoped derived repair remained pending')
      ready++
    }
    const fk = await target.db.prepare('PRAGMA foreign_key_check').all()
    if ((fk.results ?? []).length)
      throw new Error(`Foreign-key violations after derived repair: ${fk.results.length}`)
    console.log(
      JSON.stringify({
        target: 'local',
        databaseId: options.databaseId,
        repairedUsers: ready,
        foreignKeyViolations: 0,
      }),
    )
  } finally {
    await target.dispose()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error('Scoped derived repair failed; private source identifiers suppressed')
    process.exitCode = 1
  })
}
