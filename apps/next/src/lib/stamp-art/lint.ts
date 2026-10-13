// Pure geometric lint: no rasterising, safe for browser bundles.
import { frames, shapeFor, subjectPoly } from './frame'
import { pointInPoly } from './geom'
import { type Pt, type SvgNode } from './grid'
import { isKitTag } from './kit'
import { type Recipe, parseRecipe } from './recipe'
import { composeScene } from './render'
import { isSignatureName } from './signatures'

export type LintIssue = { iso2: string; rule: 'schema' | 'tag' | 'frame'; message: string }

const pointsOf = (node: SvgNode): Pt[] => (node.kind === 'occlude' ? [] : node.pts)

/**
 * Every tag must exist, and every point the SUBJECT draws (layers and signature parts, before
 * occlusion) must sit inside the frame window inset 6. Backdrop layers may fill the whole window.
 */
export function lintGeometry(recipe: Recipe, subject?: SvgNode[]): LintIssue[] {
  const issues: LintIssue[] = []
  const iso2 = recipe.iso2
  recipe.layers.forEach((l, i) => {
    if (!isKitTag(l.module))
      issues.push({ iso2, rule: 'tag', message: `layer ${i}: unknown module "${l.module}"` })
  })
  recipe.backdrop?.forEach((l, i) => {
    if (!isKitTag(l.module))
      issues.push({ iso2, rule: 'tag', message: `backdrop ${i}: unknown module "${l.module}"` })
  })
  recipe.signature?.forEach((s, i) => {
    if (!isSignatureName(s.part))
      issues.push({ iso2, rule: 'tag', message: `signature ${i}: unknown part "${s.part}"` })
  })
  if (issues.length) return issues
  const shape = shapeFor(iso2, recipe.shape)
  const poly = subjectPoly(shape)
  let outside = 0
  let first = ''
  for (const node of subject ?? composeScene(recipe).subject) {
    for (const pt of pointsOf(node)) {
      if (!pointInPoly(pt, poly)) {
        outside++
        first ||= `[${pt.map((v) => Math.round(v * 10) / 10).join(', ')}]`
        break
      }
    }
  }
  if (outside) {
    issues.push({
      iso2,
      rule: 'frame',
      message: `${outside} subject node(s) leave the window inset 6 (${frames[shape].name}), first at ${first}`,
    })
  }
  return issues
}

/** Lint from a raw recipe: schema errors (including unknown tags) become issues instead of throws. */
export function lintRaw(raw: unknown): LintIssue[] {
  const iso2 = String((raw as { iso2?: unknown } | null)?.iso2 ?? '??')
  let recipe: Recipe
  try {
    recipe = parseRecipe(raw)
  } catch (error) {
    return [
      { iso2, rule: 'schema', message: error instanceof Error ? error.message : String(error) },
    ]
  }
  return lintGeometry(recipe)
}
