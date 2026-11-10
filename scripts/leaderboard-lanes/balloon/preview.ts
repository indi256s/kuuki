// Inline, offline preview of the balloon at lane size, phone size and 4x in both themes, under
// .scratch/vehicle-fill/balloon/{light,dark}.html (opens from disk).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { BALLOON_CSS, buildBalloon } from './balloon'
import { AIRCRAFT_CSS } from '../airliner/svg'

async function main() {
  const art0 = await buildBalloon()
  const b = art0.box
  const vb = [b.x0 - 3, b.y0 - 3, b.x1 - b.x0 + 6, b.y1 - b.y0 + 6]
  const css = readFileSync('apps/next/src/app/styles.css', 'utf8').replace(/@import[^;]+;/g, '')
  const colors = ['#93b6f7', '#f2a09d', '#a7cc8f']
  const page = (theme: string, body: string) =>
    `<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Balloon model</title><style>${css}${AIRCRAFT_CSS}${BALLOON_CSS}
body{margin:0;background:var(--background);color:var(--text);font:14px system-ui}main{padding:24px}svg{display:block;height:auto;max-width:none}.row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:28px;margin:20px 0}p{color:var(--text-muted);margin:4px 0}</style><svg style="display:none" aria-hidden="true"><symbol id="balloon" viewBox="${vb.join(' ')}">${art0.body}</symbol></svg><main>${body}</main></html>`
  // The symbol's width is the envelope's width plus a 3-unit margin: the lane unit is the car's 112-unit scale.
  const art = (width: number, color = colors[0]) =>
    `<svg class="lane-vehicle" style="width:${width}px;--lane-livery:${color}" viewBox="${vb.join(' ')}" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round"><use href="#balloon" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}"/></g></svg>`
  const at = (px: number) => (vb[2] * px) / 112
  // A crop of the rigging and basket: the axis stands at x = -56 (half the 112-unit width), the basket on y = 0.
  const crop = [-82, b.y1 - 44, 52, 50]
  const cropArt = (scale: number, color = colors[0]) =>
    `<svg class="lane-vehicle" style="width:${crop[2] * scale}px;--lane-livery:${color}" viewBox="${crop.join(' ')}" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round"><use href="#balloon" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}"/></g></svg>`
  const dir = '.scratch/vehicle-fill/balloon'
  mkdirSync(dir, { recursive: true })
  for (const theme of ['light', 'dark'])
    writeFileSync(
      `${dir}/${theme}.html`,
      page(
        theme,
        `<div style="display:flex;gap:48px;align-items:flex-start"><div><p>lane size 72 px · phone 64 and 56 px</p><div class="row">${art(at(72))}${art(at(72), colors[1])}${art(at(64))}${art(at(56), colors[2])}</div><p>4× · 288 px</p><div class="row">${art(at(288))}</div></div><div><p>basket and rigging · 12×</p>${cropArt(12)}</div></div>`,
      ),
    )
  console.log(
    `balloon: ${(art0.body.length / 1024).toFixed(1)} KB SVG, box ${vb.map((n) => n.toFixed(1)).join(' ')}, gear ${art0.gear.toFixed(2)}`,
  )
}
void main()
