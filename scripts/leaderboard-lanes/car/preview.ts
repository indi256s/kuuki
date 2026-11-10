// Inline, offline preview of the exact production car builder at lane size and 4x in both themes.
// Writes the original showcase under .scratch/car-anatomy and the vehicle-fill review pages under
// .scratch/vehicle-fill/car (desktop lane size, 64 px phone size, 4x close-up).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { buildCar } from './car'
import { AIRCRAFT_CSS } from '../airliner/svg'
async function main() {
  const car = await buildCar()
  const b = car.box
  const vb = [b.x0 - 4, b.y0 - 4, b.x1 - b.x0 + 8, b.y1 - b.y0 + 8]
  const css = readFileSync('apps/next/src/app/styles.css', 'utf8').replace(/@import[^;]+;/g, '')
  const colors = ['#93b6f7', '#a7cc8f', '#f2a09d', '#79c9cb', '#dba1d1']
  const page = (theme: string, body: string, extra = '') =>
    `<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coupe model</title><style>${css}${AIRCRAFT_CSS}
body{margin:0;background:var(--background);color:var(--text);font:14px system-ui}main{padding:24px;max-width:1000px;margin:auto}svg{display:block;height:auto;max-width:100%}.row{display:flex;flex-wrap:wrap;align-items:center;gap:20px;margin:24px 0}.hero{padding:28px 0}h1{font-size:20px;font-weight:500}p{color:var(--text-muted)}${extra}</style><svg style="display:none" aria-hidden="true"><symbol id="coupe" viewBox="${vb.join(' ')}">${car.body}</symbol></svg><main>${body}</main></html>`
  const art = (width: number, color = colors[0]) =>
    `<svg class="lane-vehicle" style="width:${width}px;--lane-livery:${color}" viewBox="${vb.join(' ')}" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round"><use href="#coupe" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}"/></g></svg>`
  // A cropped window of the art (fractions of the viewBox), enlarged: wheels, nose and tail up close.
  const crop = (f: [number, number, number, number], width: number, color = colors[0]) => {
    const [x, y, w, h] = [
      vb[0] + f[0] * vb[2],
      vb[1] + f[1] * vb[3],
      (f[2] - f[0]) * vb[2],
      (f[3] - f[1]) * vb[3],
    ]
    return `<svg class="lane-vehicle" style="width:${width}px;--lane-livery:${color}" viewBox="${x} ${y} ${w} ${h}" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round"><use href="#coupe" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}"/></g></svg>`
  }
  const legacy = '.scratch/car-anatomy'
  const review = '.scratch/vehicle-fill/car'
  mkdirSync(legacy, { recursive: true })
  mkdirSync(review, { recursive: true })
  for (const theme of ['light', 'dark']) {
    writeFileSync(
      `${legacy}/${theme}.html`,
      page(
        theme,
        `<h1>993-inspired coupé</h1><div class="hero">${art(896)}</div><p>112px · desktop</p><div class="row">${colors.map((c) => art(vb[2], c)).join('')}</div><p>64px · phone</p><div class="row">${colors.map((c) => art((vb[2] * 64) / 112, c)).join('')}</div>`,
      ),
    )
    // Review page: lane size (1x of the 112 px unit), phone size (64 px long) and a 4x close-up.
    writeFileSync(
      `${review}/${theme}.html`,
      page(
        theme,
        `<p>desktop lane size · 112 px unit</p><div class="row">${art(vb[2])}${art(vb[2], colors[1])}</div><p>phone · 64 px long</p><div class="row">${art((vb[2] * 64) / 112)}${art((vb[2] * 64) / 112, colors[2])}</div><p>4×</p><div class="hero">${art(vb[2] * 4)}</div><p>tail · 8×</p><div class="row">${crop([0, 0.25, 0.4, 1], 580)}${crop([0.3, 0.1, 0.75, 1], 580)}${crop([0.6, 0.15, 1, 1], 580)}</div>`,
        'main{max-width:none}',
      ),
    )
  }
  console.log(`car: ${(car.body.length / 1024).toFixed(1)} KB SVG, box ${vb.join(' ')}`)
}
void main()
