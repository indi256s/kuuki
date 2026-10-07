import { useMemo, useState } from 'react'
import { defineChart, dot, text, ruleY, arrow, link, lineY, areaY, rect } from '@tanstack/charts'
import { linearRegressionY } from '@tanstack/charts/regression'
import { polar, radialBarRadius, radialArc, radialText } from '@tanstack/charts/polar'
import { d3Curve } from '@tanstack/charts/d3/shape'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { scaleBand } from '@tanstack/charts/scales/band'
import { tooltip } from '@tanstack/charts/tooltip'
import { decorative } from '@tanstack/charts/mark/decorative'
import { brushX, type BrushRange } from '@tanstack/charts/interaction/brush'
import { controlledSignal } from '@tanstack/charts/interaction/signal'
import { Chart } from '@tanstack/charts/react/tooltip'
import { scaleUtc } from 'd3-scale'
import { curveStepAfter, curveBumpX } from 'd3-shape'
import { C, nf, hm, rows, totalKm, fmtDate, fit, type Row } from './data'

const K = { m1: 'var(--kc-mark-1)', m2: 'var(--kc-mark-2)', m3: 'var(--kc-mark-3)', m4: 'var(--kc-mark-4)', ghost: 'var(--kc-ghost)', hair: 'var(--kc-hair)', text: 'var(--kc-text)', muted: 'var(--kc-muted)', success: 'var(--kc-success)' }

// presentation-only marks must not own pointer/keyboard targets (text anchors otherwise steal focus)
const dec = (f: any) => (...a: any[]) => decorative(f(...a))
const D: any = { dot: dec(dot), text: dec(text), ruleY: dec(ruleY), link: dec(link), areaY: dec(areaY), linearRegressionY: dec(linearRegressionY), radialText: dec(radialText), radialArc: dec(radialArc) }
const axisLine = { stroke: K.hair, strokeOpacity: 1, strokeWidth: 1 }
const tickLabels = { fontSize: 12, opacity: 1 }
const gridLine = { stroke: K.hair, strokeOpacity: 0.6, strokeWidth: 1 }
const theme = { foreground: K.text, muted: K.muted, grid: K.hair, background: 'transparent' }
const tip = (extra: object = {}) => ({ use: tooltip, offset: 10, placement: ['right', 'left', 'top', 'bottom'], ...extra }) as any
const log = (id: string) => (p: any) => console.log(`[select ${id}]`, p ? p.datum : null)

// registry used by the capture script: scene points + interaction controller per chart id
const reg: Record<string, any> = ((window as any).__ts = {})
const onRender = (id: string) => (ctx: any) => { reg[id] = ctx }

function Kv({ items }: { items: [string, string][] }) {
  return <dl className="tt-grid">{items.flatMap(([k, v]) => [<dt key={k}>{k}</dt>, <dd key={k + 'v'}>{v}</dd>])}</dl>
}
const Body = ({ route, sub, items, note }: { route: string; sub?: string; items?: [string, string][]; note?: React.ReactNode }) => (
  <div>
    <div className="tt-route">{route}</div>
    {sub ? <div className="tt-sub">{sub}</div> : null}
    {items ? <Kv items={items} /> : null}
    {note}
  </div>
)

const hrAxis = (v: number) => (v === 0 ? '0' : v + 'h')
const yrTick = (d: Date) => `'${String(d.getUTCFullYear()).slice(2)}`

// ============================================================ 1 records scatter
const longest = rows.reduce((a, b) => (b.blockMinutes > a.blockMinutes ? b : a))
function scatterDef(m: boolean, b = false) {
  const out = (k: string) => rows.filter((r) => r.outlier === k)
  const L: any[] = [{ x: longest.distanceKm, y: longest.hours, t: `${longest.from}→${longest.to}${m ? '' : ' ' + hm(longest.blockMinutes)}`, anchor: 'end', dx: b ? -26 : -10, dy: m ? -9 : b ? -10 : 0 }]
  const leaders: any[] = []
  if (b) {
    // bento: one supporting label only; the rest live in the tooltip
    const tw = out('tailwind').reduce((a, c) => (c.distanceKm > a.distanceKm ? c : a))
    L.push({ x: tw.distanceKm, y: tw.hours, t: `tailwind · ${tw.route}`, anchor: 'start', dx: 8 })
  } else if (!m) {
    for (const r of out('tailwind')) L.push({ x: r.distanceKm, y: r.hours, t: `tailwind · ${r.route}`, anchor: 'start', dx: 8 })
    for (const r of out('diversion')) L.push({ x: r.distanceKm, y: r.hours, t: `diversion · ${r.route}`, anchor: b ? 'start' : 'end', dx: b ? 8 : -8, dy: b ? 15 : 0 })
    for (const r of out('holding')) {
      const ax = r.distanceKm + 300, ay = r.hours + 1.7
      L.push({ x: ax, y: ay, t: `holding · ${r.route}`, anchor: 'start', dx: 6 })
      leaders.push({ x1: r.distanceKm, y1: r.hours, x2: ax, y2: ay })
    }
  }
  const xTicks = m ? [0, 7500, 15000] : b ? [0, 5000, 10000, 15000] : [0, 3000, 6000, 9000, 12000, 15000]
  const yTicks = m ? [0, 8, 16] : [0, 4, 8, 12, 16]
  return defineChart({
    marks: [
      D.linearRegressionY(rows, { x: 'distanceKm', y: 'hours', ci: 0, stroke: K.m1, strokeWidth: 1.5 }),
      dot(rows, { x: 'distanceKm', y: 'hours', r: 4, fill: K.m2, fillOpacity: 1 }),
      dot([longest], { x: 'distanceKm', y: 'hours', r: 4, fill: K.m1 }),
      D.dot([longest], { x: 'distanceKm', y: 'hours', r: 7.5, fill: 'none', stroke: K.m1, strokeWidth: 2 }),
      D.link(leaders, { x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', stroke: K.hair, strokeOpacity: 1, strokeWidth: 1 }),
      D.text(L, { x: 'x', y: 'y', text: 't', fontSize: 12, fill: K.text, anchor: (d: any) => d.anchor, dx: (d: any) => d.dx, dy: (d: any) => d.dy ?? 0 }),
    ],
    scales: {
      x: { scale: scaleLinear().domain([0, 15000]), axis: { line: axisLine, ticks: { values: xTicks, size: 4, format: (v: number) => (v === 15000 ? '15,000 km' : nf.format(v)) }, tickLabels } },
      y: { scale: scaleLinear().domain([0, 17]), grid: gridLine, axis: { line: false, ticks: { values: yTicks, size: 0, format: hrAxis }, tickLabels } },
    },
    margin: m ? { top: 10, right: 40, bottom: 28, left: 32 } : { top: 12, right: 40, bottom: 30, left: 34 },
    theme,
    tooltip: tip({ placement: m ? ['right', 'left', 'bottom', 'top'] : ['top', 'right', 'left', 'bottom'] }),
  } as any)
}
const desktopScatter = scatterDef(false)
const mobileScatter = scatterDef(true)
const bentoScatter = scatterDef(false, true)

function ScatterBody({ r, pinned, dismiss, mobile }: { r: Row; pinned: boolean; dismiss: () => void; mobile: boolean }) {
  const diff = Math.round((fit.at(r.distanceKm) - r.hours) * 60) // + = faster than the line
  const note = (
    <div className="tt-note" style={diff < 0 ? { color: K.m1 } : { color: K.success }}>
      {diff >= 0 ? '↓' : '↑'} {hm(Math.abs(diff))} {diff >= 0 ? 'faster' : 'slower'} than your line
    </div>
  )
  return (
    <div style={{ minWidth: mobile ? 0 : 190 }}>
      <Body route={r.route} sub={fmtDate(r.d)} items={[['Distance', `${nf.format(r.distanceKm)} km`], ['Block time', hm(r.blockMinutes)], ['Airline', `${r.airline} · ${r.family}`]]} note={note} />
      {mobile && pinned ? (
        <div className="tt-actions">
          <button type="button" className="sec" onClick={() => console.log('add filter', r.route)}>Add filter</button>
          <button type="button" className="pri" onClick={() => { console.log('open flight', r.route); dismiss() }}>Open flight</button>
        </div>
      ) : null}
    </div>
  )
}
export function RecordsScatter({ mobile, size }: { mobile: boolean; size?: 'bento' }) {
  const bento = size === 'bento'
  const id = (bento ? 'b-' : mobile ? 'm-' : 'd-') + 'records-scatter'
  const W = bento ? 576 : mobile ? 358 : 1200, H = bento ? 232 : mobile ? 240 : 280
  return (
    <div id={id} className="kc" style={{ width: W, height: H }}>
      <Chart
        definition={bento ? bentoScatter : mobile ? mobileScatter : desktopScatter}
        width={W}
        height={H}
        ariaLabel="Distance versus block time, 69 flights"
        onSelect={log(id)}
        onRender={onRender(id)}
        renderTooltipBody={({ points, pinned, dismiss }) => {
          const fp = points.find((p) => (p.datum as any).route)
          if (!fp) return <Body route="Your line" sub="Least-squares fit of block time on distance" items={[['Pace', `${(fit.slope * 1000).toFixed(2)} h per 1,000 km`], ['Overhead', hm(fit.intercept * 60)]]} />
          return <ScatterBody r={fp.datum as Row} pinned={pinned} dismiss={dismiss} mobile={mobile} />
        }}
      />
    </div>
  )
}

// ============================================================ 1b records progression (replaces the scatter on bento)
const recs: (Row & { prev: number })[] = (() => {
  let best = 0
  const out: (Row & { prev: number })[] = []
  for (const r of rows.slice().sort((a, b) => a.date.localeCompare(b.date))) if (r.distanceKm > best) { out.push({ ...r, prev: best }); best = r.distanceKm }
  return out
})()
const recLabels = new Set(['JFK→LHR', 'DOH→NRT', 'DOH→AKL'])
function progressDef() {
  const today = new Date(Date.UTC(2026, 9, 7))
  const steps = [...recs.map((r) => ({ d: r.d, km: r.distanceKm })), { d: today, km: recs[recs.length - 1].distanceKm }]
  const last = recs[recs.length - 1]
  const yrs = [2014, 2018, 2022, 2026].map((y) => new Date(Date.UTC(y, 0, 1)))
  return defineChart({
    marks: [
      D.dot(rows, { x: 'd', y: 'distanceKm', r: 2.5, fill: K.ghost, fillOpacity: 0.45 }),
      lineY(steps, { x: 'd', y: 'km', stroke: K.m1, strokeWidth: 2, curve: d3Curve(curveStepAfter as any) }),
      dot(recs, { x: 'd', y: 'distanceKm', r: 4, fill: K.m1 }),
      D.dot([last], { x: 'd', y: 'distanceKm', r: 7.5, fill: 'none', stroke: K.m1, strokeWidth: 2 }),
      D.text(recs.filter((r) => recLabels.has(r.route)), { x: 'd', y: 'distanceKm', text: (r: any) => r === last ? `${r.route} · ${nf.format(r.distanceKm)} km` : r.route, fontSize: 12, fill: K.text, anchor: (r: any) => (r.route === 'DOH→NRT' ? 'end' : 'start'), dx: (r: any) => (r === last ? 14 : r.route === 'DOH→NRT' ? -8 : 8), dy: -10 }),
    ],
    scales: {
      x: { scale: scaleUtc().domain([new Date(Date.UTC(2014, 0, 1)), today]), axis: { line: axisLine, ticks: { values: yrs, size: 4, format: yrTick }, tickLabels } },
      y: { scale: scaleLinear().domain([0, 16500]), grid: gridLine, axis: { line: false, ticks: { values: [0, 5000, 10000, 15000], size: 0, format: (v: number) => (v === 0 ? '0' : v === 15000 ? '15k km' : v / 1000 + 'k') }, tickLabels } },
    },
    margin: { top: 16, right: 20, bottom: 30, left: 56 },
    theme,
    tooltip: tip({ placement: ['top', 'right', 'left', 'bottom'] }),
  } as any)
}
const bentoProgress = progressDef()
export function RecordsProgress() {
  const id = 'b-records-progress'
  return (
    <div id={id} className="kc" style={{ width: 576, height: 232 }}>
      <Chart
        definition={bentoProgress}
        width={576}
        height={232}
        ariaLabel={`Longest-flight record over time, ${recs.length} records`}
        onSelect={log(id)}
        onRender={onRender(id)}
        renderTooltipBody={({ points }) => {
          const r: any = points[0].datum
          return <Body route={r.route} sub={fmtDate(r.d)} items={[['Distance', `${nf.format(r.distanceKm)} km`], ...(r.prev ? [['Beat the record by', `${nf.format(r.distanceKm - r.prev)} km`] as [string, string]] : [])]} />
        }}
      />
    </div>
  )
}

// ============================================================ 2 jet-lag ledger
const ev = rows.filter((r) => r.toUtcOffset > r.fromUtcOffset), wv = rows.filter((r) => r.toUtcOffset < r.fromUtcOffset), same = rows.filter((r) => r.toUtcOffset === r.fromUtcOffset)
function jetlagDef(m: boolean, b = false) {
  const yrs = (m || b ? [2014, 2018, 2022, 2026] : [2014, 2016, 2018, 2020, 2022, 2024, 2026]).map((y) => new Date(Date.UTC(y, 0, 1)))
  const offFmt = (v: number) => (v === 0 ? '0h' : v > 0 ? `+${v}h` : `−${-v}h`)
  const ao = (stroke: string) => ({ x1: 'd', x2: 'd', y1: 'fromUtcOffset', y2: 'toUtcOffset', stroke, strokeWidth: 1.5, headLength: 5, headAngle: 30 })
  return defineChart({
    marks: [
      D.ruleY([4], { stroke: K.hair, strokeOpacity: 1, strokeWidth: 1, strokeDasharray: '4 4' }),
      dot(same, { x: 'd', y: 'fromUtcOffset', r: 2.5, fill: K.ghost }),
      arrow(wv, ao(K.m2) as any),
      arrow(ev, ao(K.m1) as any),
      D.text([{ d: new Date(Date.UTC(2014, 8, 1)), y: 4, t: 'home +4' }], { x: 'd', y: 'y', text: 't', fontSize: 13, fill: K.muted, anchor: 'start', dy: -10 }),
    ],
    scales: {
      x: { scale: scaleUtc().domain([new Date(Date.UTC(2014, 0, 1)), new Date(Date.UTC(2026, 11, 31))]), axis: { line: axisLine, ticks: { values: yrs, size: 4, format: yrTick }, tickLabels } },
      y: { scale: scaleLinear().domain([-6, 14]), axis: { line: false, ticks: { values: [-4, 0, 4, 8, 12], size: 0, format: offFmt }, tickLabels } },
    },
    margin: m ? { top: 10, right: 12, bottom: 28, left: 40 } : { top: 10, right: 20, bottom: 28, left: 44 },
    theme,
    tooltip: tip({ placement: ['right', 'left', 'bottom', 'top'] }),
  } as any)
}
const desktopJet = jetlagDef(false)
const mobileJet = jetlagDef(true)
const bentoJet = jetlagDef(false, true)
export const tallest = ev.reduce((a, b) => (b.toUtcOffset - b.fromUtcOffset > a.toUtcOffset - a.fromUtcOffset ? b : a))
// bento: clock shift per year as diverging bars (forward above zero, back below) — replaces the per-flight arrows
const shiftYears = Array.from({ length: 13 }, (_, i) => 2014 + i).map((y, i) => {
  const rs = rows.filter((r) => r.d.getUTCFullYear() === y)
  const fwd = rs.reduce((s, r) => s + Math.max(0, r.toUtcOffset - r.fromUtcOffset), 0)
  const back = rs.reduce((s, r) => s + Math.max(0, r.fromUtcOffset - r.toUtcOffset), 0)
  return { i, y, fwd, back, n: rs.length, x1: i + 0.18, x2: i + 0.82, xm: i + 0.5, lo: -back, zero: 0 }
})
export const clockShiftTotal = shiftYears.reduce((s, d) => s + d.fwd + d.back, 0)
const shiftDef = defineChart({
  marks: [
    D.ruleY([0], { stroke: K.hair, strokeOpacity: 1, strokeWidth: 1 }),
    rect(shiftYears.filter((d) => d.fwd), { x1: 'x1', x2: 'x2', y1: 'zero', y2: 'fwd', fill: K.m1, radius: 3 } as any),
    rect(shiftYears.filter((d) => d.back), { x1: 'x1', x2: 'x2', y1: 'lo', y2: 'zero', fill: K.m2, radius: 3 } as any),
    D.text(shiftYears.filter((d) => d.fwd), { x: 'xm', y: 'fwd', text: (d: any) => `+${d.fwd}`, fontSize: 11, fill: K.muted, anchor: 'middle', dy: -8 }),
    D.text(shiftYears.filter((d) => d.back), { x: 'xm', y: 'lo', text: (d: any) => `−${d.back}`, fontSize: 11, fill: K.muted, anchor: 'middle', dy: 12 }),
    D.text(shiftYears.filter((d) => !d.n), { x: 'xm', y: 'zero', text: () => '–', fontSize: 11, fill: K.ghost, anchor: 'middle', dy: -6 }),
  ],
  scales: {
    x: { scale: scaleLinear().domain([0, 13]), axis: { line: false, ticks: { values: shiftYears.map((d) => d.i + 0.5), size: 0, format: (v: number) => `'${String(2014 + Math.floor(v)).slice(2)}` }, tickLabels } },
    y: { scale: scaleLinear().domain([-14.5, 15.5]), axis: false },
  },
  margin: { top: 6, right: 4, bottom: 24, left: 4 },
  theme,
  tooltip: tip({ placement: ['top', 'bottom', 'right', 'left'] }),
} as any)
export function CrossingsShift() {
  const id = 'b-crossings-shift'
  return (
    <div id={id} className="kc" style={{ width: 552, height: 168 }}>
      <Chart definition={shiftDef} width={552} height={168} ariaLabel="Hours of clock change per year, forward and back" onSelect={log(id)} onRender={onRender(id)}
        renderTooltipBody={({ points }) => { const d: any = points[0].datum; return <Body route={String(d.y)} sub={`${d.n} flights`} items={[['Clocks forward', `${d.fwd} h`], ['Clocks back', `${d.back} h`]]} /> }} />
    </div>
  )
}

export function CrossingsJetlag({ mobile, size }: { mobile: boolean; size?: 'bento' }) {
  const bento = size === 'bento'
  const id = (bento ? 'b-' : mobile ? 'm-' : 'd-') + 'crossings-jetlag'
  const W = bento ? 552 : mobile ? 358 : 1200, H = bento ? 168 : mobile ? 180 : 220
  return (
    <div id={id} className="kc" style={{ width: W, height: H }}>
      <Chart
        definition={bento ? bentoJet : mobile ? mobileJet : desktopJet}
        width={W}
        height={H}
        ariaLabel="Jet-lag ledger, UTC offset crossed per flight"
        onSelect={log(id)}
        onRender={onRender(id)}
        renderTooltipBody={({ points }) => {
          const r = (points.find((p) => (p.datum as any)?.route) ?? points[0]).datum as Row
          if (!r?.route) return <Body route="Home" sub="UTC+4" />
          const dlt = r.toUtcOffset - r.fromUtcOffset
          return (
            <Body
              route={r.route}
              sub={fmtDate(r.d)}
              items={[['Shift', `${dlt > 0 ? '+' : '−'}${Math.abs(dlt)}h`], ['Direction', dlt > 0 ? 'clocks forward' : dlt < 0 ? 'clocks back' : 'same zone'], ['Offsets', `UTC${r.fromUtcOffset >= 0 ? '+' : '−'}${Math.abs(r.fromUtcOffset)} → UTC${r.toUtcOffset >= 0 ? '+' : '−'}${Math.abs(r.toUtcOffset)}`]]}
            />
          )
        }}
      />
    </div>
  )
}

// ============================================================ 3 fleet waffle
const famOf = (r: Row) => (r.family === 'A320' ? 'A320 family' : r.family === '737' ? '737' : r.family === 'A350' ? 'A350' : r.family === '777' ? '777' : r.family === 'unknown' ? 'Unknown' : 'Other')
const order = ['A320 family', '737', 'A350', '777', 'Other', 'Unknown']
const mk = ['Airbus', 'Boeing', 'Embraer/ATR', 'unknown']
// maker = shape + color: Airbus filled square, Boeing filled circle, Embraer/ATR outlined square, unknown dashed outline
const mstyle = (m: string): any => (m === 'Airbus' ? { fill: K.m1 } : m === 'Embraer/ATR' ? { fill: 'none', stroke: K.m3, strokeWidth: 1.5, inset: 0.75 } : { fill: 'none', stroke: K.ghost, strokeWidth: 1.25, strokeDasharray: '3 2.5', inset: 0.625 })
function waffleDef(m: boolean, b = false) {
  // bento: 552 wide; label gutter 104, count gutter 44, cells shrink so the longest family fits one row
  const BW = 552, BL = 104, BR = 44, BWF = BW - BL - BR
  const maxFam = Math.max(...order.map((fam) => rows.filter((r) => famOf(r) === fam).length))
  const bstep = Math.floor(BWF / maxFam)
  // bento wraps long families onto a second line so squares can be 18px instead of 11px
  const sq = b ? 20 : m ? 14 : 16, step = b ? 25 : 20, perRow = m ? 12 : b ? Math.floor((BWF + 5) / 25) : 999
  void bstep
  const cells: any[] = [], labels: any[] = [], counts: any[] = []
  let y = m ? 0 : 6
  const pitch = b ? 26 : 28
  order.forEach((fam, ri) => {
    const rs = rows.filter((r) => famOf(r) === fam).sort((a, b) => mk.indexOf(a.maker) - mk.indexOf(b.maker))
    if (m) {
      labels.push({ x: 0, y: y + 8, t: fam, anchor: 'start' })
      counts.push({ x: 358, y: y + 8, t: String(rs.length) })
      y += 20
      rs.forEach((r, i) => cells.push({ ...r, x1: (i % perRow) * step, x2: (i % perRow) * step + sq, y1: y + Math.floor(i / perRow) * step, y2: y + Math.floor(i / perRow) * step + sq, cx: (i % perRow) * step + sq / 2, cy: y + Math.floor(i / perRow) * step + sq / 2 }))
      y += Math.ceil(rs.length / perRow) * step - (step - sq) + 16
    } else if (b) {
      labels.push({ x: -(BL - 8), y: y + sq / 2, t: fam, anchor: 'start' })
      counts.push({ x: BWF + 36, y: y + sq / 2, t: String(rs.length) })
      rs.forEach((r, i) => { const cx0 = (i % perRow) * step, cy0 = y + Math.floor(i / perRow) * step; cells.push({ ...r, x1: cx0, x2: cx0 + sq, y1: cy0, y2: cy0 + sq, cx: cx0 + sq / 2, cy: cy0 + sq / 2 }) })
      y += Math.ceil(rs.length / perRow) * step - (step - sq) + 16
    } else {
      const yy = ri * pitch + (b ? 5 : 6)
      labels.push({ x: b ? -(BL - 8) : -140, y: yy + sq / 2, t: fam, anchor: 'start' })
      counts.push({ x: b ? BWF + 36 : 996 + 46, y: yy + sq / 2, t: String(rs.length) })
      rs.forEach((r, i) => cells.push({ ...r, x1: i * step, x2: i * step + sq, y1: yy, y2: yy + sq, cx: i * step + sq / 2, cy: yy + sq / 2 }))
    }
  })
  const H = m ? Math.ceil(y - 16) + 8 : b ? y - 16 + 6 : pitch * order.length
  const W = m ? 358 : b ? BWF : 996
  // rect has no circular radius, so Boeing uses the dot mark at the same cell centers (diameter = box size)
  const sqMarks = mk.map((mm) => mm === 'Boeing'
    ? dot(cells.filter((c) => c.maker === mm), { x: 'cx', y: 'cy', r: sq / 2, fill: K.m2 } as any)
    : rect(cells.filter((c) => c.maker === mm), { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', radius: 3, ...mstyle(mm) } as any))
  const height = m ? H : b ? H + 8 : 180
  const def = defineChart({
    marks: [
      ...sqMarks,
      D.text(labels, { x: 'x', y: 'y', text: 't', fontSize: 13, fill: K.text, anchor: 'start' }),
      D.text(counts, { x: 'x', y: 'y', text: 't', fontSize: 12, fill: K.muted, anchor: 'end' }),
    ],
    scales: {
      x: { scale: scaleLinear().domain([0, W]), axis: false },
      y: { scale: scaleLinear().domain([H, 0]), axis: false },
    },
    margin: m ? { top: 0, right: 0, bottom: 0, left: 0 } : b ? { top: 4, right: BR, bottom: height - 4 - H, left: BL } : { top: 10, right: 1200 - 148 - W, bottom: 180 - 10 - H, left: 148 },
    theme,
    tooltip: tip({ placement: m ? ['bottom', 'top'] : ['top', 'right', 'left', 'bottom'] }),
  } as any)
  return { def, height }
}
const desktopWaffle = waffleDef(false)
const mobileWaffle = waffleDef(true)
const bentoWaffle = waffleDef(false, true)
export function FleetWaffle({ mobile, size }: { mobile: boolean; size?: 'bento' }) {
  const bento = size === 'bento'
  const id = (bento ? 'b-' : mobile ? 'm-' : 'd-') + 'fleet-waffle'
  const w = bento ? bentoWaffle : mobile ? mobileWaffle : desktopWaffle
  const W = bento ? 552 : mobile ? 358 : 1200
  return (
    <div id={id} className="kc" style={{ width: W, height: w.height }}>
      <Chart
        definition={w.def}
        width={W}
        height={w.height}
        ariaLabel="Fleet by aircraft family and maker"
        onSelect={log(id)}
        onRender={onRender(id)}
        renderTooltipBody={({ points }) => {
          const r = points[0].datum as Row
          return (
            <Body
              route={r.flightNumber ? `${r.flightNumber} · ${r.route}` : r.route}
              sub={fmtDate(r.d)}
              items={[['Airline', r.airline], ['Type', r.family === 'unknown' ? 'unknown' : r.family], ['Maker', r.maker === 'unknown' ? 'unknown' : r.maker]]}
            />
          )
        }}
      />
    </div>
  )
}

// ============================================================ 4 clock radial
const counts = new Array(24).fill(0)
rows.forEach((r) => counts[r.depLocalHour]++)
const hrs = counts.map((n, h) => ({ h: String(h).padStart(2, '0'), hn: h, n }))
const peak = counts.indexOf(Math.max(...counts))
const maxN = Math.max(...counts)
const TAU = Math.PI * 2
function clockDef(m: boolean, b = false) {
  const s = b ? 200 / 380 : m ? 300 / 380 : 1
  const night = [{ startAngle: (22 / 24) * TAU, endAngle: TAU + (6 / 24) * TAU }]
  return defineChart({
    marks: [
      polar({
        inset: m || b ? 24 : 29,
        scales: {
          angle: { scale: () => scaleBand<string>().padding(0.14).domain(hrs.map((d) => d.h)) },
          radius: { scale: scaleLinear().domain([0, maxN]), range: [Math.round(70 * s), ({ radius }: any) => radius] },
          clock: { channel: 'angle', scale: scaleLinear().domain([0, 24]) },
          c: { channel: 'radius', scale: scaleLinear().domain([0, 1]), range: [0, 1] },
        } as any,
        marks: [
          D.radialArc(night, { innerRadius: Math.round(56 * s), outerRadius: Math.round(63 * s), fill: '#cfcac4', key: () => 'night' } as any),
          radialBarRadius(hrs, { angle: 'h', radius: 'n', radius1: 0, key: 'h', fill: (d: any) => (d.hn === peak ? K.m1 : K.m2), cornerRadius: 1.5 } as any),
          D.radialText([0, 12, 18, 22, 6].map((h) => ({ a: h, t: String(h).padStart(2, '0') })), { angle: 'a', angleScale: 'clock', radius: maxN, radiusOffset: m || b ? 13 : 16, text: 't', fontSize: 12, fill: K.muted, key: 't' } as any),
          D.radialText([{ k: 1, t: String(peak).padStart(2, '0') + ':00' }], { angle: 0, angleScale: 'clock', radius: 0, radiusScale: 'c', text: 't', fontSize: 22, fill: K.text, dy: -4, key: 'k' } as any),
          D.radialText([{ k: 2, t: 'busiest' }], { angle: 0, angleScale: 'clock', radius: 0, radiusScale: 'c', text: 't', fontSize: 13, fill: K.muted, dy: 16, key: 'k' } as any),
        ],
      }),
    ],
    scales: { x: null, y: null },
    theme,
    tooltip: tip({ placement: ['top', 'bottom', 'left', 'right'], offset: 8 }),
  } as any)
}
const desktopClock = clockDef(false)
const mobileClock = clockDef(true)
const bentoClock = clockDef(false, true)
export function ClockRadial({ mobile, size }: { mobile: boolean; size?: 'bento' }) {
  const bento = size === 'bento'
  const id = (bento ? 'b-' : mobile ? 'm-' : 'd-') + 'clock-radial'
  const s = bento ? 200 : mobile ? 300 : 380
  return (
    <div id={id} className="kc" style={{ width: s, height: s }}>
      <Chart
        definition={bento ? bentoClock : mobile ? mobileClock : desktopClock}
        width={s}
        height={s}
        ariaLabel="Departure hour clock"
        onSelect={log(id)}
        onRender={onRender(id)}
        renderTooltipBody={({ points }) => {
          const d: any = points[0].datum
          if (d.n === undefined) return <Body route="Departures" />
          return <div className="tt-route" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{`${d.h}:00–${d.h}:59 · ${d.n} departure${d.n === 1 ? '' : 's'}`}</div>
        }}
      />
    </div>
  )
}

// ============================================================ 5 rhythm odometer
const sorted = rows.slice().sort((a, b) => a.date.localeCompare(b.date))
const pts = (() => {
  let cum = 0
  return [{ d: new Date(Date.UTC(2014, 0, 1)), cum: 0, pad: true, route: '', km: 0 }, ...sorted.map((r) => ({ d: r.d, cum: (cum += r.distanceKm), pad: false, route: r.route, km: r.distanceKm })), { d: new Date(Date.UTC(2026, 9, 1)), cum, pad: true, route: '', km: 0 }]
})()
const months: Date[] = []
for (let y = 2014; y <= 2026; y++) for (let mo = 0; mo < 12; mo++) { const d = new Date(Date.UTC(y, mo, 1)); if (d <= new Date(Date.UTC(2026, 9, 1))) months.push(d) }
months.push(new Date(Date.UTC(2026, 9, 1)))
const monthSet = months.filter((d, i) => months.findIndex((e) => +e === +d) === i)
export const initialRange: BrushRange<Date> = { start: new Date(Date.UTC(2021, 0, 1)), end: new Date(Date.UTC(2024, 0, 1)) }
const kmIn = (a: Date, b: Date) => rows.filter((r) => r.d >= a && r.d < b).reduce((s, r) => s + r.distanceKm, 0)
const mon = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
export const odometerKm = kmIn(initialRange.start, initialRange.end)

export function RhythmOdometer({ mobile, size }: { mobile: boolean; size?: 'bento' }) {
  const bento = size === 'bento'
  const id = (bento ? 'b-' : mobile ? 'm-' : 'd-') + 'rhythm-odometer'
  const W = bento ? 750 : mobile ? 358 : 1200, H = bento ? 140 : mobile ? 150 : 170
  const [range, setRange] = useState<BrushRange<Date>>(initialRange)
  const def = useMemo(() => {
    const a = range.start, b = range.end
    const lastIncl = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() - 1, 1))
    const km = nf.format(kmIn(a, b))
    const label = mobile ? `${a.getUTCFullYear()} – ${lastIncl.getUTCFullYear()} · ${km} km` : `${mon(a)} – ${mon(lastIncl)} · ${km} km`
    const yrs = (mobile || bento ? [2014, 2018, 2022, 2026] : [2014, 2016, 2018, 2020, 2022, 2024, 2026]).map((y) => new Date(Date.UTC(y, 0, 1)))
    const step = d3Curve(curveStepAfter as any)
    return defineChart({
      marks: [
        D.areaY(pts, { x: 'd', y1: 0, y2: 'cum', fill: K.m1, fillOpacity: 0.08, curve: step } as any),
        lineY(pts, { x: 'd', y: 'cum', stroke: K.m1, strokeWidth: 2, curve: step }),
        D.text([{ d: new Date((a.getTime() + b.getTime()) / 2), y: totalKm, t: label }], { x: 'd', y: 'y', text: 't', fontSize: 12, fill: K.text, anchor: 'middle', dy: mobile ? -16 : -13 }),
      ],
      scales: {
        x: { scale: scaleUtc().domain([new Date(Date.UTC(2014, 0, 1)), new Date(Date.UTC(2026, 9, 7))]), axis: { line: axisLine, ticks: { values: yrs, size: 4, format: yrTick }, tickLabels } },
        y: { scale: scaleLinear().domain([0, totalKm]), axis: { line: false, ticks: { values: [0, 50000, 100000], size: 0, format: (v: number) => (v === 0 ? '0' : Math.round(v / 1000) + 'k') }, tickLabels } },
      },
      controls: [
        brushX({
          range: controlledSignal<BrushRange<Date>, any>(range, (next, { reason }: any) => {
            if (reason.type === 'commit') { console.log('[brush commit]', next.start.toISOString().slice(0, 10), next.end.toISOString().slice(0, 10)); setRange(next) }
          }),
          values: monthSet,
          format: (d: Date) => mon(d),
          handleSize: 3,
          selectionStyle: { fill: K.m1, fillOpacity: 0.12, strokeWidth: 0 },
          handleStyle: { fill: K.m1, fillOpacity: 1, strokeWidth: 0 },
          ariaLabel: 'Date range',
          startAriaLabel: 'Range start',
          endAriaLabel: 'Range end',
        } as any),
      ],
      margin: mobile ? { top: 40, right: 14, bottom: 28, left: 38 } : bento ? { top: 28, right: 20, bottom: 28, left: 44 } : { top: 28, right: 28, bottom: 28, left: 44 },
      theme,
      focus: 'nearest-x',
      tooltip: tip({ placement: ['bottom', 'top'] }),
    } as any)
  }, [range, mobile, bento])
  return (
    <div id={id} className="kc kc-odo" style={{ width: W, height: H }}>
      <Chart
        definition={def}
        width={W}
        height={H}
        ariaLabel="Cumulative distance flown, 2014 to 2026"
        onSelect={log(id)}
        onRender={onRender(id)}
        renderTooltipBody={({ points }) => {
          const d: any = points[0].datum
          return <Body route={d.pad ? 'Cumulative' : d.route} sub={fmtDate(d.d)} items={[['Flown so far', `${nf.format(d.cum)} km`]]} />
        }}
      />
    </div>
  )
}

// ============================================================ 6 rankings bump
const five = ['TK', 'QR', 'FZ', 'LH', 'A9']
const names: Record<string, string> = { TK: 'Turkish', QR: 'Qatar', FZ: 'flydubai', LH: 'Lufthansa', A9: 'Georgian' }
const years = [2021, 2022, 2023, 2024, 2025, 2026]
const bumpColors: Record<string, string> = { TK: K.m1, QR: K.m2, FZ: K.m3, LH: K.m4, A9: K.ghost }
const bumpLine: Record<string, any> = {
  TK: { strokeWidth: 2.5 }, QR: { strokeWidth: 2 }, FZ: { strokeWidth: 2, strokeDasharray: '6 4' }, LH: { strokeWidth: 2 },
  A9: { strokeWidth: 2, strokeDasharray: '1 4', strokeLinecap: 'round' },
}
function bumpDef(m: boolean, b = false) {
  const height = b ? 220 : m ? 240 : 260
  const top = 12, bottom = 30
  const PXU = (height - top - bottom) / 5
  const rk: any[] = []
  for (const y of years) {
    const c = five.map((al) => ({ al, n: rows.filter((r) => r.airline === al && r.d.getUTCFullYear() === y).length }))
    const rank = (n: number) => 1 + c.filter((e) => e.n > n).length
    const groups = new Map<number, any[]>()
    for (const e of c) (groups.get(rank(e.n)) ?? groups.set(rank(e.n), []).get(rank(e.n))!).push(e)
    for (const [rkv, g] of groups) {
      g.sort((p, q) => p.al.localeCompare(q.al))
      g.forEach((e, i) => rk.push({ year: String(y), al: e.al, n: e.n, rank: rkv, ty: rkv + ((i - (g.length - 1) / 2) * 12) / PXU, tied: g.length > 1 }))
    }
  }
  const end = rk.filter((r) => r.year === '2026')
  const dim = (ctx: any) => !!ctx.focus.primary && !ctx.matches('series')
  const lineStates = [{ when: dim, style: { strokeOpacity: 0.22 }, transition: { type: 'tween', duration: 0 } }] as any
  const dotStates = [{ when: dim, style: { fillOpacity: 0.22 }, transition: { type: 'tween', duration: 0 } }] as any
  const dimText = [{ when: dim, style: { opacity: 0.35 } }] as any
  return defineChart({
    marks: [
      ...five.map((al) => lineY(rk.filter((r) => r.al === al), { x: 'year', y: 'ty', z: 'al', color: 'al', curve: d3Curve(curveBumpX as any), states: lineStates, ...bumpLine[al] } as any)),
      dot(rk, { x: 'year', y: 'ty', color: 'al', r: 5, stroke: C.bg, strokeWidth: 1.5, states: dotStates } as any),
      D.text(end.map((r) => ({ ...r, t: r.al })), { x: 'year', y: 'ty', text: 't', fontSize: 12, fill: K.text, anchor: 'start', dx: 14, states: dimText } as any),
      ...(m ? [] : [D.text(end.map((r) => ({ ...r, t: names[r.al] })), { x: 'year', y: 'ty', text: 't', fontSize: 13, fill: K.muted, anchor: 'start', dx: 40, states: dimText } as any)]),
    ],
    scales: {
      x: { scale: () => scalePoint<string>().padding(m ? 0.12 : 0.1), axis: { line: axisLine, ticks: { size: 4, format: m ? (v: string) => `'${v.slice(2)}` : undefined }, tickLabels } },
      y: { scale: scaleLinear().domain([0.5, 5.5]), reverse: true, axis: { line: false, ticks: { values: [1, 2, 3, 4, 5], size: 0, format: (v: number) => String(v) }, tickLabels } },
    },
    color: { domain: five, range: five.map((a) => bumpColors[a]) },
    margin: m ? { top, right: 44, bottom, left: 28 } : { top, right: 150, bottom, left: 36 },
    theme,
    tooltip: tip({ placement: ['top', 'bottom', 'right', 'left'] }),
  } as any)
}
const desktopBump = bumpDef(false)
const mobileBump = bumpDef(true)
const bentoBump = bumpDef(false, true)
export function RankingsBump({ mobile, size }: { mobile: boolean; size?: 'bento' }) {
  const bento = size === 'bento'
  const id = (bento ? 'b-' : mobile ? 'm-' : 'd-') + 'rankings-bump'
  const W = bento ? 744 : mobile ? 358 : 1200, H = bento ? 220 : mobile ? 240 : 260
  return (
    <div id={id} className="kc" style={{ width: W, height: H }}>
      <Chart
        definition={bento ? bentoBump : mobile ? mobileBump : desktopBump}
        width={W}
        height={H}
        ariaLabel="Airline rank by year, 2021 to 2026"
        onSelect={log(id)}
        onRender={onRender(id)}
        renderTooltipBody={({ points }) => {
          const d: any = points[0].datum
          return <Body route={`${d.al} · ${names[d.al]}`} sub={d.year} items={[['Rank', `${d.tied ? '=' : ''}${d.rank}`], ['Flights', String(d.n)]]} />
        }}
      />
    </div>
  )
}
