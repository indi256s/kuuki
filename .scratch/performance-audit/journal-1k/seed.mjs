import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
const auditDir = process.env.KUUKI_JOURNAL_AUDIT_DIR ?? '/tmp/jr1k'
const session = `jr1k-seed-${process.pid}`
function browser(args, input) {
  const r = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...args], { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
  if (!r.success) throw new Error(r.error)
  return r.data?.result ?? r.data
}
try {
  browser(['open', process.env.KUUKI_JOURNAL_ORIGIN ?? 'http://127.0.0.1:8800'])
  const result = browser(['eval', '--stdin'], readFileSync(`${auditDir}/seed.js`, 'utf8'))
  if (result.total !== 1000 || result.failures) throw new Error('Synthetic seed incomplete')
  console.log(JSON.stringify({ total: result.total, failures: result.failures }))
  browser(['state', 'save', `${auditDir}/state.json`])
  writeFileSync(`${auditDir}/me.json`, JSON.stringify(result.me))
} finally { browser(['close']) }
