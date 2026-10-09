import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Static admission proves configuration consistency, never live write isolation.
const argument = (flag, fallback) => {
  const index = process.argv.indexOf(flag)
  return index < 0 ? fallback : resolve(process.argv[index + 1] ?? '')
}
const config = readFileSync(
  argument('--config', new URL('../wrangler.toml', import.meta.url)),
  'utf8',
)
const maintenance = readFileSync(
  argument(
    '--maintenance-config',
    new URL('../workers/maintenance/wrangler.toml', import.meta.url),
  ),
  'utf8',
)
function sections(source, name) {
  const blocks = []
  let current
  for (const line of source.split('\n')) {
    const header = line.match(/^\s*\[\[?([^\]]+)\]\]?\s*(?:#.*)?$/)
    if (header) {
      current = header[1] === name ? {} : undefined
      if (current) blocks.push(current)
    } else if (current) {
      const entry = line.match(/^\s*(\w+)\s*=\s*"([^"]*)"\s*(?:#.*)?$/)
      if (entry) current[entry[1]] = entry[2]
    }
  }
  return blocks
}
const validDb = (id) =>
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id ?? '') &&
  !/^0+$/.test(id.replaceAll('-', ''))
const validKv = (id) => /^[a-f0-9]{32}$/i.test(id ?? '') && !/^0+$/.test(id)
const problems = []
const caches = []
function databases(source, prefix) {
  const production = sections(source, 'd1_databases')
  const preview = sections(source, 'env.preview.d1_databases')
  const prod = production.filter((row) => row.binding === 'DB')
  const prev = preview.filter((row) => row.binding === 'DB')
  if (
    prod.length !== 1 ||
    prev.length !== 1 ||
    !validDb(prod[0]?.database_id) ||
    !validDb(prev[0]?.database_id)
  )
    problems.push(`${prefix}: one valid production and preview DB binding is required`)
  const prodIds = new Set(production.map((row) => row.database_id))
  if (preview.some((row) => !validDb(row.database_id) || prodIds.has(row.database_id)))
    problems.push(`${prefix}: preview D1 IDs must be valid and differ from all production IDs`)
  return { prod: prod[0]?.database_id, prev: prev[0]?.database_id }
}
const pagesDb = databases(config, 'Pages')
const cronDb = databases(maintenance, 'Maintenance')
if (pagesDb.prod !== cronDb.prod || pagesDb.prev !== cronDb.prev)
  problems.push('Maintenance DB bindings must align with Pages in each environment')
const origin = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.origin === value ? url.origin : null
  } catch {
    return null
  }
}
const prodVars = sections(config, 'vars')[0] ?? {}
const previewVars = sections(config, 'env.preview.vars')[0] ?? {}
if (
  !origin(prodVars.PAGES_ORIGIN) ||
  !origin(previewVars.PAGES_ORIGIN) ||
  prodVars.PAGES_ORIGIN === previewVars.PAGES_ORIGIN
)
  problems.push('Explicit distinct HTTPS production and preview PAGES_ORIGIN values are required')
for (const [label, vars] of [
  ['Production', prodVars],
  ['Preview', previewVars],
]) {
  if (
    vars.ACTIVATION_ORIGIN &&
    (!origin(vars.ACTIVATION_ORIGIN) || vars.ACTIVATION_ORIGIN === vars.PAGES_ORIGIN)
  )
    problems.push(`${label}: activation origin must be an isolated HTTPS origin`)
}
if (prodVars.ACTIVATION_ORIGIN && prodVars.ACTIVATION_ORIGIN === previewVars.ACTIVATION_ORIGIN)
  problems.push('Preview activation origin must differ from production')
// No KV is required. If declared, every preview cache must be distinct and aligned.
for (const [name, source] of [
  ['Pages', config],
  ['Maintenance', maintenance],
]) {
  const production = sections(source, 'kv_namespaces')
  const preview = sections(source, 'env.preview.kv_namespaces')
  if (production.length || preview.length) {
    const prodIds = new Set(production.map((row) => row.id))
    if (
      production.some((row) => !validKv(row.id)) ||
      preview.some((row) => !validKv(row.id) || prodIds.has(row.id)) ||
      production.some((row) => preview.filter((p) => p.binding === row.binding).length !== 1) ||
      preview.some((row) => production.filter((p) => p.binding === row.binding).length !== 1)
    )
      problems.push(`${name}: optional KV bindings require valid isolated preview IDs`)
  }
  caches.push({ name, production, preview })
}
// A declared maintenance cache must target the matching application cache.
for (const environment of ['production', 'preview']) {
  for (const row of caches[1][environment]) {
    if (!caches[0][environment].some((app) => app.binding === row.binding && app.id === row.id)) {
      problems.push(`Maintenance: optional ${environment} KV bindings must align with Pages`)
    }
  }
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    'D1 bindings and origins are consistent and isolated in configuration; live isolation remains an external gate',
  )
}
