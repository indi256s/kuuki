// Node-only raster lint. Kept apart from lint.ts so a browser bundle never imports resvg.
//
// The engraving is rasterised at 96px with the impression applied, then measured inside the frame
// window. Thresholds were tuned on the six reference countries (see the table in RASTER_LIMITS).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { frames, restTilt, shapeFor } from './frame'
import { impressionInner, impressionTransform } from './impression'
import type { Recipe } from './recipe'
import { composeNodes, renderNodes } from './render'

export const RASTER_PX = 96

/**
 * Allowed bands at 96px, impression applied, measured inside the frame window. Tuned on the six
 * reference countries (percent of window area unless noted):
 *
 *   iso2  coverage  paper regions  solid share  ink components
 *   AM    14.5      17             0.7          18
 *   DE    25.3      14             7.6          2
 *   GE    16.6      7              0.5          5
 *   JP    21.5      24             2.2          10
 *   ME    18.3      9              5.1          6
 *   TH    18.7      19             4.5          3
 *
 * Coverage 12-38: the six sit at 14-26, so below 12 the stamp is a frame with a smudge and above 38
 * line work clogs at 96px. Paper regions >= 6: a recognisable scene breaks the window into many
 * separate paper areas (the sparsest, GE, has 7); a lone shape or a black slab has few. Solid share
 * <= 12: share of window pixels inside a fully inked 3x3 block; line art stays thin (DE, with the
 * quadriga and stylobate, is the heaviest at 7.6), a larger value means a fill or blob went wrong.
 * Ink components are reported only: connected line art legitimately collapses into one or two.
 */
export const RASTER_LIMITS = {
  coverage: [12, 38],
  minPaperRegions: 6,
  maxSolidShare: 12,
} as const

export type RasterReport = {
  iso2: string
  /** Ink as a percent of the window area. */
  coverage: number
  /** Separate paper regions of at least 4px2 inside the window. */
  paperRegions: number
  /** Separate ink components of at least 2px2. */
  inkComponents: number
  /** Percent of window pixels that sit in a solid 3x3 ink block. */
  solidShare: number
  /** Largest ink component as a share of all ink. */
  blobShare: number
  issues: string[]
}

let ready: Promise<void> | undefined
function init() {
  ready ??= (async () => {
    // __filename under tsx (CommonJS); import.meta.url under vitest (ESM).
    const here = typeof __filename === 'string' ? __filename : fileURLToPath(import.meta.url)
    const require = createRequire(here)
    const wasm = readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm'))
    await initWasm(wasm)
  })()
  return ready
}

function rasterize(svg: string, px: number): { width: number; height: number; alpha: Uint8Array } {
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: px } }).render()
  const { width, height } = image
  const rgba = image.pixels
  const alpha = new Uint8Array(width * height)
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]
  image.free()
  return { width, height, alpha }
}

/** The engraving with the impression composited on top, as one standalone SVG document. */
export function compositeSvg(recipe: Recipe): string {
  const frame = frames[shapeFor(recipe.iso2, recipe.shape)]
  const engraving = renderNodes(composeNodes(recipe), frame.window, frame.viewBox)
  const inner = engraving.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\n?$/, '')
  const t = impressionTransform(recipe.iso2, restTilt(recipe.iso2))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.viewBox}">` +
    `<mask id="im" maskUnits="userSpaceOnUse" x="-100" y="-100" width="400" height="400">` +
    `<g transform="translate(${t.dx} ${t.dy}) rotate(${t.rotate} 100 100)">${impressionInner()}</g></mask>` +
    `<g mask="url(#im)">${inner}</g></svg>`
  )
}

/** Connected components (4-neighbour) of pixels where `on` is true. Returns component sizes. */
function components(on: Uint8Array, width: number, height: number): number[] {
  const seen = new Uint8Array(on.length)
  const sizes: number[] = []
  const stack: number[] = []
  for (let start = 0; start < on.length; start++) {
    if (!on[start] || seen[start]) continue
    let size = 0
    stack.push(start)
    seen[start] = 1
    while (stack.length) {
      const i = stack.pop() as number
      size++
      const x = i % width,
        y = (i - x) / width
      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ]
      for (const n of neighbours) {
        if (n >= 0 && on[n] && !seen[n]) {
          seen[n] = 1
          stack.push(n)
        }
      }
    }
    sizes.push(size)
  }
  return sizes
}

export async function measureRaster(recipe: Recipe): Promise<RasterReport> {
  await init()
  const frame = frames[shapeFor(recipe.iso2, recipe.shape)]
  const ink = rasterize(compositeSvg(recipe), RASTER_PX)
  const win = rasterize(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.viewBox}"><path d="${frame.window}" fill="#000"/></svg>`,
    RASTER_PX,
  )
  const { width, height } = ink
  const inWindow = new Uint8Array(width * height)
  const inkOn = new Uint8Array(width * height)
  const paperOn = new Uint8Array(width * height)
  let windowPx = 0,
    inkPx = 0
  for (let i = 0; i < inWindow.length; i++) {
    if (win.alpha[i] < 250) continue // strictly inside, so anti-aliased window edges do not count
    inWindow[i] = 1
    windowPx++
    if (ink.alpha[i] >= 128) {
      inkOn[i] = 1
      inkPx++
    } else paperOn[i] = 1
  }
  let solid = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      if (!inkOn[i]) continue
      let all = true
      for (let dy = -1; dy <= 1 && all; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (!inkOn[i + dy * width + dx]) {
            all = false
            break
          }
      if (all) solid++
    }
  }
  const inkSizes = components(inkOn, width, height).filter((s) => s >= 2)
  const paperSizes = components(paperOn, width, height).filter((s) => s >= 4)
  const total = inkSizes.reduce((a, b) => a + b, 0) || 1
  const report: RasterReport = {
    iso2: recipe.iso2,
    coverage: Math.round((inkPx / windowPx) * 1000) / 10,
    paperRegions: paperSizes.length,
    inkComponents: inkSizes.length,
    solidShare: Math.round((solid / windowPx) * 1000) / 10,
    blobShare: Math.round((Math.max(0, ...inkSizes) / total) * 100) / 100,
    issues: [],
  }
  const L = RASTER_LIMITS
  if (report.coverage < L.coverage[0] || report.coverage > L.coverage[1]) {
    report.issues.push(
      `ink coverage ${report.coverage}% outside ${L.coverage[0]}-${L.coverage[1]}%`,
    )
  }
  if (report.paperRegions < L.minPaperRegions) {
    report.issues.push(
      `only ${report.paperRegions} paper regions at ${RASTER_PX}px (need ${L.minPaperRegions})`,
    )
  }
  if (report.solidShare > L.maxSolidShare) {
    report.issues.push(`solid ink blocks cover ${report.solidShare}% (max ${L.maxSolidShare}%)`)
  }
  return report
}

/** PNG of the composited engraving, for previews. */
export async function renderPng(
  recipe: Recipe,
  px: number,
  impression = true,
): Promise<Uint8Array> {
  await init()
  const frame = frames[shapeFor(recipe.iso2, recipe.shape)]
  const svg = impression
    ? compositeSvg(recipe)
    : renderNodes(composeNodes(recipe), frame.window, frame.viewBox)
  return new Resvg(svg, { fitTo: { mode: 'width', value: px }, background: 'white' })
    .render()
    .asPng()
}
