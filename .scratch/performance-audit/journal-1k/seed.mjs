import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
const session = 'jr1k-seed'
function browser(args, input) {
  const r = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...args], { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
  if (!r.success) throw new Error(r.error)
  return r.data?.result ?? r.data
}
browser(['open', 'http://127.0.0.1:8800'])
const result = browser(['eval', '--stdin'], readFileSync('/tmp/jr1k/seed.js', 'utf8'))
console.log(JSON.stringify(result, null, 1))
browser(['state', 'save', '/tmp/jr1k/state.json'])
writeFileSync('/tmp/jr1k/me.json', JSON.stringify(result.me))
browser(['close'])
