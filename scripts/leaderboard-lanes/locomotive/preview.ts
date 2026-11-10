// Inline, offline preview of the exact production locomotive builder at lane size, phone size and 4x in both themes.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { buildLocomotive } from './locomotive'
import { AIRCRAFT_CSS } from '../airliner/svg'

async function main() {
  const dir = '.scratch/vehicle-fill/locomotive'
  const t0 = Date.now()
  const loco = await buildLocomotive()
  const b = loco.box
  const vb = [b.x0 - 4, b.y0 - 4, b.x1 - b.x0 + 8, b.y1 - b.y0 + 8]
  const css = readFileSync('apps/next/src/app/styles.css', 'utf8').replace(/@import[^;]+;/g, '')
  const colors = ['#93b6f7', '#a7cc8f', '#f2a09d', '#dba1d1']
  mkdirSync(dir, { recursive: true })
  const [x, y, w, h] = vb
  // The rails the lane draws, as two thin levelled lines at the gauge, so the wheel contacts can be checked.
  const rails = (width: number) =>
    `<line x1="${x}" x2="${x + w}" y1="${loco.rail.near}" y2="${loco.rail.near}" style="stroke:var(--iso-line);stroke-width:${(0.9 * vb[2]) / width}"/>`
  for (const theme of ['light', 'dark']) {
    const art = (width: number, color = colors[0], crop?: number[]) => {
      const v = crop ?? vb
      return `<svg class="lane-vehicle" style="width:${width}px;--lane-livery:${color}" viewBox="${v.join(' ')}" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round"><use href="#loco" x="${x}" y="${y}" width="${w}" height="${h}"/></g>${rails(width)}</svg>`
    }
    const html = `<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Locomotive model</title><style>${css}${AIRCRAFT_CSS}
body{margin:0;background:var(--background);color:var(--text);font:14px system-ui}main{padding:24px;max-width:1500px;margin:auto}svg{display:block;height:auto;max-width:100%;overflow:visible}.row{display:flex;flex-wrap:wrap;align-items:center;gap:20px;margin:24px 0}.hero{padding:28px 0}h1{font-size:20px;font-weight:500}p{color:var(--text-muted)}</style><svg style="display:none" aria-hidden="true"><symbol id="loco" viewBox="${vb.join(' ')}"><g style="--lv:var(--lane-livery)">${loco.body}</g></symbol></svg><main><h1>Electric locomotive</h1><div class="hero">${art(1400)}</div><p>4× · 448px</p><div class="row">${art(448)}</div><p>close-up · nose end</p><div class="hero">${art(1300, colors[0], [x + w - 62, -36, 62, 46])}</div><p>close-up · tail end, bogie</p><div class="hero">${art(1300, colors[0], [x + 4, -36, 62, 46])}</div><p>close-up · roof and bogie</p><div class="hero">${art(1300, colors[0], [x + w / 2 - 32, -46, 62, 56])}</div>${process.env.CROP ? `<div class="hero">${art(1300, colors[0], process.env.CROP.split(',').map(Number))}</div>` : ''}<p>112px · desktop</p><div class="row">${colors.map((c) => art(w, c)).join('')}</div><p>64px · phone</p><div class="row">${colors.map((c) => art((w * 64) / 112, c)).join('')}</div></main></html>`
    writeFileSync(`${dir}/${theme}.html`, html)
  }
  console.log(
    `locomotive: ${(loco.body.length / 1024).toFixed(1)} KB SVG, box ${vb.join(' ')}, gear ${loco.gear.toFixed(2)}, ${Date.now() - t0} ms`,
  )
}
void main()
