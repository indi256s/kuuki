import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

// This is a local artifact admission record, not a deployment or a live-binding check.
// Limits: https://developers.cloudflare.com/workers/platform/limits/
const root = resolve(import.meta.dirname, '..')
const workerLimit = 64 * 1024 * 1024
const assetFileLimit = 25 * 1024 * 1024
const freeAssetCountLimit = 20_000
const paidAssetCountLimit = 100_000
const required = [
  'apps/next/.open-next/worker.js',
  'apps/next/.open-next/assets/BUILD_ID',
  'apps/next/.next/required-server-files.json',
  'apps/next/.next/BUILD_ID',
  'apps/next/api-routes.generated.ts',
  'apps/next/wrangler.toml', 'apps/next/next.config.ts', 'apps/next/open-next.config.ts', 'apps/next/worker.ts',
  'wrangler.toml', 'workers/maintenance/wrangler.toml',
  'package.json', 'apps/next/package.json', 'pnpm-lock.yaml', 'scripts/build-next.mjs',
  'scripts/next-artifact-manifest.mjs',
]
const directories = [
  '.wrangler/next-build', '.wrangler/functions-build', 'apps/next/.open-next/assets',
  'workers/maintenance/.wrangler/maintenance-build',
]
for (const path of [...required, ...directories]) if (!existsSync(join(root, path))) throw new Error(`Missing candidate input: ${path}`)

const files = new Set(required)
function visit(path) {
  for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
    const child = `${path}/${entry.name}`
    const stats = lstatSync(join(root, child))
    if (stats.isSymbolicLink()) throw new Error(`Unexpected symlink in candidate artifact: ${child}`)
    if (stats.isDirectory()) visit(child)
    else if (stats.isFile()) files.add(child)
    else throw new Error(`Unexpected candidate artifact entry: ${child}`)
  }
}
for (const path of directories) visit(path)
const ordered = [...files].sort()
const entries = ordered.map(path => {
  const data = readFileSync(join(root, path))
  return { path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') }
})
const byPath = new Map(entries.map(entry => [entry.path, entry]))
const workerEntries = entries.filter(entry => /^\.wrangler\/next-build\/worker\.(?:js|mjs)$/.test(entry.path))
if (workerEntries.length !== 1) throw new Error(`Expected one Wrangler dry-run Worker, found ${workerEntries.length}`)
const worker = workerEntries[0]
if (worker.bytes > workerLimit) throw new Error(`Worker is ${worker.bytes} bytes; Cloudflare limit is ${workerLimit}`)
const assets = entries.filter(entry => entry.path.startsWith('apps/next/.open-next/assets/'))
if (!assets.length) throw new Error('Next static asset directory is empty')
const oversizedAssets = assets.filter(entry => entry.bytes > assetFileLimit)
if (oversizedAssets.length) throw new Error(`Static assets exceed 25 MiB: ${oversizedAssets.map(entry => entry.path).join(', ')}`)
if (assets.length > paidAssetCountLimit) throw new Error(`Static asset count ${assets.length} exceeds the published paid-tier ceiling`)
const bytesUnder = prefix => entries.filter(entry => entry.path.startsWith(prefix)).reduce((sum, entry) => sum + entry.bytes, 0)

const build = JSON.parse(readFileSync(join(root, 'apps/next/.next/required-server-files.json'), 'utf8'))
const config = build?.config
if (config?.cacheComponents !== false || config?.partialPrefetching !== false || config?.experimental?.exposeTestingApiInProductionBuild === true) {
  throw new Error('Candidate is not the approved standard-streaming production build')
}
const buildId = readFileSync(join(root, 'apps/next/.next/BUILD_ID'), 'utf8').trim()
const assetBuildId = readFileSync(join(root, 'apps/next/.open-next/assets/BUILD_ID'), 'utf8').trim()
if (!buildId || buildId !== assetBuildId) throw new Error('Next build IDs do not match between server and assets')
const appPackage = JSON.parse(readFileSync(join(root, 'apps/next/package.json'), 'utf8'))
const installedVersion = path => JSON.parse(readFileSync(join(root, path), 'utf8')).version
const miniflareRequire = createRequire(realpathSync(join(root, 'node_modules/miniflare/package.json')))
const version = {
  node: process.version,
  pnpm: execFileSync('pnpm', ['--version'], { cwd: root, encoding: 'utf8' }).trim(),
  next: installedVersion('apps/next/node_modules/next/package.json'),
  openNext: installedVersion('apps/next/node_modules/@opennextjs/cloudflare/package.json'),
  react: installedVersion('apps/next/node_modules/react/package.json'),
  wrangler: installedVersion('node_modules/wrangler/package.json'),
  miniflare: installedVersion('node_modules/miniflare/package.json'),
  workerd: miniflareRequire('workerd/package.json').version,
  maplibre: installedVersion('apps/next/node_modules/maplibre-gl/package.json'),
  playwright: installedVersion('apps/next/node_modules/@playwright/test/package.json'),
}
if (version.next !== appPackage.dependencies.next || version.openNext !== appPackage.dependencies['@opennextjs/cloudflare'] || version.react !== appPackage.dependencies.react) {
  throw new Error('Installed Next/OpenNext/React versions differ from pinned application versions')
}
const sourceSha = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const sha256 = data => createHash('sha256').update(data).digest('hex')
const trackedPatch = execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: root, maxBuffer: 16 * 1024 * 1024 })
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean).sort().map(path => ({ path, sha256: sha256(readFileSync(join(root, path))) }))
const sourceIdentity = {
  baseSha: sourceSha,
  dirty: trackedPatch.length > 0 || untracked.length > 0,
  trackedPatchSha256: sha256(trackedPatch),
  untrackedContentSha256: sha256(JSON.stringify(untracked)),
}
const manifest = {
  schema: 1,
  sourceSha,
  sourceIdentity,
  compatibility: { date: '2026-08-06', flags: ['nodejs_compat'] },
  buildId,
  runtime: version,
  flags: { cacheComponents: false, partialPrefetching: false, exposeTestingApiInProductionBuild: false },
  limits: {
    source: 'https://developers.cloudflare.com/workers/platform/limits/',
    workerUncompressedBytes: workerLimit,
    individualAssetBytes: assetFileLimit,
    freeAssetCount: freeAssetCountLimit,
    paidAssetCount: paidAssetCountLimit,
    accountTierVerified: false,
  },
  measurements: {
    dryRunWorkerBytes: worker.bytes,
    dryRunWorkerGzipBytes: gzipSync(readFileSync(join(root, worker.path))).length,
    staticAssetCount: assets.length,
    staticAssetBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    largestStaticAssetBytes: assets.reduce((largest, asset) => Math.max(largest, asset.bytes), 0),
    compiledPagesApiBytes: bytesUnder('.wrangler/functions-build/'),
    compiledMaintenanceBytes: bytesUnder('workers/maintenance/.wrangler/maintenance-build/'),
    exceedsFreeAssetCount: assets.length > freeAssetCountLimit,
  },
  files: entries,
}
const outputFlag = process.argv.indexOf('--output')
if (outputFlag >= 0 && !process.argv[outputFlag + 1]) throw new Error('--output requires a path')
const output = outputFlag >= 0 ? resolve(process.argv[outputFlag + 1]) : join(root, '.wrangler/next-artifact-manifest.json')
writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ manifest: relative(root, output), sourceSha, buildId, runtime: version, flags: manifest.flags, measurements: manifest.measurements }))
