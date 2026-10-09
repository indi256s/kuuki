// node /tmp/jr1k/measure.mjs <cpuRate> <runs> <outfile>
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
const rate = Number(process.argv[2] ?? 4)
const runs = Number(process.argv[3] ?? 3)
const outFile = process.argv[4] ?? `/tmp/jr1k/runs-cpu${rate}.json`
const origin = 'http://127.0.0.1:8800'
const st = JSON.parse(readFileSync('/tmp/jr1k/state.json', 'utf8'))
function browser(session, args, input) {
  const r = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...args], { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
  if (!r.success) throw new Error(r.error)
  return r.data?.result ?? r.data
}
function cdp(url) {
  const ws = new WebSocket(url)
  let id = 0; const pending = new Map(); const listeners = []
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) }
    else listeners.forEach(l => l(m))
  }
  return { ready, close: () => ws.close(), on: l => listeners.push(l),
    send: (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })) }) }
}
const results = []
for (let run = 0; run < runs; run++) {
  const session = `jr1k-m${rate}-${run}-${Date.now() % 100000}`
  browser(session, ['open', 'about:blank', '--init-script', '/tmp/jr1k/init.js'])
  for (const c of st.cookies) browser(session, ['cookies', 'set', c.name, c.value, '--url', origin + '/', '--path', c.path, '--sameSite', c.sameSite, ...(c.httpOnly ? ['--httpOnly'] : [])])
  browser(session, ['set', 'viewport', '1280', '800'])
  const wsUrl = browser(session, ['get', 'cdp-url'])
  const url = typeof wsUrl === 'string' ? wsUrl : wsUrl.cdpUrl ?? wsUrl.url
  const c = cdp(url); await c.ready
  const { targetInfos } = await c.send('Target.getTargets')
  const page = targetInfos.find(t => t.type === 'page' && t.url === 'about:blank') ?? targetInfos.find(t => t.type === 'page')
  const { sessionId } = await c.send('Target.attachToTarget', { targetId: page.targetId, flatten: true })
  const consoleMsgs = []
  c.on(m => {
    if (m.sessionId !== sessionId) return
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(m.params.type)) consoleMsgs.push({ type: m.params.type, text: m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 400) })
    if (m.method === 'Runtime.exceptionThrown') consoleMsgs.push({ type: 'exception', text: (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 400) })
    if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) consoleMsgs.push({ type: 'log-' + m.params.entry.level, text: (m.params.entry.text + ' ' + (m.params.entry.url ?? '')).slice(0, 400) })
  })
  await c.send('Runtime.enable', {}, sessionId); await c.send('Log.enable', {}, sessionId)
  await c.send('Emulation.setCPUThrottlingRate', { rate }, sessionId)
  browser(session, ['open', `${origin}/journal`])
  let data
  for (let i = 0; i < 120; i++) {
    data = browser(session, ['eval', '--stdin'], `(() => { const p = window.__jr; if (!p || !p.done) return { pending: true }; const n = performance.getEntriesByType('navigation')[0];
      return { ...p, run: undefined, nav: { ttfb: n.responseStart, responseEnd: n.responseEnd, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, transfer: n.transferSize, encoded: n.encodedBodySize, decoded: n.decodedBodySize, nextHopProtocol: n.nextHopProtocol },
      resources: performance.getEntriesByType('resource').map(r => ({ path: new URL(r.name).pathname, type: r.initiatorType, bytes: r.transferSize, encoded: r.encodedBodySize, decoded: r.decodedBodySize })) , ua: navigator.userAgent, domNodes: document.getElementsByTagName('*').length, heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null }})()`)
    if (data && !data.pending) break
    await new Promise(r => setTimeout(r, 1000))
  }
  const rateCheck = await c.send('Runtime.evaluate', { expression: 'navigator.hardwareConcurrency', returnByValue: true }, sessionId).catch(() => null)
  results.push({ run, cpuRate: rate, console: consoleMsgs, data })
  writeFileSync(outFile, JSON.stringify(results, null, 1))
  const d = data
  console.log(`run ${run} rate ${rate}: ${d ? `fcp=${d.fcp?.toFixed(0)} lcp=${d.lcp?.toFixed(0)} hydrated=${d.hydratedAt?.toFixed(0)} sort=${d.probe?.condMs?.toFixed(0)} err=${d.error}` : 'NO DATA'} console=${consoleMsgs.length}`)
  c.close()
  browser(session, ['close'])
}
