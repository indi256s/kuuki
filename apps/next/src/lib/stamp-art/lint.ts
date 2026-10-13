// Pure geometric lint: no rasterising, safe for browser bundles.
import { frames, shapeFor } from './frame'
import { type SvgNode, nodeBounds } from './grid'
import { isKitTag } from './kit'
import { type Recipe, parseRecipe } from './recipe'
import { composeNodes } from './render'
import { isSignatureName } from './signatures'

export type LintIssue = { iso2: string; rule: 'schema' | 'tag' | 'frame'; message: string }

const TOLERANCE = 0.05

function boundsInside(b: [number, number, number, number], s: [number, number, number, number]) {
  return (
    b[0] >= s[0] - TOLERANCE &&
    b[1] >= s[1] - TOLERANCE &&
    b[2] <= s[0] + s[2] + TOLERANCE &&
    b[3] <= s[1] + s[3] + TOLERANCE
  )
}

/** Every layer box and every emitted node must sit inside the frame's safe box; every tag must exist. */
export function lintGeometry(recipe: Recipe, nodes: SvgNode[] = composeNodes(recipe)): LintIssue[] {
  const issues: LintIssue[] = []
  const iso2 = recipe.iso2
  const safe = frames[shapeFor(iso2, recipe.shape)].safe
  recipe.layers.forEach((l, i) => {
    if (!isKitTag(l.module))
      issues.push({ iso2, rule: 'tag', message: `layer ${i}: unknown module "${l.module}"` })
    if (!boundsInside([l.box[0], l.box[1], l.box[0] + l.box[2], l.box[1] + l.box[3]], safe)) {
      issues.push({
        iso2,
        rule: 'frame',
        message: `layer ${i} (${l.module}) box ${JSON.stringify(l.box)} leaves the safe box ${JSON.stringify(safe)}`,
      })
    }
  })
  recipe.signature?.forEach((s, i) => {
    if (!isSignatureName(s.part))
      issues.push({ iso2, rule: 'tag', message: `signature ${i}: unknown part "${s.part}"` })
    if (!boundsInside([s.box[0], s.box[1], s.box[0] + s.box[2], s.box[1] + s.box[3]], safe)) {
      issues.push({
        iso2,
        rule: 'frame',
        message: `signature ${i} (${s.part}) box ${JSON.stringify(s.box)} leaves the safe box`,
      })
    }
  })
  let outside = 0
  let first = ''
  for (const node of nodes) {
    const b = nodeBounds(node)
    if (b && !boundsInside(b, safe)) {
      outside++
      first ||= `[${b.map((v) => Math.round(v * 10) / 10).join(', ')}]`
    }
  }
  if (outside) {
    issues.push({
      iso2,
      rule: 'frame',
      message: `${outside} drawn node(s) leave the safe box ${JSON.stringify(safe)}, first at ${first}`,
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
