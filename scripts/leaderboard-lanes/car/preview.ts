// Inline, offline preview of the exact production car builder at lane size and 4x in both themes.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { buildCar } from './car'
import { AIRCRAFT_CSS } from '../airliner/svg'
async function main() {
  const dir = '.scratch/car-anatomy'
  const car = await buildCar()
  const b = car.box
  const vb = [b.x0 - 4, b.y0 - 4, b.x1 - b.x0 + 8, b.y1 - b.y0 + 8]
  const css = readFileSync('apps/next/src/app/styles.css', 'utf8').replace(/@import[^;]+;/g, '')
  const colors = ['#93b6f7', '#a7cc8f', '#f2a09d', '#79c9cb', '#dba1d1']
  mkdirSync(dir, { recursive: true })
  for (const theme of ['light', 'dark']) {
    const art = (width: number, color = colors[0]) =>
      `<svg class="lane-vehicle" style="width:${width}px;--lane-livery:${color}" viewBox="${vb.join(' ')}" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round"><use href="#coupe" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}"/></g></svg>`
    const html = `<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coupe model</title><style>${css}${AIRCRAFT_CSS}
body{margin:0;background:var(--background);color:var(--text);font:14px system-ui}main{padding:24px;max-width:1000px;margin:auto}svg{display:block;height:auto;max-width:100%}.row{display:flex;flex-wrap:wrap;align-items:center;gap:20px;margin:24px 0}.hero{padding:28px 0}h1{font-size:20px;font-weight:500}p{color:var(--text-muted)}</style><svg style="display:none" aria-hidden="true"><symbol id="coupe" viewBox="${vb.join(' ')}">${car.body}</symbol></svg><main><h1>993-inspired coupé</h1><div class="hero">${art(896)}</div><p>112px · desktop</p><div class="row">${colors.map((c) => art(vb[2], c)).join('')}</div><p>64px · phone</p><div class="row">${colors.map((c) => art((vb[2] * 64) / 112, c)).join('')}</div></main></html>`
    writeFileSync(`${dir}/${theme}.html`, html)
  }
  console.log(`car: ${(car.body.length / 1024).toFixed(1)} KB SVG, box ${vb.join(' ')}`)
}
void main()
