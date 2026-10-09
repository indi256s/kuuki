/** Read-only migration admission check. This program never opens a D1 connection. */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAX_REVIEW_AGE_MS, requiredArg } from './_cli'

interface Evidence {
  target: 'local' | 'staging' | 'production'
  observedDbId: string
  expectedSchemaSha256: string
  observedSchemaSha256: string
  backupReference: string
  sourceSnapshotSha256: string
  sourceSnapshotCapturedAt: string
  sourceSnapshotReviewedAt: string
  conflictsReviewed: boolean
  unresolvedConflicts: number
}

function fail(message: string): never {
  throw new Error(message)
}
function configId(config: string, section: string): string | undefined {
  const escaped = section.replaceAll('.', '\\.')
  const match = config.match(new RegExp(`\\[\\[${escaped}\\]\\]([\\s\\S]*?)(?=\\n\\[|$)`))
  return match?.[1].match(/^database_id\s*=\s*"([^"]+)"/m)?.[1]
}
function validHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash)
}

try {
  const target = requiredArg(process.argv, '--target')
  if (!['local', 'staging', 'production'].includes(target)) fail('Unknown target')
  const file = resolve(requiredArg(process.argv, '--evidence'))
  const evidence = JSON.parse(readFileSync(file, 'utf8')) as Evidence
  if (evidence.target !== target) fail('Target disagrees with evidence')
  const config = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../wrangler.toml'),
    'utf8',
  )
  const expectedDbId =
    target === 'local'
      ? 'local-synthetic-d1'
      : configId(config, target === 'staging' ? 'env.preview.d1_databases' : 'd1_databases')
  if (!expectedDbId || /^0+$/.test(expectedDbId.replaceAll('-', '')))
    fail('Target DB ID is not provisioned')
  if (evidence.observedDbId !== expectedDbId) fail('Observed DB ID does not match explicit target')
  if (
    !validHash(evidence.expectedSchemaSha256) ||
    evidence.expectedSchemaSha256 !== evidence.observedSchemaSha256
  )
    fail('Schema fingerprint mismatch or missing')
  if (!evidence.backupReference?.trim()) fail('Backup reference required')
  if (!validHash(evidence.sourceSnapshotSha256)) fail('Source snapshot fingerprint required')
  const captured = Date.parse(evidence.sourceSnapshotCapturedAt)
  const reviewed = Date.parse(evidence.sourceSnapshotReviewedAt)
  if (!Number.isFinite(captured) || !Number.isFinite(reviewed) || reviewed < captured)
    fail('Source snapshot review is stale or missing')
  if (reviewed > Date.now()) fail('Source snapshot review cannot be in the future')
  if (target !== 'local' && Date.now() - reviewed > MAX_REVIEW_AGE_MS)
    fail('Source snapshot review is older than 24 hours')
  if (
    evidence.conflictsReviewed !== true ||
    !Number.isInteger(evidence.unresolvedConflicts) ||
    evidence.unresolvedConflicts !== 0
  )
    fail('Unresolved or unreviewed account conflicts')
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        target,
        databaseId: expectedDbId,
        schemaSha256: evidence.observedSchemaSha256,
        backupReference: evidence.backupReference,
        sourceSnapshotSha256: evidence.sourceSnapshotSha256,
        conflictsReviewed: true,
        next: 'No writes performed; migration requires a separate authorized operation',
      },
      null,
      2,
    ),
  )
} catch (error) {
  console.error(`Preflight refused: ${(error as Error).message}`)
  process.exitCode = 1
}
