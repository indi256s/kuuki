// The five stamp frames, all in a 200x200 viewBox so the engraving grid and the frame share one
// coordinate system. Single source for the renderer clip, the linter and the W2 component.
import countries from '@kuuki/data/countries.json'
import { type Box } from './grid'
import { hash32 } from './hash'

export const SHAPE_NAMES = ['circle', 'oval', 'rectangle', 'cut-rect', 'octagon'] as const
export type ShapeName = (typeof SHAPE_NAMES)[number]
export type ShapeFamily = 'circle' | 'rectangle'

export const FAMILY_SHAPES: Record<ShapeFamily, readonly ShapeName[]> = {
  circle: ['circle', 'oval'],
  rectangle: ['rectangle', 'cut-rect', 'octagon'],
}

export type Frame = {
  name: ShapeName
  family: ShapeFamily
  viewBox: string
  /** Double rule: heavy outer line first, thin inner line second. Stroke these. */
  outer: [string, string]
  /** Closed path (clockwise from the left or top-left) for a <textPath> in the ring band. */
  ringText: string
  /** Inner window the engraving is clipped to. */
  window: string
  /** Inscribed box in grid units that all engraving geometry must stay inside. */
  safe: Box
}

const n = (v: number) => String(Math.round(v * 100) / 100)

function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 1 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 1 ${n(cx - rx)} ${n(cy)}Z`
}

/** Rectangle with chamfered corners (c = 0 gives a plain rectangle), clockwise from the top-left. */
function chamfer(x: number, y: number, w: number, h: number, c: number): string {
  if (c <= 0) return `M${n(x)} ${n(y)}H${n(x + w)}V${n(y + h)}H${n(x)}Z`
  return `M${n(x + c)} ${n(y)}H${n(x + w - c)}L${n(x + w)} ${n(y + c)}V${n(y + h - c)}L${n(x + w - c)} ${n(y + h)}H${n(x + c)}L${n(x)} ${n(y + h - c)}V${n(y + c)}Z`
}

/** Rectangle family: outer rect [x,y,w,h], chamfer c. Insets follow the 45-degree cut. */
function rectFrame(name: ShapeName, r: Box, c: number, safe: Box): Frame {
  const [x, y, w, h] = r
  const at = (d: number) => chamfer(x + d, y + d, w - 2 * d, h - 2 * d, Math.max(0, c - d * 0.586))
  return {
    name,
    family: 'rectangle',
    viewBox: '0 0 200 200',
    outer: [at(0), at(4)],
    ringText: at(13),
    window: at(24),
    safe,
  }
}

export const frames: Record<ShapeName, Frame> = {
  circle: {
    name: 'circle',
    family: 'circle',
    viewBox: '0 0 200 200',
    outer: [ellipse(100, 100, 96, 96), ellipse(100, 100, 91.5, 91.5)],
    ringText: ellipse(100, 100, 83.5, 83.5),
    window: ellipse(100, 100, 74, 74),
    safe: [44, 50, 112, 100],
  },
  oval: {
    name: 'oval',
    family: 'circle',
    viewBox: '0 0 200 200',
    outer: [ellipse(100, 100, 80, 96), ellipse(100, 100, 75.5, 91.5)],
    ringText: ellipse(100, 100, 67.5, 83.5),
    window: ellipse(100, 100, 57, 73),
    safe: [58, 50, 84, 100],
  },
  rectangle: rectFrame('rectangle', [6, 24, 188, 152], 0, [33, 51, 134, 98]),
  'cut-rect': rectFrame('cut-rect', [6, 24, 188, 152], 20, [33, 51, 134, 98]),
  octagon: rectFrame('octagon', [6, 14, 188, 172], 40, [43, 51, 114, 98]),
}

type CatalogEntry = { stampShape: ShapeFamily }
const catalog = countries as unknown as Record<string, CatalogEntry | undefined>

/** Catalog shape family for a country; unknown codes fall back to the rectangle family. */
export function familyOf(iso2: string): ShapeFamily {
  return catalog[iso2.toUpperCase()]?.stampShape === 'circle' ? 'circle' : 'rectangle'
}

/** Frame shape: the recipe override, else a stable hash pick inside the catalog family. */
export function shapeFor(iso2: string, override?: ShapeName): ShapeName {
  if (override) return override
  const options = FAMILY_SHAPES[familyOf(iso2)]
  return options[hash32(`shape:${iso2.toUpperCase()}`) % options.length]
}

/**
 * Resting tilt in degrees, 1.2 to 4 in magnitude (never near 0). The sign comes from a different
 * hash bit than the magnitude so neighbouring codes do not all lean the same way.
 */
export function restTilt(iso2: string): number {
  const h = hash32(`tilt:${iso2.toUpperCase()}`)
  const magnitude = 1.2 + ((h >>> 8) % 281) / 100
  const sign = (h & 1) === 0 ? -1 : 1
  return Math.round(sign * magnitude * 100) / 100
}
