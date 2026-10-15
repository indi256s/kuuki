import { execFileSync } from 'node:child_process'

// Free 127.0.0.1 port, `preferred` when it is free. Synchronous so module-level config can call it.
export function freePort(preferred = 0): number {
  const probe = `const s = require('node:net').createServer()
s.once('error', () => s.listen(0, '127.0.0.1'))
s.once('listening', () => { process.stdout.write(String(s.address().port)); s.close() })
s.listen(${preferred}, '127.0.0.1')`
  return Number(execFileSync(process.execPath, ['-e', probe], { encoding: 'utf8' }))
}
