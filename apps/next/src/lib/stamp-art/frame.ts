// The five stamp frames, all in a 200x200 viewBox so the engraving grid and the frame share one
// coordinate system. Single source for the renderer clip, the linter, the impression nicks and the
// W2 component.
//
// Anatomy, outside in: outer rule (3.4), inner rule (1.2) at inset 4.5, a text band, then the
// window edge (1.6) with the engraving inside. Round shapes carry text on the whole band; the
// rectangle family only on the straight top and bottom, with narrow side bands.
import countries from '@kuuki/data/countries.json'
import { type Box, type Pt } from './grid'
import { hash32 } from './hash'

export const SHAPE_NAMES = ['circle', 'oval', 'rectangle', 'cut-rect', 'octagon'] as const
export type ShapeName = (typeof SHAPE_NAMES)[number]
export type ShapeFamily = 'circle' | 'rectangle'

export const FAMILY_SHAPES: Record<ShapeFamily, readonly ShapeName[]> = {
  circle: ['circle', 'oval'],
  rectangle: ['rectangle', 'cut-rect', 'octagon'],
}

/** Stroke widths of the frame rules, grid units. */
export const FRAME_WEIGHTS = { outer: 3.4, inner: 1.2, window: 1.6 } as const
/** Distance from the outer rule to the inner rule. */
export const INNER_INSET = 4.5
/** Cap height of the ring text, centred in its band (grid units). */
export const RING_CAP = 9.5
/** Subject geometry must stay this far inside the window edge. */
export const SUBJECT_INSET = 6

/** Text on a path. Glyphs stand upright when the path is read left to right. */
export type RingPath = {
  /** Path data. Top: glyphs rise away from the stamp centre. Bottom: they point toward it. */
  d: string
  /** Path length in grid units; keep text under about 80% of it. */
  length: number
  /** Where the text is anchored: 50% of the path, `text-anchor: middle`. */
  startOffset: '50%'
}

export type Frame = {
  name: ShapeName
  family: ShapeFamily
  viewBox: string
  /** Double rule: heavy outer line first, thin inner line second. Stroke these. */
  outer: [string, string]
  /** Inner window the engraving is clipped to. Stroke it at FRAME_WEIGHTS.window. */
  window: string
  /** Bounding box of the window, [x, y, w, h]. */
  windowBox: Box
  /**
   * Baselines for the country name (top) and `· ISO3 ·` (bottom). Both read upright. Use font
   * metrics so the cap height is RING_CAP, centred in the band.
   */
  ring: { top: RingPath; bottom: RingPath; capHeight: number }
}

/** Geometry description: an ellipse or a rectangle with chamfered corners. */
type Spec =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'chamfer'; x: number; y: number; w: number; h: number; c: number }

const n = (v: number) => String(Math.round(v * 100) / 100)

const ELLIPSE_STEPS = 96

function specPath(s: Spec): string {
  if (s.kind === 'ellipse') {
    const { cx, cy, rx, ry } = s
    return `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 1 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 1 ${n(cx - rx)} ${n(cy)}Z`
  }
  return specPoly(s)
    .map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`)
    .join('')
    .concat('Z')
}

/** Polygon outline, clockwise on screen from the left (ellipse) or top-left (chamfer). */
function specPoly(s: Spec): Pt[] {
  if (s.kind === 'ellipse') {
    return Array.from({ length: ELLIPSE_STEPS }, (_, i) => {
      const a = Math.PI + (i / ELLIPSE_STEPS) * Math.PI * 2
      return [s.cx + s.rx * Math.cos(a), s.cy + s.ry * Math.sin(a)] as Pt
    })
  }
  const { x, y, w, h, c } = s
  if (c <= 0)
    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ]
  return [
    [x + c, y],
    [x + w - c, y],
    [x + w, y + c],
    [x + w, y + h - c],
    [x + w - c, y + h],
    [x + c, y + h],
    [x, y + h - c],
    [x, y + c],
  ]
}

const specBounds = (s: Spec): Box =>
  s.kind === 'ellipse' ? [s.cx - s.rx, s.cy - s.ry, s.rx * 2, s.ry * 2] : [s.x, s.y, s.w, s.h]

const ellipseOf = (rx: number, ry: number): Spec => ({ kind: 'ellipse', cx: 100, cy: 100, rx, ry })

/** Round shapes: the rules and window are concentric; the text band between them is 19 wide. */
const ROUND_BAND = 19

/** Rectangle family: side bands 14 from the outer edge, top and bottom bands 22. */
const SIDE = 14
const CAP_BAND = 22

function rectSpecs(r: Box, c: number, uniformWindow: boolean) {
  const [x, y, w, h] = r
  const cut = (inset: number, dx: number, dy: number): Spec => {
    // The 45-degree cut moves by inset * sqrt(2) along the axes; recompute the chamfer so the cut
    // line keeps a uniform perpendicular distance to the outer one.
    const cw = c <= 0 ? 0 : Math.max(0, x + y + c + inset * Math.SQRT2 - (x + dx) - (y + dy))
    return { kind: 'chamfer', x: x + dx, y: y + dy, w: w - 2 * dx, h: h - 2 * dy, c: cw }
  }
  return {
    outer: cut(0, 0, 0),
    inner: cut(INNER_INSET, INNER_INSET, INNER_INSET),
    // Uniform: the window's cut sits as far from the outer cut as the window's top edge from the outer top
    // edge, so the ring text can run along the corner cuts.
    window: uniformWindow ? cut(CAP_BAND, SIDE, CAP_BAND) : cut(SIDE, SIDE, CAP_BAND),
  }
}

type FrameDef = {
  family: ShapeFamily
  outer: Spec
  inner: Spec
  window: Spec
  /** Ring text baselines (computed from the shape). */
  ring: Frame['ring']
}

function ellipseHalf(rx: number, ry: number, top: boolean): RingPath {
  const d = top
    ? `M${n(100 - rx)} 100A${n(rx)} ${n(ry)} 0 0 1 ${n(100 + rx)} 100`
    : `M${n(100 - rx)} 100A${n(rx)} ${n(ry)} 0 0 0 ${n(100 + rx)} 100`
  // Ramanujan perimeter, halved.
  const h = ((rx - ry) / (rx + ry)) ** 2
  const length = (Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))) / 2
  return { d, length: Math.round(length * 10) / 10, startOffset: '50%' }
}

function roundDef(rx: number, ry: number): FrameDef {
  const mid = INNER_INSET + ROUND_BAND / 2
  const half = RING_CAP / 2
  const at = (d: number) => ellipseOf(rx - d, ry - d)
  return {
    family: 'circle',
    outer: at(0),
    inner: at(INNER_INSET),
    window: at(INNER_INSET + ROUND_BAND),
    ring: {
      // Top glyphs rise outward, so the baseline sits on the inner side of the text row.
      top: ellipseHalf(rx - mid - half, ry - mid - half, true),
      // Bottom glyphs point inward, so the baseline sits on the outer side.
      bottom: ellipseHalf(rx - mid + half, ry - mid + half, false),
      capHeight: RING_CAP,
    },
  }
}

function lineRing(x0: number, x1: number, y: number): RingPath {
  return { d: `M${n(x0)} ${n(y)}H${n(x1)}`, length: x1 - x0, startOffset: '50%' }
}

/** Corner-cut text: the ring line runs on the cuts too, down to this x from the box edge. */
const CUT_TEXT_END = 22

function polyRing(pts: Pt[]): RingPath {
  const length = pts
    .slice(1)
    .reduce((s, q, i) => s + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0)
  return {
    d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join(''),
    length: Math.round(length * 10) / 10,
    startOffset: '50%',
  }
}

function rectDef(r: Box, c: number, cutText = false): FrameDef {
  const s = rectSpecs(r, c, cutText)
  const [x, y, w, h] = r
  const bandMid = INNER_INSET + (CAP_BAND - INNER_INSET) / 2
  const half = RING_CAP / 2
  // Text may not run into the chamfers: the inner rule's cut, at the outer edge of the glyphs,
  // limits how far the baseline can run.
  const gap = bandMid - half - INNER_INSET
  const cut = s.inner.kind === 'chamfer' ? s.inner.c : 0
  const reach = (cut > gap ? cut - gap : 0) + INNER_INSET + 4
  if (cutText) {
    // Octagon: the baselines keep their distance from the outer rule on the 45-degree cuts, so the line
    // is top edge plus both cuts (top: glyphs rise outward; bottom: they rise inward).
    const topY = y + bandMid + half
    const botY = y + h - bandMid + half
    const topOff = topY - y
    const botOff = y + h - botY
    const k = Math.SQRT2 - 1
    // Where the offset baseline meets the cut: shift along x by c + offset * (sqrt2 - 1).
    const topX = x + c + topOff * k
    const botX = x + c + botOff * k
    const ex = x + CUT_TEXT_END
    const topEdge = topX - ex
    const botEdge = botX - ex
    return {
      family: 'rectangle',
      outer: s.outer,
      inner: s.inner,
      window: s.window,
      ring: {
        top: polyRing([
          [ex, topY + topEdge],
          [topX, topY],
          [x + w - topX + x, topY],
          [x + w - ex + x, topY + topEdge],
        ]),
        bottom: polyRing([
          [ex, botY - botEdge],
          [botX, botY],
          [x + w - botX + x, botY],
          [x + w - ex + x, botY - botEdge],
        ]),
        capHeight: RING_CAP,
      },
    }
  }
  return {
    family: 'rectangle',
    outer: s.outer,
    inner: s.inner,
    window: s.window,
    ring: {
      top: lineRing(x + reach, x + w - reach, y + bandMid + half),
      bottom: lineRing(x + reach, x + w - reach, y + h - bandMid + half),
      capHeight: RING_CAP,
    },
  }
}

const defs: Record<ShapeName, FrameDef> = {
  circle: roundDef(96, 96),
  oval: roundDef(80, 96),
  rectangle: rectDef([6, 24, 188, 152], 0),
  'cut-rect': rectDef([6, 24, 188, 152], 20),
  octagon: rectDef([6, 14, 188, 172], 40, true),
}

function build(name: ShapeName): Frame {
  const d = defs[name]
  return {
    name,
    family: d.family,
    viewBox: '0 0 200 200',
    outer: [specPath(d.outer), specPath(d.inner)],
    window: specPath(d.window),
    windowBox: specBounds(d.window),
    ring: d.ring,
  }
}

export const frames: Record<ShapeName, Frame> = {
  circle: build('circle'),
  oval: build('oval'),
  rectangle: build('rectangle'),
  'cut-rect': build('cut-rect'),
  octagon: build('octagon'),
}

/** Window outline as a polygon (ellipses sampled at 96 points). */
export const windowPoly = (shape: ShapeName): Pt[] => specPoly(defs[shape].window)

/** Outer rule as a polygon: the path the impression nicks are sampled along. */
export const outerPoly = (shape: ShapeName): Pt[] => specPoly(defs[shape].outer)

/** Window inset by `d` units: where subject geometry (not backdrop) must stay. */
export function subjectPoly(shape: ShapeName, d = SUBJECT_INSET): Pt[] {
  const w = defs[shape].window
  if (w.kind === 'ellipse') return specPoly({ ...w, rx: w.rx - d, ry: w.ry - d })
  // Chamfer: shrink the box by d and move the cut line d inward (perpendicular).
  const [x, y] = [w.x + d, w.y + d]
  const cw = w.c <= 0 ? 0 : w.c + d * (Math.SQRT2 - 2)
  return specPoly({ kind: 'chamfer', x, y, w: w.w - 2 * d, h: w.h - 2 * d, c: Math.max(0, cw) })
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
 * Resting tilt in degrees, never near 0: 2 to 4.5 in magnitude on round shapes, 1 to 2.5 on the
 * rectangle family (a long straight edge shows a small angle more). `shape` defaults to the country's own. The sign comes from a different
 * hash bit than the magnitude so neighbouring codes do not all lean the same way.
 */
export function restTilt(iso2: string, shape: ShapeName = shapeFor(iso2)): number {
  const h = hash32(`tilt:${iso2.toUpperCase()}`)
  const [lo, hi] = FAMILY_SHAPES.circle.includes(shape) ? [2, 4.5] : [1, 2.5]
  const magnitude = lo + (((h >>> 8) % 1000) / 999) * (hi - lo)
  const sign = (h & 1) === 0 ? -1 : 1
  return Math.round(sign * magnitude * 100) / 100
}
