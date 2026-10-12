// Renders the redraw studies to SVG + PNG (dark sheet theme), mirroring IsoFigure's paint roles.
// pnpm exec tsx .scratch/figure-redraw/render.ts [prefix]
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import type { IsoFigureData, IsoNode, Paint } from '../../apps/next/src/client/overview/iso/scene'
import { figures as r1 } from './figures'
import { figures as r2 } from './figures2'
import { figures as r3 } from './figures3'
import { figures as r4 } from './figures4'
import { figures as r5 } from './figures5'
import { figures as r6 } from './figures6'
const figures = { ...r1, ...r2, ...r3, ...r4, ...r5, ...r6 }

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) =>
  '#' + hex(a).map((v, i) => Math.round(v * t + hex(b)[i] * (1 - t)).toString(16).padStart(2, '0')).join('')
const t = { top: '#403d3a', front: '#363432', side: '#2e2c2a', line: '#a8a098', detail: '#5f5954', accent: '#ea846f', text: '#f1efeb', muted: '#c4beb7', fg: '#292827', surface: '#3c3a37' }
const P: Record<string, string> = {
  top: t.top, front: t.front, side: t.side, line: t.line, detail: t.detail,
  glass: '#262423', ghost: '#45403c', accent: t.accent, 'accent-side': mix(t.accent, '#000000', 0.8), 'accent-plate': mix(t.accent, t.text, 0.8),
  shadow: 'rgb(0 0 0 / 30%)', land: t.detail + '59', 'on-accent': t.fg, ink: t.text, muted: t.muted, none: 'none',
  mark: '#897e70',
}
const col = (p: Paint) => P[p] ?? '#ff00ff'

export function svg(fig: IsoFigureData, bg = false) {
  let defs = '', n = 0
  const r = (nodes: readonly IsoNode[]): string => nodes.map((node) => {
    switch (node.kind) {
      case 'polygon': return `<polygon points="${node.points}" fill="${col(node.fill)}" stroke="${col(node.stroke)}" stroke-width="${node.width ?? 1}" stroke-linejoin="round"${node.opacity !== undefined ? ` opacity="${node.opacity}"` : ''}${node.strokeOpacity !== undefined ? ` stroke-opacity="${node.strokeOpacity}"` : ''}/>`
      case 'path': return `<path d="${node.d}" fill="${col(node.fill)}" stroke="${col(node.stroke)}" stroke-width="${node.width}" stroke-linecap="round" stroke-linejoin="round"${node.dash ? ` stroke-dasharray="${node.dash}"` : ''}/>`
      case 'text': return `<text x="${node.x}" y="${node.y}"${node.transform ? ` transform="${node.transform}"` : ''} font-size="${node.size}" font-weight="${node.weight}" text-anchor="${node.anchor}" fill="${col(node.fill)}" font-family="${node.mono ? 'JetBrains Mono, Menlo, monospace' : 'Onest, Helvetica, sans-serif'}">${node.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`
      case 'glow': return ''
      case 'group': {
        let inner = `<g data-part="${node.part}">${r(node.children)}</g>`
        if (node.clip) { const id = `c${n++}`; defs += `<clipPath id="${id}"><polygon points="${node.clip}"/></clipPath>`; inner = `<g clip-path="url(#${id})">${inner}</g>` }
        return inner
      }
    }
  }).join('')
  const body = r(fig.nodes)
  const [x0, y0, w, h] = fig.viewBox.split(' ').map(Number)
  const back = bg ? `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${t.surface}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fig.width}" height="${fig.height}" viewBox="${fig.viewBox}"><defs>${defs}</defs>${back}${body}</svg>`
}

const [name] = process.argv.slice(2)
for (const [key, build] of Object.entries(figures))
  if (!name || key.startsWith(name)) {
    const fig = build()
    const base = `.scratch/figure-redraw/out/${key}`
    writeFileSync(`${base}.svg`, svg(fig))
    writeFileSync(`${base}-bg.svg`, svg(fig, true))
    execFileSync('rsvg-convert', ['-z', '2', `${base}-bg.svg`, '-o', `${base}.png`])
    console.log(key, fig.width, fig.height)
  }
