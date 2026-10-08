// Local production Worker only. Start pnpm next:preview after pnpm next:build.
// node scripts/performance-audit.mjs before [5000] [existing-agent-browser-session]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const phase = process.argv[2] ?? 'before'
const count = Number(process.argv[3] ?? 5000)
const session = process.argv[4] ?? `kuuki-perf-${phase}-${count}`
const origin = `http://127.0.0.1:${process.env.KUUKI_NEXT_PORT ?? 8800}`
const out = '.scratch/performance-audit'
mkdirSync(out, { recursive: true })
function browser(args, input, target = session) {
  const result = JSON.parse(execFileSync('agent-browser', ['--session', target, '--json', ...args],
    { input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }))
  if (!result.success) throw new Error(result.error)
  return result.data?.result ?? result.data
}
const evaluate = code => browser(['eval', '--stdin'], code)
const seed = `async () => {
  const count = ${count};
  const signup = await fetch('/api/auth/sign-up/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: location.origin },
    body: JSON.stringify({ email: 'perf-' + crypto.randomUUID() + '@example.test', password: 'performance-password-2026' }) });
  if (signup.status !== 201) throw Error('signup ' + signup.status);
  const csrf = document.cookie.split('; ').find(v => v.startsWith('kuuki_csrf='))?.split('=')[1];
  const headers = { 'Content-Type': 'application/json', Origin: location.origin, 'X-CSRF-Token': csrf };
  const profile = await fetch('/api/profiles/me', { method: 'PATCH', headers, body: JSON.stringify({ username: 'perf-' + crypto.randomUUID().slice(0, 8) }) });
  if (!profile.ok) throw Error('profile ' + profile.status);
  for (let start = 0; start < count; start += 50) {
    const items = Array.from({ length: Math.min(50, count - start) }, (_, j) => { const i = start + j; return { key: crypto.randomUUID(), flight: {
      date: (2020 + i % 7) + '-06-' + String(1 + i % 28).padStart(2, '0'), origin: i % 2 ? 'TBS' : 'JFK', destination: i % 2 ? 'IST' : 'BOS',
      airline_iata: i % 2 ? 'TK' : 'B6', aircraft_icao: i % 3 ? 'A320' : undefined, flight_number: (i % 2 ? 'TK' : 'B6') + (100 + i % 800), source: 'manual' } } });
    const response = await fetch('/api/flights/bulk', { method: 'POST', headers, body: JSON.stringify({ items }) });
    if (!response.ok || (await response.json()).results.some(v => v.status !== 'created')) throw Error('bulk create failed');
  }
  if ((await (await fetch('/api/flights?limit=1')).json()).total !== count) throw Error('fixture count mismatch');
  return { count };
}`

// Browser clocks exclude CLI/process overhead. Two frames give a paint opportunity,
// not proof of GPU completion. Synthetic events are complemented by real-key journeys.
const init = `(() => {
  performance.setResourceTimingBufferSize(10000);
  const p = window.__kuukiPerf = { longtasks: [], lcp: null, cls: 0, samples: [] };
  for (const type of ['longtask', 'largest-contentful-paint', 'layout-shift']) {
    try { new PerformanceObserver(list => { for (const e of list.getEntries()) {
      if (type === 'longtask') p.longtasks.push({ start: e.startTime, duration: e.duration });
      if (type === 'largest-contentful-paint') p.lcp = e.startTime;
      if (type === 'layout-shift' && !e.hadRecentInput) p.cls += e.value;
    } }).observe({ type, buffered: true }); } catch {}
  }
  const wait = async fn => { const start = performance.now(); while (!fn()) {
    if (performance.now() - start > 20000) throw Error('readiness timed out: ' + fn.toString() + ' at ' + location.href);
    await new Promise(requestAnimationFrame);
  } };
  const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const hydrated = node => !!node && Object.keys(node).some(k => k.startsWith('__reactProps$'));
  const ready = (route, total) => {
    if (route === 'journal') return !!document.querySelector('[data-testid="journal-data"]') && hydrated(document.querySelector('input[type="search"]')) &&
      document.querySelector('[data-testid="journal-data"]').innerText.includes(total.toLocaleString('en-US') + (total === 1 ? ' flight' : ' flights'));
    if (route === 'overview') return document.querySelector('.ov3-hero-flight .ov3-hero-value')?.textContent ===
      (total === 0 && document.querySelector('[data-filter-chip]') ? '—' : total.toLocaleString('en-US')) && hydrated(document.querySelector('.ov-filter-add'));
    if (route === 'passport') return !!document.querySelector('[data-testid="passport-data"]') && hydrated(document.querySelector('[role="radiogroup"] button'));
    return false;
  };
  const sample = async (name, action, done, feedback = done) => {
    const start = performance.now(); let fallbackMs = null;
    const observer = new MutationObserver(() => { if (fallbackMs === null && document.querySelector('main .loading-screen, main p.loading')) fallbackMs = performance.now() - start; });
    observer.observe(document.querySelector('main'), { childList: true, subtree: true });
    action();
    const input = (async () => { await wait(feedback); await frames(); return performance.now() - start; })();
    await wait(done); await frames(); const readyMs = performance.now() - start;
    const feedbackMs = await input;
    observer.disconnect();
    await new Promise(r => setTimeout(r, 0));
    const requests = performance.getEntriesByType('resource').filter(r => r.startTime >= start && ['fetch', 'xmlhttprequest'].includes(r.initiatorType))
      .map(r => ({ path: new URL(r.name).pathname, startMs: r.startTime - start, endMs: r.responseEnd - start, bytes: r.transferSize }));
    const tasks = p.longtasks.filter(t => t.start >= start && t.start < start + readyMs);
    const row = { name, feedbackMs, readyMs, fallbackMs, requests, longTaskCount: tasks.length, maxLongTaskMs: Math.max(0, ...tasks.map(t => t.duration)) };
    p.samples.push(row); return row;
  };
  const input = (node, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); };
  const select = (node, value) => { node.value = value; node.dispatchEvent(new Event('change', { bubbles: true })); };
  const button = (label, root = document) => [...root.querySelectorAll('button')].find(n => n.textContent.trim() === label || n.getAttribute('aria-label') === label);
  window.__kuukiBench = { wait, frames, ready, sample, input, select, button };
  const observe = async () => {
    const route = location.pathname.slice(1);
    if (!['overview', 'journal', 'passport'].includes(route)) return;
    await wait(() => ready(route, ${count})); await frames(); p.loadReadyMs = performance.now();
  };
  document.addEventListener('DOMContentLoaded', () => void observe());
})();`
const initPath = `/tmp/kuuki-perf-init-${phase}-${count}.js`
writeFileSync(initPath, init)
browser(['open', origin])
browser(['set', 'viewport', '1280', '800'])
if (!process.argv[4]) evaluate(`(${seed})()`)
const statePath = `/tmp/kuuki-perf-state-${phase}-${count}.json`
browser(['state', 'save', statePath])
const cookies = JSON.parse(readFileSync(statePath, 'utf8')).cookies
browser(['close'])
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
browser(['open', 'about:blank', '--init-script', initPath])
browser(['state', 'load', statePath])
browser(['set', 'viewport', '1280', '800'])
const result = { phase, count, generatedAt: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  buildId: readFileSync('apps/next/.next/BUILD_ID', 'utf8').trim(), conditions: { viewport: '1280x800', cpu: 'unthrottled', network: 'localhost, unthrottled', cold: 'fresh browser process, existing auth cookies, empty HTTP and router cache', warm: 'same hydrated browser, HTTP/router caches enabled' }, loads: [], samples: [] }
function save() { writeFileSync(join(out, `${phase}-${count}.json`), JSON.stringify(result, null, 2)) }
function jsClosure(resources) {
  const paths = [...new Set(resources.filter(r => /\.m?js$/.test(r.path)).map(r => r.path))]
  return paths.reduce((n, path) => { try { return n + gzipSync(readFileSync(join('apps/next/.open-next/assets', path))).length } catch { return n } }, 0)
}

for (const route of process.env.KUUKI_PERF_PAGES_ONLY === '1' ? [] : ['journal', 'overview', 'passport']) {
  for (let iteration = 0; iteration < 3; iteration++) {
    const coldSession = `${session}-cold-${route}-${iteration}`
    browser(['open', 'about:blank', '--init-script', initPath], undefined, coldSession)
    // State replay visits stored origins and warms shared chunks. Set cookies only.
    for (const cookie of cookies) browser(['cookies', 'set', cookie.name, cookie.value,
      '--url', origin + '/', '--path', cookie.path, '--sameSite', cookie.sameSite,
      ...(cookie.httpOnly ? ['--httpOnly'] : [])], undefined, coldSession)
    browser(['set', 'viewport', '1280', '800'], undefined, coldSession)
    browser(['open', `${origin}/${route}`], undefined, coldSession)
    const load = browser(['eval', '--stdin'], `(async () => {
      await __kuukiBench.wait(() => __kuukiPerf.loadReadyMs); await new Promise(r => setTimeout(r, 250));
      const n = performance.getEntriesByType('navigation')[0];
      return { ua: navigator.userAgent, readyMs: __kuukiPerf.loadReadyMs, ttfb: n.responseStart, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
        lcp: __kuukiPerf.lcp, cls: __kuukiPerf.cls, longtasks: __kuukiPerf.longtasks,
        resources: performance.getEntriesByType('resource').map(r => ({ path: new URL(r.name).pathname, initiator: r.initiatorType, startMs: r.startTime, endMs: r.responseEnd, bytes: r.transferSize, encodedBytes: r.encodedBodySize, decodedBytes: r.decodedBodySize })) };
    })()`, coldSession)
    result.loads.push({ route, iteration, ...load, jsGzipBytes: jsClosure(load.resources) })
    if (load.resources.some(r => /\.m?js$/.test(r.path) && r.bytes <= 300)) throw Error('cold JavaScript cache was warmed')
    browser(['close'], undefined, coldSession); save()
  }
  console.log(`${phase} ${count}: ${route} cold n=3`)
}
if (process.env.KUUKI_PERF_LOADS_ONLY === '1') process.exit(0)
browser(['open', `${origin}/journal`])
evaluate(`__kuukiBench.wait(() => __kuukiBench.ready('journal', ${count}))`)
if (process.env.KUUKI_PERF_PAGES_ONLY !== '1') {
  browser(['network', 'har', 'start', '--content', 'none'])
  browser(['profiler', 'start'])
}
if (count > 20) {
evaluate(`(async () => {
  const { wait, sample, button } = __kuukiBench;
  const rows = () => [...document.querySelectorAll('[data-flight-row]')].map(r => Number(r.dataset.flightRow)).sort((a,b) => a-b).join();
  const first = await (await fetch('/api/flights?limit=20')).json();
  const second = await (await fetch('/api/flights?limit=20&offset=20')).json();
  for (let i = 0; i < 5; i++) {
    await sample('journal:page2', () => button('Next').click(), () => location.search === '?page=2' && rows() === second.flights.map(r => r.id).sort((a,b) => a-b).join());
    await sample('journal:page1', () => button('Previous').click(), () => !location.search && rows() === first.flights.map(r => r.id).sort((a,b) => a-b).join());
  }
  for (let i = 0; i < 3; i++) {
    await sample('journal:select-all', () => button('Select all matching flights').click(), () => !!document.querySelector('[aria-label="Selection actions"]')?.textContent.includes('${count.toLocaleString('en-US')} flights selected'));
    button('Clear selection').click(); await wait(() => !document.querySelector('[aria-label="Selection actions"]'));
  }
})()`)
}
result.samples.push(...evaluate('__kuukiPerf.samples')); evaluate('__kuukiPerf.samples = []'); save()
if (process.env.KUUKI_PERF_PAGES_ONLY === '1') process.exit(0)

// Each filter is applied through its real UI handler and checked against the owned API.
for (const [key, value] of [['q', 'Tbilisi'], ['year', '2025'], ['airline', 'TK'], ['aircraft', 'A320'], ['airport', 'IST'], ['origin', 'TBS'], ['destination', 'IST'], ['status', 'completed'], ['status', 'upcoming'], ['status', 'awaiting'], ['status', 'logged']]) {
  evaluate(`(async () => {
    const { wait, ready, sample, input, select, button, frames } = __kuukiBench;
    for (let i = 0; i < 5; i++) {
      const reset = [...document.querySelectorAll('.journal-filters a')].find(a => a.textContent === 'Reset filters');
      if (reset) { reset.click(); await wait(() => !location.search && ready('journal', ${count})); await frames(); }
      const expected = await (await fetch('/api/flights?limit=20&' + new URLSearchParams({ [${JSON.stringify(key)}]: ${JSON.stringify(value)} }))).json();
      const total = expected.total;
      const field = ${JSON.stringify(key)} === 'q' ? document.querySelector('input[type="search"]') : ${JSON.stringify(key)} === 'status' ? document.querySelector('.journal-filters-desktop select') : document.querySelector('.journal-filters-desktop [data-filter="${key}"]');
      await sample('journal:${key}=${value}', () => {
        if (${JSON.stringify(key)} === 'status') select(field, ${JSON.stringify(value)});
        else { input(field, ${JSON.stringify(value)}); document.querySelector('form[role="search"]').requestSubmit(); }
      }, () => new URLSearchParams(location.search).get(${JSON.stringify(key)}) === ${JSON.stringify(value)} && ready('journal', total), () => field.value === ${JSON.stringify(value)});
      const rows = document.querySelectorAll('[data-flight-row]');
      if (rows.length !== Math.min(total, 20)) throw Error('wrong row count for ${key}');
      if ([...rows].map(r => Number(r.dataset.flightRow)).sort((a,b) => a-b).join() !== expected.flights.map(r => r.id).sort((a,b) => a-b).join()) throw Error('wrong rows for ${key}');
    }
    return true;
  })()`)
  console.log(`${phase} ${count}: journal ${key}=${value} n=5`)
  result.samples.push(...evaluate('__kuukiPerf.samples')); evaluate('__kuukiPerf.samples = []'); save()
}

evaluate(`(async () => {
  const { wait, ready, sample, input, button, frames } = __kuukiBench;
  const reset = async () => { const a = [...document.querySelectorAll('.journal-filters a')].find(a => a.textContent === 'Reset filters'); if (a) { a.click(); await wait(() => !location.search && ready('journal', ${count})); await frames(); } };
  for (let i = 0; i < 5; i++) {
    await reset();
    const fields = { year: '2025', airline: 'TK', origin: 'TBS', destination: 'IST' };
    const total = (await (await fetch('/api/flights?limit=20&' + new URLSearchParams(fields))).json()).total;
    await sample('journal:combined', () => { for (const [key, value] of Object.entries(fields)) input(document.querySelector('.journal-filters-desktop [data-filter="' + key + '"]'), value); document.querySelector('form[role="search"]').requestSubmit(); },
      () => Object.entries(fields).every(([k, v]) => new URLSearchParams(location.search).get(k) === v) && ready('journal', total), () => document.querySelector('[data-filter="year"]').value === '2025');
    await sample('journal:reset', () => [...document.querySelectorAll('.journal-filters a')].find(a => a.textContent === 'Reset filters').click(), () => !location.search && ready('journal', ${count}));
    await sample('journal:rapid', () => { for (const year of ['2023', '2024', '2025']) { input(document.querySelector('.journal-filters-desktop [data-filter="year"]'), year); document.querySelector('form[role="search"]').requestSubmit(); } },
      () => new URLSearchParams(location.search).get('year') === '2025' && ready('journal', ${Math.floor(count / 7) + (count % 7 > 5 ? 1 : 0)}), () => document.querySelector('[data-filter="year"]').value === '2025');
    await new Promise(r => setTimeout(r, 200));
    if (new URLSearchParams(location.search).get('year') !== '2025') throw Error('stale rapid result');
  }
  await reset();
  for (const label of ['Origin', 'Destination', 'Airline', 'Aircraft', 'Duration', 'Distance', 'Date']) for (let i = 0; i < 5; i++) {
    const node = [...document.querySelectorAll('.journal-sort-headers button')].find(b => (b.getAttribute('aria-label') ?? b.textContent).startsWith(label));
    if (!node) throw Error('missing sort ' + label);
    const previous = node.getAttribute('aria-label');
    await sample('journal:sort-' + label, () => node.click(), () => node.getAttribute('aria-label') !== previous);
    const expected = await (await fetch('/api/flights?limit=20&' + new URLSearchParams(location.search))).json();
    if ([...document.querySelectorAll('[data-flight-row]')].map(r => Number(r.dataset.flightRow)).sort((a,b) => a-b).join() !== expected.flights.map(r => r.id).sort((a,b) => a-b).join()) throw Error('wrong sort rows');
  }
  return true;
})()`)
result.samples.push(...evaluate('__kuukiPerf.samples')); evaluate('__kuukiPerf.samples = []'); save()

for (let iteration = 0; iteration < 5; iteration++) {
  evaluate(`(async () => {
    const { wait, ready, sample, frames } = __kuukiBench;
    for (const route of ['passport', 'overview', 'journal']) {
      const link = [...document.querySelectorAll('nav a[href="/' + route + '"]')].find(a => a.getBoundingClientRect().width);
      await sample('navigation:' + location.pathname + '→' + route, () => link.click(), () => location.pathname === '/' + route && ready(route, ${count}), () => location.pathname === '/' + route);
    }
    await sample('history:back', () => history.back(), () => location.pathname === '/overview' && ready('overview', ${count}));
    await sample('history:forward', () => history.forward(), () => location.pathname === '/journal' && ready('journal', ${count}));
    return true;
  })()`)
}
result.samples.push(...evaluate('__kuukiPerf.samples')); save()
browser(['open', `${origin}/overview`])
evaluate(`(async () => {
  const { wait, ready, sample } = __kuukiBench;
  const yearButton = year => document.querySelector('.ov3-years button[aria-label^="' + year + ' ·"]');
  const selected = year => yearButton(year)?.getAttribute('aria-pressed') === 'true';
  const reset = () => document.querySelector('[data-filter-chip="period"] .ui-chip-remove').click();
  const allTime = () => !document.querySelector('[data-filter-chip="period"]') && ready('overview', ${count});
  await wait(allTime);
  for (let i = 0; i < 5; i++) {
    await sample('overview:year', () => yearButton('2025').click(), () => ready('overview', ${Math.floor(count / 7) + (count % 7 > 5 ? 1 : 0)}) && selected('2025'), () => selected('2025'));
    await sample('overview:reset', reset, allTime, () => !document.querySelector('[data-filter-chip="period"]'));
  }
  for (const year of ['2026', '2024', '2023', '2022', '2021', '2020']) for (let i = 0; i < 3; i++) {
    if (document.querySelector('[data-filter-chip="period"]')) reset();
    await wait(allTime);
    const total = Math.floor(${count} / 7) + (${count} % 7 > Number(year) - 2020 ? 1 : 0);
    await sample('overview:year-' + year, () => yearButton(year).click(), () => ready('overview', total) && selected(year), () => selected(year));
  }
  reset(); await wait(allTime);
  for (let i = 0; i < 5; i++) {
    await sample('overview:rapid', () => { for (const year of ['2023', '2024', '2025']) yearButton(year).click(); },
      () => ready('overview', ${Math.floor(count / 7) + (count % 7 > 5 ? 1 : 0)}) && selected('2025'));
    await new Promise(r => setTimeout(r, 200));
    if (!selected('2025') || document.querySelector('[data-filter-chip="period"] .ui-chip-label')?.textContent !== 'Period · 2025') throw Error('stale overview period');
    reset(); await wait(allTime);
  }
  return true;
})()`)
result.samples.push(...evaluate('__kuukiPerf.samples')); save()
browser(['profiler', 'stop', `/tmp/kuuki-perf-${phase}-${count}-trace.json`])
browser(['network', 'har', 'stop', `/tmp/kuuki-perf-${phase}-${count}.har`])
console.log(`Saved ${out}/${phase}-${count}.json (${result.loads.length} loads, ${result.samples.length} interactions)`)
