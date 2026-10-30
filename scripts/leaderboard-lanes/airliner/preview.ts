// Quick preview of the lane airliners, inline (opens from disk): every type at the desktop and phone lane unit, and the
// picked types at 4×, in both themes.
//
//   pnpm exec tsx scripts/leaderboard-lanes/airliner/preview.ts [A320 B738 …]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AIR_UNIT, buildAir } from './build'
import { AIRCRAFT_CSS } from './svg'

const OUT = '.scratch/aircraft-anatomy-v2/preview'
async function main() {
  const picked = process.argv.slice(2)
  const t0 = Date.now()
  const air = await buildAir(picked.length ? picked : undefined)
  const pad = 3
  const x0 = Math.min(...air.map((a) => a.box.x0)) - pad,
    y0 = Math.min(...air.map((a) => a.box.y0)) - pad,
    x1 = Math.max(...air.map((a) => a.box.x1)) + pad,
    y1 = Math.max(...air.map((a) => a.box.y1)) + pad
  const vb = [x0, y0, x1 - x0, y1 - y0].map((n) => Math.round(n * 100) / 100)
  const inks = ['#c86b8a', '#6c86c8', '#5aa39a', '#c89a5a']
  const card = (i: number, unitPx: number) => {
    const a = air[i]
    const w = (vb[2] / AIR_UNIT) * unitPx
    return `<figure style="--lane-livery:${inks[i % 4]}"><svg class="iso-svg lane-vehicle" style="width:${w.toFixed(1)}px" viewBox="${vb.join(' ')}"><g stroke-linejoin="round" stroke-linecap="round">${a.body}</g><line x1="${vb[0]}" x2="${vb[0] + vb[2]}" y1="0" y2="0" style="stroke:var(--mark-rest);stroke-width:${(2 * AIR_UNIT) / unitPx}"/></svg><figcaption>${a.key}</figcaption></figure>`
  }
  const styles = readFileSync('apps/next/src/app/styles.css', 'utf8').replace(/@import[^;]+;/g, '')
  mkdirSync(OUT, { recursive: true })
  for (const theme of ['light', 'dark'])
    for (const [name, units] of [
      ['gallery', [112, 64]],
      ['zoom', [Number(process.env.ZOOMPX ?? 448)]],
    ] as const)
      writeFileSync(
        join(OUT, `${name}-${theme}.html`),
        `<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><title>Lane airliners</title><style>${styles}
body{margin:0;font:12px system-ui;background:var(--background);color:var(--text)}section{padding:24px}
.grid{display:flex;flex-wrap:wrap;gap:22px 30px;align-items:end;margin-bottom:28px}figure{margin:0}
figcaption{color:var(--text-muted);margin-top:4px}.lane-vehicle{display:block;height:auto;overflow:visible}
${AIRCRAFT_CSS}</style><section>${units
          .map((u) => `<div class="grid">${air.map((_, i) => card(i, u)).join('')}</div>`)
          .join('')}</section>`,
      )
  const kb = (s: string) => Math.round(s.length / 102.4) / 10
  console.log(
    `preview: ${air.length} types in ${((Date.now() - t0) / 1000).toFixed(1)} s · ${air.map((a) => `${a.key} ${kb(a.body)}KB`).join(' · ')}`,
  )
}
void main()
