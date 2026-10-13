// Recipe -> SVG string. Output is the engraving only, in the frame's coordinate system, clipped to
// the frame's inner window. Deterministic: fixed precision, stable order, fixed ids, no randomness.
import { frames, shapeFor } from './frame'
import { clipStrokeOutside, mirrorLeft } from './geom'
import { type Pt, type StrokeNode, type SvgNode, WEIGHTS, type Weight } from './grid'
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
  box: [number, number, number, number],
  params: Record<string, unknown> | undefined,
  mirror: boolean | undefined,
) {
  const nodes = mod(box, params ?? {})
  return mirror ? mirrorLeft(nodes, box[0] + box[2] / 2) : nodes
}

/** Runs every layer and signature part in order, applying occlusion. Pure and deterministic. */
export function composeNodes(recipe: Recipe): SvgNode[] {
  let acc: SvgNode[] = []
  const steps: {
    mod: KitModule
    box: [number, number, number, number]
    params?: Record<string, unknown>
    mirror?: boolean
  }[] = [
    ...recipe.layers.map((l) => ({
      mod: kit[l.module as keyof typeof kit] as KitModule,
      box: l.box,
      params: l.params,
      mirror: l.mirror,
    })),
    ...(recipe.signature ?? []).map((s) => ({
      mod: signatures[s.part as keyof typeof signatures] as KitModule,
      box: s.box,
      params: s.params,
    })),
  ]
  for (const step of steps) {
    for (const node of layerNodes(step.mod, step.box, step.params, step.mirror)) {
      if (node.kind === 'occlude') {
        acc = acc.flatMap((n): SvgNode[] =>
          n.kind === 'stroke' ? clipStrokeOutside(n, node.pts) : [n],
        )
      } else {
        acc.push(node)
      }
    }
  }
  return acc
}

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
