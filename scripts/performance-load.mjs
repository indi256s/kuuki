import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync, brotliCompressSync } from 'node:zlib'

// Production fixture only. Build/start pnpm next:preview, then sign in with an isolated agent-browser session.
// KUUKI_PERF_SESSION=<session> node scripts/performance-load.mjs <label>
const phase = process.argv[2] ?? 'candidate'
if (!/^[a-zA-Z0-9_-]+$/.test(phase))
  throw Error('Use a simple label: letters, numbers, underscores or hyphens')
const trials = Number(process.env.PERF_TRIALS ?? 3)
const session = process.env.KUUKI_PERF_SESSION ?? 'kuuki-performance'
const origin = process.env.KUUKI_PERF_ORIGIN ?? 'http://127.0.0.1:8800'
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname))
  throw Error('Use a local fixture origin')
const directory = process.env.KUUKI_PERF_OUTPUT ?? '.scratch/performance-load'
mkdirSync(directory, { recursive: true })
const scriptSizes = new Map()
const browser = (args, input) => {
  const result = JSON.parse(
    execFileSync('agent-browser', ['--session', session, '--json', ...args], {
      input,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    }),
  )
  if (!result.success) throw Error(result.error)
  return result.data?.result ?? result.data
}
const evaluate = (code) => browser(['eval', '--stdin'], code)
const { cdpUrl } = browser(['get', 'cdp-url'])
const socket = new WebSocket(cdpUrl)
await new Promise((resolve, reject) => {
  socket.onopen = resolve
  socket.onerror = reject
})
let sequence = 0
const pending = new Map()
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data)
  const task = pending.get(message.id)
  if (task) {
    pending.delete(message.id)
    if (message.error) task.reject(Error(JSON.stringify(message.error)))
    else task.resolve(message.result)
  }
}
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
  })
}
const { targetInfos } = await send('Target.getTargets')
const target = targetInfos.find((item) => item.type === 'page' && item.url.startsWith(origin))
if (!target) throw Error('Open fixture with agent-browser first')
const { sessionId } = await send('Target.attachToTarget', {
  targetId: target.targetId,
  flatten: true,
})
const cdp = (method, params) => send(method, params, sessionId)
await cdp('Network.enable')
await cdp('Performance.enable')
await cdp('Page.enable')
await cdp('Network.setCacheDisabled', { cacheDisabled: true })
const { identifier } = await cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: `
  performance.setResourceTimingBufferSize(10000);
  window.__loadPerf = {lcp: null, cls: 0, tasks: [], readyMs: null};
  for (const type of ['largest-contentful-paint', 'layout-shift', 'longtask']) {
    new PerformanceObserver(list => { for (const e of list.getEntries()) {
      if (type === 'largest-contentful-paint') __loadPerf.lcp = e.startTime;
      if (type === 'layout-shift' && !e.hadRecentInput) __loadPerf.cls += e.value;
      if (type === 'longtask') __loadPerf.tasks.push({start:e.startTime,duration:e.duration});
    }}).observe({type, buffered:true});
  }
  const check = () => {
    const selector = location.pathname === '/overview' ? '.ov-filter-add' : location.pathname === '/journal' ? 'input[type="search"]' : '[role="radiogroup"] button';
    const node = document.querySelector(selector);
    if (node && Object.keys(node).some(k => k.startsWith('__reactProps$'))) {
      requestAnimationFrame(() => requestAnimationFrame(() => { __loadPerf.readyMs = performance.now(); }));
    } else requestAnimationFrame(check);
  }; requestAnimationFrame(check);
`,
})
const rows = []
try {
  for (const profile of [
    { name: 'mobile', width: 390, height: 844, cpu: 4 },
    { name: 'desktop', width: 1440, height: 900, cpu: 1 },
  ]) {
    if (process.env.PERF_PROFILE && process.env.PERF_PROFILE !== profile.name) continue
    browser(['set', 'viewport', String(profile.width), String(profile.height)])
    await cdp('Emulation.setCPUThrottlingRate', { rate: profile.cpu })
    await cdp('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 1_600_000 / 8,
      uploadThroughput: 750_000 / 8,
      connectionType: 'cellular3g',
    })
    for (let iteration = 0; iteration < trials; iteration++) {
      for (const route of ['overview', 'journal', 'passport']) {
        if (process.env.PERF_ROUTE && process.env.PERF_ROUTE !== route) continue
        await cdp('Network.clearBrowserCache')
        browser(['open', `${origin}/${route}`])
        const sample = evaluate(`(async () => {
          if (location.pathname !== '/${route}') throw Error('Sign in to the synthetic fixture before measuring');
          const start = performance.now();
          while (__loadPerf.readyMs === null) {
            if (performance.now()-start > 120000) throw Error('Readiness timed out');
            await new Promise(r=>setTimeout(r,100));
          }
          // Include post-hydration and route-prefetch requests, rather than hiding deferred bytes.
          await new Promise(r=>setTimeout(r,3000));
          const resources = performance.getEntriesByType('resource');
          const nav = performance.getEntriesByType('navigation')[0];
          return {...__loadPerf, ttfbMs:nav.responseStart, fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
            domContentLoadedMs:nav.domContentLoadedEventEnd,
            connection:{effectiveType:navigator.connection?.effectiveType,downlink:navigator.connection?.downlink,saveData:navigator.connection?.saveData},
            resources:resources.map(r=>({path:new URL(r.name).pathname,type:r.initiatorType,bytes:r.decodedBodySize,transferBytes:r.transferSize,endMs:r.responseEnd})),
            overflow:document.documentElement.scrollWidth > innerWidth,
            errors:document.querySelector('[data-nextjs-dialog]')!==null};
        })()`)
        const metrics = await cdp('Performance.getMetrics')
        const scripts = [
          ...new Set(sample.resources.filter((r) => /\.m?js$/.test(r.path)).map((r) => r.path)),
        ]
        const sizes = scripts.reduce(
          (sum, path) => {
            try {
              let size = scriptSizes.get(path)
              if (!size) {
                const bytes = readFileSync(`apps/next/.open-next/assets${path}`)
                size = {
                  raw: bytes.length,
                  gzip: gzipSync(bytes).length,
                  brotli: brotliCompressSync(bytes).length,
                }
                scriptSizes.set(path, size)
              }
              sum.raw += size.raw
              sum.gzip += size.gzip
              sum.brotli += size.brotli
            } catch {
              /* nonstatic script */
            }
            return sum
          },
          { raw: 0, gzip: 0, brotli: 0 },
        )
        const row = {
          profile: profile.name,
          route,
          iteration,
          ...sample,
          jsBytes: sizes,
          scriptMs: 1000 * (metrics.metrics.find((x) => x.name === 'ScriptDuration')?.value ?? 0),
        }
        rows.push(row)
        writeFileSync(
          `${directory}/${phase}-loads.json`,
          JSON.stringify(
            {
              phase,
              trials,
              network: { mbps: 1.6, latencyMs: 150, localAssetsCompressed: true },
              rows,
            },
            null,
            2,
          ),
        )
        console.log(
          JSON.stringify({
            phase,
            profile: profile.name,
            route,
            iteration,
            readyMs: Math.round(row.readyMs),
            lcpMs: Math.round(row.lcp),
            jsGzip: sizes.gzip,
            raw: sizes.raw,
            requests: sample.resources.length,
            overflow: sample.overflow,
          }),
        )
      }
    }
  }
} finally {
  await cdp('Emulation.setCPUThrottlingRate', { rate: 1 })
  await cdp('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  await send('Target.detachFromTarget', { sessionId })
  socket.close()
}
