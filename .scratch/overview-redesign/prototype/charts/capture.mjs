import puppeteer from 'puppeteer-core'
import fs from 'fs'
const only = process.argv[2]
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--hide-scrollbars'] })
const page = await browser.newPage()
await page.setViewport({ width: 1300, height: 5200, deviceScaleFactor: 2 })
page.on('console', (m) => console.log('  [console]', m.text()))
page.on('pageerror', (e) => console.log('  [pageerror]', e.stack.slice(0,700)))
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle0' })
await page.evaluate(() => document.fonts.ready)
await new Promise((r) => setTimeout(r, 800))

const pointOf = (id, pred) => page.evaluate((id, src) => {
  const ctx = window.__ts[id]; const pred = eval(src)
  const p = ctx.scene.points.find((p) => pred(p.datum, p))
  return p ? { x: p.x, y: p.y, n: ctx.scene.points.length } : null
}, id, pred.toString())
const rect = (id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height } }, id)
async function shot(id, out, hover, mode = 'hover', inward = 1) {
  const r = await rect(id)
  await page.mouse.move(2, 2); await new Promise((r) => setTimeout(r, 150))
  if (hover) {
    const p = await pointOf(id, hover)
    if (!p) throw new Error('no point for ' + id)
    if (inward !== 1) { p.x = r.width / 2 + (p.x - r.width / 2) * inward; p.y = r.height / 2 + (p.y - r.height / 2) * inward }
    await page.mouse.move(r.x + p.x + 0.5, r.y + p.y + 0.5, { steps: 6 })
    if (mode === 'click') await page.mouse.click(r.x + p.x + 0.5, r.y + p.y + 0.5)
    await new Promise((r) => setTimeout(r, 1000))
  }
  const r2 = await rect(id)
  const tt = await page.evaluate((id) => { const t = document.querySelector('#' + id + ' .ts-chart-tooltip'); if (!t) return null; const b = t.getBoundingClientRect(); const h = document.getElementById(id).getBoundingClientRect(); return { l: b.left - h.left, t: b.top - h.top, r: b.right - h.left, b: b.bottom - h.top, w: h.width, h: h.height, o: getComputedStyle(t).opacity, v: getComputedStyle(t).visibility, d: getComputedStyle(t).display, a: t.getAnimations().length } }, id)
  console.log(out, JSON.stringify(r2), 'tooltip', JSON.stringify(tt))
  await page.screenshot({ path: out, clip: r2, captureBeyondViewport: false })
  const fv = await page.evaluate(() => (document.activeElement ? document.activeElement.tagName + ' fv=' + document.activeElement.matches(':focus-visible') : 'none'))
  console.log('  active:', fv)
}
const D = '/tmp/kuuki-live/out/desktop/', M = '/tmp/kuuki-live/out/mobile/', B = '/tmp/kuuki-live/out/bento/'
fs.mkdirSync(B, { recursive: true })
const jobs = {
  'd1': () => shot('d-records-scatter', D + 'records-scatter.png', (d) => d.from === 'JFK' && d.to === 'LHR'),
  'd2': () => shot('d-crossings-jetlag', D + 'crossings-jetlag.png', (d) => d.from === 'DOH' && d.to === 'AKL'),
  'd3': () => shot('d-fleet-waffle', D + 'fleet-waffle.png', (d) => d.family === 'A350' && d.flightNumber),
  'd4': () => shot('d-clock-radial', D + 'clock-radial.png', (d) => d.h === '07', 'hover', 0.9),
  'd5': () => shot('d-rhythm-odometer', D + 'rhythm-odometer.png', null),
  'd6': () => shot('d-rankings-bump', D + 'rankings-bump.png', (d) => d.al === 'TK' && d.year === '2024'),
  'b1p': () => shot('b-records-progress', B + 'records-progress.png', null),
  'b1': () => shot('b-records-scatter', B + 'records-scatter.png', null),
  'b2s': () => shot('b-crossings-shift', B + 'crossings-shift.png', null),
  'b2': () => shot('b-crossings-jetlag', B + 'crossings-jetlag.png', (d) => d.from === 'DOH' && d.to === 'AKL'),
  'b3': () => shot('b-fleet-waffle', B + 'fleet-waffle.png', null),
  'b4': () => shot('b-clock-radial', B + 'clock-radial.png', null),
  'b5': () => shot('b-rhythm-odometer', B + 'rhythm-odometer.png', null),
  'b6': () => shot('b-rankings-bump', B + 'rankings-bump.png', (d) => d.al === 'TK' && d.year === '2024'),
  'm1': () => shot('m-records-scatter', M + 'records-scatter.png', (d) => d.from === 'JFK' && d.to === 'LHR', 'click'),
  'm2': () => shot('m-crossings-jetlag', M + 'crossings-jetlag.png', null),
  'm3': () => shot('m-fleet-waffle', M + 'fleet-waffle.png', null),
  'm4': () => shot('m-clock-radial', M + 'clock-radial.png', null),
  'm5': () => shot('m-rhythm-odometer', M + 'rhythm-odometer.png', null),
  'm6': () => shot('m-rankings-bump', M + 'rankings-bump.png', null),
}
for (const k of Object.keys(jobs)) if (!only || only === k) await jobs[k]()
await browser.close()
