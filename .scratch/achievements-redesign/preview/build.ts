// Preview harness for the ladder figures: `pnpm exec tsx .scratch/achievements-redesign/preview/build.ts [ladder-id] [--showcase N]`
// Writes out/<id>.html: per theme (dark, then light), every rung's hero in a 320×200 box, every rung's own-fit 56px tile in a 72px mark,
// and the rung strip at the showcase rung (earned / next ghost / later ghost 50%) with one shared k so growth reads.
// The renderer mirrors apps/next/src/client/overview/iso/iso-figure.tsx and the thumb CSS mirrors ladders.css; keep them in step.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fitBox, type IsoFigureData, type IsoNode, type Paint } from '../../../apps/next/src/client/overview/iso/scene'
import { LADDER_FIGURES } from '../../../apps/next/src/client/profile/ladders/figures/index'
import type { LadderFigureDef, LadderLod } from '../../../apps/next/src/client/profile/ladders/figures/types'

const here = dirname(fileURLToPath(import.meta.url))
const HERO = { w: 320, h: 200, maxK: 2.2 }
const THUMB = 56

const PAINT: Record<string, string> = {
  top: 'var(--iso-top)', front: 'var(--iso-front)', side: 'var(--iso-side)', line: 'var(--iso-line)',
  crease: 'var(--iso-crease)', detail: 'var(--iso-detail)', glass: 'var(--iso-glass)', ghost: 'var(--iso-ghost)',
  accent: 'var(--accent)', 'accent-side': 'color-mix(in oklab, var(--accent) 80%, black)',
  'accent-plate': 'color-mix(in oklab, var(--accent) 80%, var(--text))', shadow: 'var(--iso-shadow)',
  shade: 'var(--iso-shadow)', land: 'color-mix(in oklab, var(--iso-detail) 35%, transparent)',
  'on-accent': 'var(--accent-foreground)', ink: 'var(--text)', muted: 'var(--text-muted)', none: 'none',
}
const paint = (p: Paint) => PAINT[p] ?? 'magenta'
let uid = 0
function svg(fig: IsoFigureData): string {
  const base = `f${uid++}`
  const defs: string[] = []
  const blurs = new Set<number>()
  let clips = 0
  const [bx, by, bw, bh] = fig.viewBox.split(' ').map(Number)
  const render = (nodes: readonly IsoNode[]): string =>
    nodes
      .map((n) => {
        switch (n.kind) {
          case 'polygon': {
            const filter = n.fill === 'shadow' && n.stroke === 'none' && fig.shadowBlur ? ` filter="url(#${base}-sh)"` : ''
            return `<polygon points="${n.points}" stroke-width="${n.width ?? 1}" stroke-linejoin="round"${filter} style="fill:${paint(n.fill)};stroke:${paint(n.stroke)};${n.strokeOpacity != null ? `stroke-opacity:${n.strokeOpacity};` : ''}${n.opacity != null ? `opacity:${n.opacity}` : ''}"/>`
          }
          case 'path':
            return `<path d="${n.d}" stroke-width="${n.width}" stroke-linecap="round" stroke-linejoin="round"${n.dash ? ` stroke-dasharray="${n.dash}"` : ''} style="fill:${paint(n.fill)};stroke:${paint(n.stroke)}"/>`
          case 'text':
            return `<text x="${n.x}" y="${n.y}"${n.transform ? ` transform="${n.transform}"` : ''} font-size="${n.size}" font-weight="${n.weight}" text-anchor="${n.anchor}" style="fill:${paint(n.fill)};font-family:${n.mono ? 'ui-monospace,monospace' : 'Commissioner,system-ui,sans-serif'}">${n.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`
          case 'glow':
            blurs.add(n.blur)
            return `<g filter="url(#${base}-b${n.blur})" class="iso-glow">${render(n.children)}</g>`
          case 'group': {
            const vars = n.vars ? ` style="${Object.entries(n.vars).map(([k, v]) => `${k}:${v}`).join(';')}"` : ''
            const inner = `<g data-part="${n.part}"${vars}>${render(n.children)}</g>`
            if (!n.clip) return inner
            const id = `${base}-c${clips++}`
            defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><polygon points="${n.clip}"/></clipPath>`)
            return `<g clip-path="url(#${id})">${inner}</g>`
          }
        }
      })
      .join('')
  const body = render(fig.nodes)
  for (const b of blurs)
    defs.push(`<filter id="${base}-b${b}" filterUnits="userSpaceOnUse" x="${bx - 3 * b}" y="${by - 3 * b}" width="${bw + 6 * b}" height="${bh + 6 * b}"><feGaussianBlur stdDeviation="${b}"/></filter>`)
  if (fig.shadowBlur) {
    const sb = fig.shadowBounds ?? { x: bx, y: by, width: bw, height: bh }
    defs.push(`<filter id="${base}-sh" filterUnits="userSpaceOnUse" x="${sb.x}" y="${sb.y}" width="${sb.width}" height="${sb.height}"><feGaussianBlur stdDeviation="${fig.shadowBlur}"/></filter>`)
  }
  return `<svg class="iso" width="${fig.width}" height="${fig.height}" viewBox="${fig.viewBox}" style="overflow:visible"><defs>${defs.join('')}</defs>${body}</svg>`
}

const fit = (def: LadderFigureDef, rung: number, lod: LadderLod, w: number, h: number, initials?: string) =>
  fitBox(w, h, (k) => def.build(k, { rung, lod, initials }))

function ladderHtml(def: LadderFigureDef, showcase: number) {
  const rungs = Array.from({ length: def.rungs }, (_, i) => i + 1)
  const initials = 'AK'
  const heroes = rungs
    .map((r) => {
      const k = Math.min(HERO.maxK, fit(def, r, 'hero', HERO.w, HERO.h, initials))
      return `<figure class="hero"><div class="stage">${svg(def.build(k, { rung: r, lod: 'hero', initials }))}</div><figcaption>rung ${r} · k ${k}</figcaption></figure>`
    })
    .join('')
  const tiles = rungs
    .map((r) => {
      const k = fit(def, r, 'thumb', THUMB, THUMB, initials)
      return `<figure class="tile"><span class="mark ladder-thumb">${svg(def.build(k, { rung: r, lod: 'thumb', initials }))}</span><figcaption>rung ${r}</figcaption></figure>`
    })
    .join('')
  // One k for the whole strip, from the rung that needs the smallest one, so the object visibly grows along the strip.
  const stripK = Math.min(...rungs.map((r) => fit(def, r, 'thumb', THUMB, THUMB, initials)))
  const strip = rungs
    .map((r) => {
      const state = r <= showcase ? 'earned' : r === showcase + 1 ? 'next' : 'later'
      return `<figure class="slot" data-state="${state}"><span class="ladder-thumb thumb-box" data-state="${state}">${svg(def.build(stripK, { rung: r, lod: 'thumb', initials }))}</span><figcaption>${state === 'next' ? 'Airports to go: 150<br>Осталось аэропортов: 150' : `rung ${r}`}</figcaption></figure>`
    })
    .join('')
  return `<h2>${def.id}</h2><div class="row">${heroes}</div><div class="row">${tiles}</div><div class="row strip">${strip}</div>`
}

const DARK = `--background:#292827;--surface:#353331;--surface-inset:#403d3a;--text:#f1efeb;--text-muted:#c4beb7;--iso-top:color-mix(in oklab,#4b4844 86%,#f1efeb);--iso-front:color-mix(in oklab,#393735 90%,#f1efeb);--iso-side:#292725;--iso-line:#a8a098;--iso-crease:#756f68;--iso-detail:#5f5954;--iso-glass:#262423;--iso-ghost:#45403c;--iso-glow:.75;--iso-shadow:rgb(0 0 0/35%);--accent:#ea846f;--accent-foreground:#292827;--iso-ghost-line:#897e70`
const LIGHT = `--background:#fbfaf8;--surface:#fff;--surface-inset:#f2f0ed;--text:#302d2a;--text-muted:#66605b;--iso-top:#fff;--iso-front:#f1eeea;--iso-side:#dcd7d1;--iso-line:#5f5954;--iso-crease:#a9a199;--iso-detail:#cfc8c1;--iso-glass:#f8e1db;--iso-ghost:color-mix(in srgb,#c23417 18%,#fff);--iso-glow:.4;--iso-shadow:rgb(48 45 42/14%);--accent:#c23417;--accent-foreground:#fff;--iso-ghost-line:#a39a91`

const CSS = `
body{margin:0;font:13px/1.4 Commissioner,system-ui,sans-serif}
.theme{padding:32px;background:var(--background);color:var(--text)}
h2{font-weight:600;font-size:20px;margin:24px 0 12px}
.row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;margin-bottom:20px}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px}
figcaption{color:var(--text-muted);font-size:12px;text-align:center;white-space:nowrap}
.stage{width:320px;height:200px;background:var(--surface);border-radius:20px;display:grid;place-items:center}
.mark{width:72px;height:72px;border-radius:50%;background:var(--surface-inset);display:grid;place-items:center;--mark-bg:var(--surface-inset)}
.thumb-box{width:56px;height:56px;display:grid;place-items:center;--mark-bg:var(--surface)}
.strip{background:var(--surface);padding:16px;border-radius:16px;gap:24px}
.slot[data-state=next]{min-width:140px}
.iso-glow{opacity:var(--iso-glow)}
/* Mirror of ladders.css: line-only thumbnails. */
.ladder-thumb{--iso-top:var(--mark-bg);--iso-front:var(--mark-bg);--iso-side:var(--mark-bg);--iso-glass:var(--mark-bg);--iso-line:var(--text-muted);--iso-crease:var(--text-muted);--iso-detail:color-mix(in oklab,var(--text-muted) 50%,var(--mark-bg));--iso-shadow:transparent;--iso-glow:0}
.ladder-thumb[data-state=next],.ladder-thumb[data-state=later]{--iso-line:var(--iso-ghost-line);--iso-crease:var(--iso-ghost-line);--iso-detail:color-mix(in oklab,var(--iso-ghost-line) 50%,var(--mark-bg));--accent:var(--iso-ghost-line);--accent-foreground:var(--mark-bg)}
.ladder-thumb[data-state=later]{opacity:.5}
`

const args = process.argv.slice(2)
const only = args.find((a) => !a.startsWith('--'))
const showcaseArg = args.indexOf('--showcase')
const defs = Object.values(LADDER_FIGURES).filter((d) => !only || d.id === only)
if (!defs.length) throw new Error(`unknown ladder ${only}`)
mkdirSync(join(here, 'out'), { recursive: true })
for (const def of defs) {
  const showcase = showcaseArg >= 0 ? Number(args[showcaseArg + 1]) : Math.min(3, def.rungs - 1)
  const body = ['dark', 'light'].map((t) => `<section class="theme" style="${t === 'dark' ? DARK : LIGHT}">${ladderHtml(def, showcase)}</section>`).join('')
  const file = join(here, 'out', `${def.id}.html`)
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${def.id}</title><style>${CSS}</style>${body}`)
  console.log(file)
}
