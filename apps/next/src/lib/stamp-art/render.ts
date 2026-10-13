// Recipe -> SVG string. Output is the engraving only, in the frame's coordinate system, clipped to
// the frame's inner window. Deterministic: fixed precision, stable order, fixed ids, no randomness.
import { frames, shapeFor } from './frame'
import { bufferPoly, clipStrokeOutside, mirrorLeft } from './geom'
import { type Box, type Pt, type StrokeNode, type SvgNode, WEIGHTS, type Weight } from './grid'
import { kit } from './kit'
import type { KitModule } from './kit'
import type { Recipe } from './recipe'
import { signatures } from './signatures'

const num = (v: number): string => {
  const s = (Math.round(v * 100) / 100).toString()
  return s === '-0' ? '0' : s
}

function layerNodes(
  mod: KitModule,
  box: Box,
  params: Record<string, unknown> | undefined,
  mirror: boolean | undefined,
) {
  const nodes = mod(box, params ?? {})
  return mirror ? mirrorLeft(nodes, box[0] + box[2] / 2) : nodes
}

/** Backdrop hatching stops this far short of a subject silhouette. */
export const SUBJECT_HALO = 3

export type Scene = {
  /** Everything drawn, occlusion applied, in paint order. */
  nodes: SvgNode[]
  /** Raw subject output (before occlusion): what the frame lint tests against the window. */
  subject: SvgNode[]
  /** Silhouettes the subject occludes with: the lit shape the interior lint measures. */
  silhouettes: Pt[][]
}

type Step = {
  mod: KitModule
  box: Box
  params?: Record<string, unknown>
  mirror?: boolean
  role: 'backdrop' | 'subject'
}

/** Runs backdrop, layers and signature parts in order, applying occlusion. Pure, deterministic. */
export function composeScene(recipe: Recipe): Scene {
  const frame = frames[shapeFor(recipe.iso2, recipe.shape)]
  const [wx, wy, ww, wh] = frame.windowBox
  const horizonY = wy + wh * (recipe.horizon ?? 0.7)
  const steps: Step[] = [
    ...(recipe.backdrop ?? []).map((l) => ({
      mod: kit[l.module as keyof typeof kit] as KitModule,
      box: l.box ?? ([wx, wy, ww, wh] as Box),
      params: { horizonY, ...l.params },
      mirror: l.mirror,
      role: 'backdrop' as const,
    })),
    ...recipe.layers.map((l) => ({
      mod: kit[l.module as keyof typeof kit] as KitModule,
      box: l.box,
      params: l.params,
      mirror: l.mirror,
      role: 'subject' as const,
    })),
    ...(recipe.signature ?? []).map((s) => ({
      mod: signatures[s.part as keyof typeof signatures] as KitModule,
      box: s.box,
      params: s.params,
      role: 'subject' as const,
    })),
  ]
  let acc: SvgNode[] = []
  const late: SvgNode[] = []
  const subject: SvgNode[] = []
  const silhouettes: Pt[][] = []
  for (const step of steps) {
    const made = layerNodes(step.mod, step.box, step.params, step.mirror)
    for (const raw of made) {
      const node = step.role === 'backdrop' && raw.kind === 'stroke' ? { ...raw, bg: true } : raw
      if (node.kind === 'occlude') {
        const halo = node.halo ?? (step.role === 'subject' ? SUBJECT_HALO : 0)
        if (step.role === 'subject') silhouettes.push(node.pts)
        const wide = halo > 0 ? bufferPoly(node.pts, halo) : node.pts
        acc = acc.flatMap((n): SvgNode[] =>
          n.kind === 'stroke' ? clipStrokeOutside(n, n.bg ? wide : node.pts) : [n],
        )
        continue
      }
      if (step.role === 'subject') subject.push(node)
      if (node.kind === 'stroke' && node.late) late.push(node)
      else acc.push(node)
    }
  }
  return { nodes: [...acc, ...late], subject, silhouettes }
}

/** The drawn nodes of a recipe. */
export const composeNodes = (recipe: Recipe): SvgNode[] => composeScene(recipe).nodes

const d = (pts: Pt[], closed: boolean) =>
  `M${pts.map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}${closed ? 'Z' : ''}`

export function renderNodes(nodes: SvgNode[], windowPath: string, viewBox: string): string {
  const fills = nodes.filter((n) => n.kind === 'fill')
  const paths: string[] = []
  if (fills.length) {
    paths.push(`<path d="${fills.map((f) => d(f.pts, true)).join('')}" fill="#000" stroke="none"/>`)
  }
  for (const w of Object.keys(WEIGHTS) as Weight[]) {
    const strokes = nodes.filter(
      (n): n is StrokeNode => n.kind === 'stroke' && n.weight === w && n.pts.length > 1,
    )
    if (strokes.length) {
      paths.push(
        `<path d="${strokes.map((s) => d(s.pts, s.closed)).join('')}" stroke-width="${WEIGHTS[w]}"/>`,
      )
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">` +
    `<defs><clipPath id="w"><path d="${windowPath}"/></clipPath></defs>` +
    `<g clip-path="url(#w)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</g></svg>\n`
  )
}

export function renderEngraving(recipe: Recipe): string {
  const frame = frames[shapeFor(recipe.iso2, recipe.shape)]
  return renderNodes(composeNodes(recipe), frame.window, frame.viewBox)
}
