/**
 * Stamp check for the verify gate: regenerates every stamp file in memory and byte-compares it with
 * the committed one, then runs the geometric and raster lint on every engraved recipe.
 * Run: pnpm check:stamps
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stampFiles } from '../apps/next/src/lib/stamp-art/build'
import { stampIndexJson } from '../apps/next/src/lib/stamp-art/stamp-index'
import { lintGeometry } from '../apps/next/src/lib/stamp-art/lint'
import { SHAPE_NAMES } from '../apps/next/src/lib/stamp-art/frame'
import { measureImpression, measureRaster } from '../apps/next/src/lib/stamp-art/lint-raster'
import { RECIPE_FILES, loadRecipes } from '../apps/next/src/lib/stamp-art/recipes'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STAMPS_DIR = join(ROOT, 'apps', 'next', 'public', 'stamps')
const RECIPES_DIR = join(ROOT, 'apps', 'next', 'src', 'lib', 'stamp-art', 'recipes')

async function main() {
  const failures: string[] = []

  for (const file of readdirSync(RECIPES_DIR)) {
    if (file.endsWith('.json') && !(file.slice(0, -5) in RECIPE_FILES)) {
      failures.push(`recipes/${file} is not registered in recipes/index.ts`)
    }
  }

  const expected = stampFiles()
  for (const [name, content] of Object.entries(expected)) {
    const path = join(STAMPS_DIR, name)
    if (!existsSync(path)) failures.push(`${name}: missing (run pnpm generate:stamps)`)
    else if (readFileSync(path, 'utf8') !== content)
      failures.push(`${name}: drifted from its recipe (run pnpm generate:stamps)`)
  }
  for (const name of existsSync(STAMPS_DIR) ? readdirSync(STAMPS_DIR) : []) {
    if (!(name in expected)) failures.push(`${name}: stale, no recipe produces it`)
  }

  const indexPath = join(RECIPES_DIR, '..', 'stamp-index.generated.json')
  if (!existsSync(indexPath))
    failures.push('stamp-index.generated.json: missing (run pnpm generate:stamps)')
  else if (readFileSync(indexPath, 'utf8') !== stampIndexJson())
    failures.push('stamp-index.generated.json: drifted (run pnpm generate:stamps)')

  for (const shape of SHAPE_NAMES) {
    const report = await measureImpression(shape)
    for (const issue of report.issues) failures.push(issue)
    console.log(`impression ${shape}: removes ${report.removed}% weak/strong ${report.weakStrong}`)
  }

  for (const recipe of loadRecipes()) {
    if (recipe.tier !== 'engraved') continue
    for (const issue of lintGeometry(recipe)) failures.push(`${issue.iso2}: ${issue.message}`)
    const raster = await measureRaster(recipe)
    for (const issue of raster.issues) failures.push(`${recipe.iso2}: ${issue}`)
    console.log(
      `${recipe.iso2}: coverage ${raster.coverage}% paper regions ${raster.paperRegions} ink components ${raster.inkComponents} solid ${raster.solidShare}% blob ${raster.blobShare} subject paper ${raster.subjectPaper}% weak/strong ${raster.weakStrong}`,
    )
  }

  if (failures.length) {
    console.error(`\ncheck:stamps failed:\n- ${failures.join('\n- ')}`)
    process.exit(1)
  }
  console.log('check:stamps ok')
}

void main()
