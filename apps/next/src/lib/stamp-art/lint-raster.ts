// Node-only raster lint. Kept apart from lint.ts so a browser bundle never imports resvg.
//
// The engraving is rasterised at 96px with the impression applied, then measured inside the frame
// window. Thresholds were tuned on the six reference countries (see the table in RASTER_LIMITS).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { FRAME_WEIGHTS, type ShapeName, frames, outerPoly, restTilt, shapeFor } from './frame'
import { impressionInner, impressionTransform } from './impression'
import type { Recipe } from './recipe'
import { composeScene, renderNodes } from './render'

export const RASTER_PX = 96

/**
 * Allowed bands at 96px, impression applied, measured inside the frame window. The vignette fills
 * the window with tone, so the bands sit far above the old line-icon look (percent of window area
 * unless noted). Measured values live in the check:stamps output and the W1b report.
 *
 * Coverage 38-58: below 38 the window reads empty again; above 58 the hatching clogs into grey
 * slabs. Paper regions >= 6: a scene breaks the window into separate paper areas. Solid share
 * <= 15: share of window pixels inside a fully inked 3x3 block; the tone ladder is built from
 * lines, so only T5 roofs and openings reach it. Subject interior >= 50% paper: the subject is the
 * lit shape against the tone, so under half of its silhouette may be ink. Weak quarter <= 0.75 of
 * the strong quarter: the impression keeps that share of the ink on the weak side relative to the
 * strong side (retention, so the art's own distribution does not matter).
 */
export const RASTER_LIMITS = {
  coverage: [38, 58],
  minPaperRegions: 6,
  maxSolidShare: 15,
  minSubjectPaper: 50,
  maxWeakStrong: 0.75,
} as const

/** The wear texture removes this much ink from a fully inked stamp (percent). */
export const IMPRESSION_REMOVED = [6, 10] as const

export type RasterReport = {
  iso2: string
  /** Ink as a percent of the window area, anti-aliased (a half-covered pixel counts half). */
  coverage: number
  /** Separate paper regions of at least 4px2 inside the window. */
  paperRegions: number
  /** Separate ink components of at least 2px2. */
  inkComponents: number
  /** Percent of window pixels that sit in a solid 3x3 ink block. */
  solidShare: number
  /** Largest ink component as a share of all ink. */
  blobShare: number
  /** Percent of the subject silhouette interior that stays paper (clean engraving). */
  subjectPaper: number
  /** Ink kept by the impression on the weak quarter over the strong quarter (retention ratio). */
  weakStrong: number
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

function maskDef(shape: ShapeName, iso2: string): string {
  const t = impressionTransform(iso2, restTilt(iso2))
  return (
    `<mask id="im" maskUnits="userSpaceOnUse" x="-100" y="-100" width="400" height="400">` +
    `<g transform="translate(${t.dx} ${t.dy}) rotate(${t.rotate} 100 100)">${impressionInner(shape)}</g></mask>`
  )
}

/** The engraving with the impression composited on top, as one standalone SVG document. */
export function compositeSvg(recipe: Recipe): string {
  const shape = shapeFor(recipe.iso2, recipe.shape)
  const frame = frames[shape]
  const engraving = renderNodes(composeScene(recipe).nodes, frame.window, frame.viewBox)
  const inner = engraving.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\n?$/, '')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.viewBox}">` +
    `${maskDef(shape, recipe.iso2)}<g mask="url(#im)">${inner}</g></svg>`
  )
}

/** Frame rules plus engraving, optionally worn: what the component paints without ring text. */
function ruledSvg(recipe: Recipe, worn: boolean): string {
  const shape = shapeFor(recipe.iso2, recipe.shape)
  const frame = frames[shape]
  const engraving = renderNodes(composeScene(recipe).nodes, frame.window, frame.viewBox)
  const inner = engraving.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\n?$/, '')
  const rules =
    `<g fill="none" stroke="#000"><path d="${frame.outer[0]}" stroke-width="${FRAME_WEIGHTS.outer}"/>` +
    `<path d="${frame.outer[1]}" stroke-width="${FRAME_WEIGHTS.inner}"/>` +
    `<path d="${frame.window}" stroke-width="${FRAME_WEIGHTS.window}"/></g>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.viewBox}">` +
    (worn
      ? `${maskDef(shape, recipe.iso2)}<g mask="url(#im)">${rules}${inner}</g>`
      : `${rules}${inner}`) +
    `</svg>`
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

/** Subject interior is measured at 3x the display size, 1.4 grid units inside the contour. */
const INTERIOR_RASTER = RASTER_PX * 3
const INTERIOR_ERODE = 2
/** Silhouettes smaller than this are all outline (wall strips, small ornaments) and are skipped. */
const MASS_AREA = 60

const polyArea = (pts: [number, number][]) =>
  Math.abs(
    pts.reduce((sum, a, i) => {
      const b = pts[(i + 1) % pts.length]
      return sum + a[0] * b[1] - b[0] * a[1]
    }, 0),
  ) / 2

/** Keeps a pixel only when every pixel within `r` (a square) is covered. */
function erode(alpha: Uint8Array, width: number, height: number, r: number): Uint8Array {
  const out = new Uint8Array(alpha.length)
  for (let y = r; y < height - r; y++)
    for (let x = r; x < width - r; x++) {
      let all = true
      for (let dy = -r; dy <= r && all; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (alpha[(y + dy) * width + x + dx] < 250) {
            all = false
            break
          }
      if (all) out[y * width + x] = 255
    }
  return out
}

/** Horizontal extent of the shape's outer rule in pixels of a `px` wide raster of the stamp. */
function shapeSpan(shape: ShapeName, px: number): [number, number] {
  const xs = outerPoly(shape).map((q) => q[0])
  return [(Math.min(...xs) / 200) * px, (Math.max(...xs) / 200) * px]
}

/**
 * Percent of the subject's interior that is paper in the clean engraving. The interior is the union
 * of the subject's silhouettes (masses only) pulled in from the contour, so outline weight does not
 * count against it: what counts is tone laid inside the subject (T4 shade, T5 fills, hatching).
 */
function subjectPaper(
  scene: ReturnType<typeof composeScene>,
  viewBox: string,
  windowPath: string,
): number {
  const masses = scene.silhouettes.filter((p) => polyArea(p) >= MASS_AREA)
  if (!masses.length) return 100
  const lit = rasterize(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="${masses.map((p) => polyD(p)).join('')}" fill="#000"/></svg>`,
    INTERIOR_RASTER,
  )
  const clean = rasterize(renderNodes(scene.nodes, windowPath, viewBox), INTERIOR_RASTER)
  const inner = erode(lit.alpha, lit.width, lit.height, INTERIOR_ERODE)
  let n = 0,
    paper = 0
  for (let i = 0; i < inner.length; i++) {
    if (!inner[i]) continue
    n++
    if (clean.alpha[i] < 128) paper++
  }
  return n ? Math.round((paper / n) * 1000) / 10 : 100
}

const polyD = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('') + 'Z'

export async function measureRaster(recipe: Recipe): Promise<RasterReport> {
  await init()
  const shape = shapeFor(recipe.iso2, recipe.shape)
  const frame = frames[shape]
  const scene = composeScene(recipe)
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
    inkPx = 0,
    inkMass = 0
  for (let i = 0; i < inWindow.length; i++) {
    if (win.alpha[i] < 250) continue // strictly inside, so anti-aliased window edges do not count
    inWindow[i] = 1
    windowPx++
    inkMass += ink.alpha[i] / 255
    if (ink.alpha[i] >= 128) {
      inkOn[i] = 1
      inkPx++
    } else paperOn[i] = 1
  }
  // Weak against strong quarter of the stamp along the pressure axis: ink the impression keeps.
  const stampClean = rasterize(ruledSvg(recipe, false), RASTER_PX)
  const stampWorn = rasterize(ruledSvg(recipe, true), RASTER_PX)
  const t = impressionTransform(recipe.iso2, restTilt(recipe.iso2))
  const strongRight = t.pressureAngle < 90 || t.pressureAngle > 270
  const quarter = { weak: [0, 0], strong: [0, 0] } // [kept, clean]
  const [sx0, sx1] = shapeSpan(shape, width)
  for (let i = 0; i < stampClean.alpha.length; i++) {
    const x = i % width
    const right = x >= sx0 + (sx1 - sx0) * 0.75,
      left = x < sx0 + (sx1 - sx0) * 0.25
    const which = right
      ? strongRight
        ? 'strong'
        : 'weak'
      : left
        ? strongRight
          ? 'weak'
          : 'strong'
        : null
    if (!which) continue
    quarter[which][0] += stampWorn.alpha[i]
    quarter[which][1] += stampClean.alpha[i]
  }
  const retention = (v: number[]) => (v[1] ? v[0] / v[1] : 1)
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
    coverage: Math.round((inkMass / windowPx) * 1000) / 10,
    paperRegions: paperSizes.length,
    inkComponents: inkSizes.length,
    solidShare: Math.round((solid / windowPx) * 1000) / 10,
    blobShare: Math.round((Math.max(0, ...inkSizes) / total) * 100) / 100,
    subjectPaper: subjectPaper(scene, frame.viewBox, frame.window),
    weakStrong:
      Math.round((retention(quarter.weak) / (retention(quarter.strong) || 1)) * 100) / 100,
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
  if (report.subjectPaper < L.minSubjectPaper) {
    report.issues.push(
      `subject interior is ${report.subjectPaper}% paper (need ${L.minSubjectPaper}%): the subject must stay the lit shape`,
    )
  }
  if (report.weakStrong > L.maxWeakStrong) {
    report.issues.push(
      `weak quarter keeps ${report.weakStrong}x the ink of the strong quarter (max ${L.maxWeakStrong})`,
    )
  }
  return report
}

export type ImpressionReport = {
  shape: ShapeName
  /** Percent of a fully inked stamp the texture removes. */
  removed: number
  /** Ink kept on the weak quarter over the strong quarter of a fully inked stamp. */
  weakStrong: number
  issues: string[]
}

/** Applies a shape's texture to solid ink inside its outer rule and measures what is removed. */
export async function measureImpression(shape: ShapeName): Promise<ImpressionReport> {
  await init()
  const frame = frames[shape]
  const outer = outerPoly(shape)
  const mask =
    `<mask id="im" maskUnits="userSpaceOnUse" x="-100" y="-100" width="400" height="400">` +
    `${impressionInner(shape)}</mask>`
  const solid = `<path d="${polyD(outer)}" fill="#000"`
  const px = 400
  const base = rasterize(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.viewBox}">${solid}/></svg>`,
    px,
  )
  const worn = rasterize(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.viewBox}">${mask}${solid} mask="url(#im)"/></svg>`,
    px,
  )
  let all = 0,
    kept = 0
  const weak = [0, 0],
    strong = [0, 0]
  const [sx0, sx1] = shapeSpan(shape, px)
  for (let i = 0; i < base.alpha.length; i++) {
    if (base.alpha[i] < 250) continue
    const x = i % px
    all += 255
    kept += worn.alpha[i]
    // The texture is strong on +x: the right quarter of the shape is strong.
    const bucket =
      x >= sx0 + (sx1 - sx0) * 0.75 ? strong : x < sx0 + (sx1 - sx0) * 0.25 ? weak : null
    if (bucket) {
      bucket[0] += worn.alpha[i]
      bucket[1] += 255
    }
  }
  const report: ImpressionReport = {
    shape,
    removed: Math.round((1 - kept / all) * 1000) / 10,
    weakStrong: Math.round((weak[0] / weak[1] / (strong[0] / strong[1])) * 100) / 100,
    issues: [],
  }
  const [lo, hi] = IMPRESSION_REMOVED
  if (report.removed < lo || report.removed > hi)
    report.issues.push(
      `${shape}: impression removes ${report.removed}% of the ink (want ${lo}-${hi}%)`,
    )
  if (report.weakStrong > RASTER_LIMITS.maxWeakStrong)
    report.issues.push(
      `${shape}: weak quarter keeps ${report.weakStrong}x the strong quarter (max ${RASTER_LIMITS.maxWeakStrong})`,
    )
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
    : renderNodes(composeScene(recipe).nodes, frame.window, frame.viewBox)
  return new Resvg(svg, { fitTo: { mode: 'width', value: px }, background: 'white' })
    .render()
    .asPng()
}
