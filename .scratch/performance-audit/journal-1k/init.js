(() => {
  const p = window.__jr = { longtasks: [], lcp: null, cls: 0, fcp: null, events: [], hydratedAt: null, rowsAtHydration: null, probe: null, steps: {} };
  const obs = (type, fn) => { try { new PerformanceObserver(l => l.getEntries().forEach(fn)).observe({ type, buffered: true }); } catch (e) {} };
  obs('longtask', e => p.longtasks.push({ start: e.startTime, duration: e.duration }));
  obs('largest-contentful-paint', e => { p.lcp = e.startTime; });
  p.shifts = [];
  obs('layout-shift', e => { if (!e.hadRecentInput) { p.cls += e.value; p.shifts.push({ at: Math.round(e.startTime), value: +e.value.toFixed(4), nodes: (e.sources || []).slice(0, 3).map(s => (s.node && (s.node.tagName + '.' + String(s.node.className).slice(0, 40) + (s.node.id ? '#' + s.node.id : ''))) || '?') }); } });
  obs('paint', e => { if (e.name === 'first-contentful-paint') p.fcp = e.startTime; });
  const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const hydrated = node => !!node && Object.keys(node).some(k => k.startsWith('__reactProps$'));
  const rows = () => document.querySelectorAll('[data-flight-row]').length;
  const th = label => [...document.querySelectorAll('th[aria-sort]')].find(t => t.querySelector('button')?.textContent.trim() === label);
  const firstRowId = () => document.querySelector('[data-flight-row]')?.getAttribute('data-flight-row');
  const waitFor = (fn, timeout = 40000) => new Promise((resolve, reject) => {
    const t0 = performance.now();
    const tick = () => { let v; try { v = fn(); } catch (e) {} if (v) return resolve(v); if (performance.now() - t0 > timeout) return reject(new Error('timeout ' + fn)); requestAnimationFrame(tick); };
    tick();
  });
  // measure: run action(), time until cond() true (feedback), then two frames later (paint opportunity)
  const measure = async (name, action, cond) => {
    const start = performance.now();
    const lt0 = p.longtasks.length;
    action();
    let condMs = null;
    await new Promise((resolve, reject) => {
      const tick = () => {
        if (cond()) { condMs = performance.now() - start; return resolve(); }
        if (performance.now() - start > 20000) return reject(new Error('measure timeout ' + name));
        // poll at microtask/timer cadence so a long task, not rAF, bounds the result
        setTimeout(tick, 0);
      };
      tick();
    });
    await frames();
    const paintMs = performance.now() - start;
    await sleep(0);
    const tasks = p.longtasks.slice(lt0);
    const row = { name, condMs, paintMs, longTaskCount: tasks.length, longTaskMs: tasks.reduce((a, t) => a + t.duration, 0) };
    p.steps[name] = row;
    return row;
  };
  const setInput = (node, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  };
  p.run = async () => {
    const sortBtn = label => th(label).querySelector('button');
    // 1. hydrated + 1000 rows present
    await waitFor(() => rows() >= 993 && hydrated(sortBtn('Distance, km')) && hydrated(document.querySelector('input[type=search]')));
    p.hydratedAt = performance.now();
    p.rowsAtHydration = rows();
    // 2. TTI probe: click Distance header immediately on hydration
    const dist = th('Distance, km');
    const before = dist.getAttribute('aria-sort');
    const idBefore = firstRowId();
    const probeStart = performance.now();
    const ltBefore = p.longtasks.length;
    p.probe = await measure('distanceSort', () => sortBtn('Distance, km').click(), () => dist.getAttribute('aria-sort') !== before);
    p.probe.before = before; p.probe.after = dist.getAttribute('aria-sort');
    p.probe.startAt = probeStart;
    p.probe.rowsReorderedMs = null;
    // order flip visible?
    const t1 = performance.now();
    await waitFor(() => firstRowId() !== idBefore, 10000).then(() => { p.probe.rowsReorderedMs = performance.now() - probeStart; }).catch(() => {});
    // 3. wait idle: 1s with no new longtask (max 20s)
    const idleStart = performance.now();
    while (performance.now() - idleStart < 20000) {
      const last = p.longtasks.length ? p.longtasks[p.longtasks.length - 1] : null;
      const lastEnd = last ? last.start + last.duration : 0;
      if (performance.now() - Math.max(lastEnd, p.hydratedAt) > 1000) break;
      await sleep(100);
    }
    p.idleAt = performance.now();
    const loadTasks = p.longtasks.filter(t => t.start < probeStart);
    p.loadLongTaskCount = loadTasks.length;
    p.loadLongTaskMs = loadTasks.reduce((a, t) => a + t.duration, 0);
    p.loadMaxLongTaskMs = Math.max(0, ...loadTasks.map(t => t.duration));
    p.allLongTaskMs = p.longtasks.reduce((a, t) => a + t.duration, 0);
    p.allLongTaskCount = p.longtasks.length;
    p.rowCountFull = rows();
    // 4. Duration sort toggle x2 on full list
    const dur = th('Duration');
    for (const name of ['durationSort1', 'durationSort2']) {
      const b = dur.getAttribute('aria-sort');
      await measure(name, () => sortBtn('Duration').click(), () => dur.getAttribute('aria-sort') !== b);
      p.steps[name].before = b; p.steps[name].after = dur.getAttribute('aria-sort');
      await sleep(500);
    }
    // 5. filter: type TK
    const search = document.querySelector('input[type=search]');
    const n0 = rows();
    await measure('searchTK', () => setInput(search, 'TK'), () => rows() !== n0);
    p.steps.searchTK.rowsBefore = n0; p.steps.searchTK.rowsAfter = rows();
    await sleep(800);
    p.steps.searchTK.rowsSettled = rows();
    // 6. clear filter
    const n1 = rows();
    await measure('searchClear', () => setInput(search, ''), () => rows() !== n1);
    p.steps.searchClear.rowsBefore = n1; p.steps.searchClear.rowsAfter = rows();
    await sleep(500);
    p.done = true;
  };
  p.error = null;
  const start = () => p.run().catch(e => { p.error = String(e && e.message || e); p.done = true; });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
