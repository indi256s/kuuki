// Inline, offline preview of the exact production yacht builder: lane size, a 64 px phone size and a 4x close-up, in both themes.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { buildYacht, YACHT_CSS } from './yacht'
import { AIRCRAFT_CSS } from '../airliner/svg'
const UNIT = 72
async function main() {
  const dir = '.scratch/vehicle-fill/yacht'
  const y = await buildYacht(UNIT)
  const b = y.box
  const vb = [b.x0 - 3, b.y0 - 3, b.x1 - b.x0 + 6, b.y1 - b.y0 + 6]
  const css = readFileSync('apps/next/src/app/styles.css', 'utf8').replace(/@import[^;]+;/g, '')
  const colors = ['#93b6f7', '#a7cc8f', '#f2a09d', '#79c9cb', '#dba1d1']
  mkdirSync(dir, { recursive: true })
  for (const theme of ['light', 'dark']) {
    const art = (width: number, color = colors[0]) =>
      `<svg class="lane-vehicle" style="width:${width}px;--lane-livery:${color}" viewBox="${vb.join(' ')}" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round"><use href="#yacht" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}"/></g></svg>`
    const w = (px: number) => (vb[2] * px) / UNIT
    const html = `<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yacht model</title><style>${css}${AIRCRAFT_CSS}${YACHT_CSS}
body{margin:0;background:var(--background);color:var(--text);font:14px system-ui}main{padding:24px;max-width:1100px;margin:auto}svg{display:block;height:auto;max-width:100%}.row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:28px;margin:20px 0}.hero{padding:20px 0}h1{font-size:20px;font-weight:500}p{color:var(--text-muted);margin:4px 0}</style><svg style="display:none" aria-hidden="true"><symbol id="yacht" viewBox="${vb.join(' ')}"><g style="--lv:var(--lane-livery,var(--figure-live-fill))">${y.body}</g></symbol></svg><main><h1>Sailing yacht</h1><p>${UNIT}px · lane</p><div class="row">${colors
      .slice(0, 3)
      .map((c) => art(w(UNIT), c))
      .join(
        '',
      )}</div><p>64px · phone</p><div class="row">${colors.map((c) => art(w(64), c)).join('')}</div><p>4×</p><div class="hero">${art(w(UNIT * 4))}</div></main></html>`
    writeFileSync(`${dir}/${theme}.html`, html)
  }
  console.log(
    `yacht: ${(y.body.length / 1024).toFixed(1)} KB SVG, box ${vb.map((n) => n.toFixed(1)).join(' ')}`,
  )
}
void main()
