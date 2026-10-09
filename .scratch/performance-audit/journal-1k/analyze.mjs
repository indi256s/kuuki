import { readFileSync } from 'node:fs'
const med = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const r = v => v == null ? null : +v.toFixed(1)
for (const f of process.argv.slice(2)) {
  const runs = JSON.parse(readFileSync(f, 'utf8'))
  const rows = runs.map(({ data: d, console: c }) => {
    const upto = d.longtasks.filter(t => t.start < d.idleAt)
    const pre = d.longtasks.filter(t => t.start < d.hydratedAt + 1)
    const s = d.steps
    return {
      ttfb: d.nav.ttfb, fcp: d.fcp, lcp: d.lcp, cls: d.cls, dcl: d.nav.dcl, load: d.nav.load, hydrated: d.hydratedAt,
      sortFeedback: s.distanceSort.condMs, sortPaint: s.distanceSort.paintMs, sortRowsReordered: d.probe.rowsReorderedMs,
      tti: d.hydratedAt + s.distanceSort.condMs, ttiPaint: d.hydratedAt + s.distanceSort.paintMs,
      ltMsToIdle: upto.reduce((a, t) => a + t.duration, 0), ltCountToIdle: upto.length, ltMax: Math.max(...upto.map(t => t.duration)),
      ltMsBeforeHydrated: pre.reduce((a, t) => a + t.duration, 0),
      idleAt: d.idleAt,
      dur1: s.durationSort1.condMs, dur1p: s.durationSort1.paintMs, dur2: s.durationSort2.condMs, dur2p: s.durationSort2.paintMs,
      tk: s.searchTK.condMs, tkp: s.searchTK.paintMs, tkRows: `${s.searchTK.rowsBefore}->${s.searchTK.rowsAfter}/${s.searchTK.rowsSettled}`,
      clear: s.searchClear.condMs, clearp: s.searchClear.paintMs,
      domNodes: d.domNodes, heapMB: d.heapMB,
      htmlTransfer: d.nav.transfer, htmlEncoded: d.nav.encoded, htmlDecoded: d.nav.decoded,
      jsTransfer: d.resources.filter(x => /\.js$/.test(x.path)).reduce((a, x) => a + x.bytes, 0),
      jsRequests: d.resources.filter(x => /\.js$/.test(x.path)).length,
      consoleCount: c.length, err: d.error,
    }
  })
  console.log('==', f)
  const keys = Object.keys(rows[0])
  const out = {}
  for (const k of keys) {
    const vals = rows.map(x => x[k])
    out[k] = typeof vals[0] === 'number' ? { runs: vals.map(r), median: r(med(vals)) } : vals
  }
  console.log(JSON.stringify(out))
  console.log('shifts', JSON.stringify(runs.map(x => x.data.shifts)))
  console.log('console', JSON.stringify([...new Set(runs.flatMap(x => x.console.map(m => m.type + ': ' + m.text.slice(0, 120))))]))
}
