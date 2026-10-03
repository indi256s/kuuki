import { readFileSync } from 'node:fs'

// Cloud configuration still needs a live isolation check before setting the
// PREVIEW_ISOLATION_VERIFIED repository variable.
const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')
function section(name) {
  return config.split(new RegExp(`\\[\\[?${name.replaceAll('.', '\\.') }\\]?\\]`))[1]?.split(/\n\[/)[0] ?? ''
}
function value(block, key) {
  return block.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'))?.[1]
}
const prodDb = value(section('d1_databases'), 'database_id')
const previewDb = value(section('env.preview.d1_databases'), 'database_id')
const prodKv = value(section('kv_namespaces'), 'id')
const previewKv = value(section('env.preview.kv_namespaces'), 'id')
const validDb = (id) => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id ?? '') && !/^0+$/.test(id.replaceAll('-', ''))
const validKv = (id) => /^[a-f0-9]{32}$/i.test(id ?? '') && !/^0+$/.test(id)
if (!validDb(previewDb) || !validKv(previewKv) || previewDb === prodDb || previewKv === prodKv) {
  console.error('Preview D1/KV IDs must be provisioned and differ from production before deploy')
  process.exitCode = 1
} else {
  console.log('Preview binding IDs are present and distinct; live isolation remains an external gate')
}
