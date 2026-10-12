// Renders iso figures to SVG + PNG in both themes, mirroring IsoFigure (no CSS motion: the rest pose, optionally `--lit`).
// pnpm exec tsx .scratch/iso-cards/render.ts <name> [--lit]
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { IsoFigureData, IsoNode, Paint } from '../../apps/next/src/client/overview/iso/scene'
import { figures } from './figures'

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) =>
  '#' +
  hex(a)
    .map((v, i) => Math.round(v * t + hex(b)[i] * (1 - t)).toString(16).padStart(2, '0'))
    .join('')
const THEMES = {
  dark: { bg: '#353331', top: '#403d3a', front: '#363432', side: '#2e2c2a', line: '#a8a098', detail: '#5f5954', accent: '#ea846f', text: '#f1efeb', muted: '#c4beb7', fg: '#292827', glow: 0.75, shadow: 'rgb(0 0 0 / 30%)', surface: '#353331' },
  light: { bg: '#ffffff', top: '#ffffff', front: '#f3f1ee', side: '#e7e3df', line: '#5f5954', detail: '#cfc8c1', accent: '#c23417', text: '#302d2a', muted: '#66605b', fg: '#ffffff', glow: 0.4, shadow: 'rgb(48 45 42 / 14%)', surface: '#ffffff' },
}
type T = (typeof THEMES)['dark']
const MAK: Record<'dark' | 'light', Record<string, string>> = {
  dark: { airbus: '#0685b6', boeing: '#04ac7b', embraer: '#a4770f', atr: '#a36ffa', other: '#c9c1b7', unknown: '#47433f' },
  light: { airbus: '#0f6390', boeing: '#16a384', embraer: '#8c6d08', atr: '#9a52cf', other: '#c2bab0', unknown: '#ece9e5' },
}
const paint = (t: T): Record<Paint, string> => ({
  top: t.top, front: t.front, side: t.side, line: t.line, detail: t.detail,
  glass: mix(t.accent, t.surface, 0.1), ghost: mix(t.accent, t.surface, 0.18),
  accent: t.accent, 'accent-side': mix(t.accent, '#000000', 0.8), 'accent-plate': mix(t.accent, t.text, 0.8),
  shadow: t.shadow, land: t.detail + '59', 'on-accent': t.fg, ink: t.text, muted: t.muted, none: 'none',
})

function svg(fig: IsoFigureData, t: T, lit: boolean) {
  const P = paint(t)
  const col = (p: Paint) => p.startsWith('maker-side:') ? mix(MAK[t === THEMES.dark ? 'dark' : 'light'][p.slice(11)], '#000000', 0.72) : p.startsWith('maker:') ? MAK[t === THEMES.dark ? 'dark' : 'light'][p.slice(6)] : P[p]
  let defs = '', n = 0
  const r = (nodes: readonly IsoNode[]): string =>
    nodes.map((node) => {
      switch (node.kind) {
        case 'polygon': return `<polygon points="${node.points}" fill="${col(node.fill)}" stroke="${col(node.stroke)}" stroke-width="${node.width ?? 1}" stroke-linejoin="round"${node.opacity !== undefined ? ` opacity="${node.opacity}"` : ""}${node.strokeOpacity !== undefined ? ` stroke-opacity="${node.strokeOpacity}"` : ''}/>`
        case 'path': return `<path d="${node.d}" fill="${col(node.fill)}" stroke="${col(node.stroke)}" stroke-width="${node.width}" stroke-linecap="round" stroke-linejoin="round"${node.dash ? ` stroke-dasharray="${node.dash}"` : ''}/>`
        case 'text': return `<text x="${node.x}" y="${node.y}"${node.transform ? ` transform="${node.transform}"` : ''} font-size="${node.size}" font-weight="${node.weight}" text-anchor="${node.anchor}" fill="${col(node.fill)}" font-family="${node.mono ? 'Menlo' : 'Helvetica'}">${node.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`
        case 'glow': { const id = `b${n++}`; defs += `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${node.blur}"/></filter>`; return `<g filter="url(#${id})" opacity="${t.glow}">${r(node.children)}</g>` }
        case 'group': {
          const hide = !lit && /^(dash|month|flap|lit-b)$/.test(node.part)
          let inner = `<g data-part="${node.part}"${hide ? ' opacity="0"' : ''}>${r(node.children)}</g>`
          if (node.clip) { const id = `c${n++}`; defs += `<clipPath id="${id}"><polygon points="${node.clip}"/></clipPath>`; inner = `<g clip-path="url(#${id})">${inner}</g>` }
          return inner
        }
      }
    }).join('')
  const body = r(fig.nodes)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fig.width}" height="${fig.height}" viewBox="${fig.viewBox}"><defs>${defs}</defs>${body}</svg>`
}

const [name, ...flags] = process.argv.slice(2)
const lit = flags.includes('--lit')
mkdirSync('.scratch/sheet-anatomy/figures', { recursive: true })
for (const [key, build] of Object.entries(figures))
  if (!name || key.startsWith(name))
    for (const theme of ['dark', 'light'] as const) {
      const fig = build()
      const base = `.scratch/sheet-anatomy/figures/${key}-${theme}`
      writeFileSync(`${base}.svg`, svg(fig, THEMES[theme], lit))
      execFileSync('rsvg-convert', ['-z', '4', `${base}.svg`, '-o', `${base}.png`])
      console.log(base, fig.width, fig.height)
    }
