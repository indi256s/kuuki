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

export const FRAME_WEIGHTS = { outer: 3.4, inner: 1.2, window: 1.6 } as const
export const INNER_INSET = 4.5
export const RING_CAP = 9.5
export const SUBJECT_INSET = 6

export type RingPath = {
  d: string
  length: number
  startOffset: '50%'
}

export type Frame = {
  name: ShapeName
  family: ShapeFamily
  viewBox: string
  outer: [string, string]
  window: string
  windowBox: Box
  ring: { top: RingPath; bottom: RingPath; capHeight: number }
}

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

const ROUND_BAND = 19

const SIDE = 14
const CAP_BAND = 22

function rectSpecs(r: Box, c: number, uniformWindow: boolean) {
  const [x, y, w, h] = r
  const cut = (inset: number, dx: number, dy: number): Spec => {
    const cw = c <= 0 ? 0 : Math.max(0, x + y + c + inset * Math.SQRT2 - (x + dx) - (y + dy))
    return { kind: 'chamfer', x: x + dx, y: y + dy, w: w - 2 * dx, h: h - 2 * dy, c: cw }
  }
  return {
    outer: cut(0, 0, 0),
    inner: cut(INNER_INSET, INNER_INSET, INNER_INSET),
    window: uniformWindow ? cut(CAP_BAND, SIDE, CAP_BAND) : cut(SIDE, SIDE, CAP_BAND),
  }
}

type FrameDef = {
  family: ShapeFamily
  outer: Spec
  inner: Spec
  window: Spec
  ring: Frame['ring']
}

function ellipseHalf(rx: number, ry: number, top: boolean): RingPath {
  const d = top
    ? `M${n(100 - rx)} 100A${n(rx)} ${n(ry)} 0 0 1 ${n(100 + rx)} 100`
    : `M${n(100 - rx)} 100A${n(rx)} ${n(ry)} 0 0 0 ${n(100 + rx)} 100`
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
      top: ellipseHalf(rx - mid - half, ry - mid - half, true),
      bottom: ellipseHalf(rx - mid + half, ry - mid + half, false),
      capHeight: RING_CAP,
    },
  }
}

function lineRing(x0: number, x1: number, y: number): RingPath {
  return { d: `M${n(x0)} ${n(y)}H${n(x1)}`, length: x1 - x0, startOffset: '50%' }
}

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
  const gap = bandMid - half - INNER_INSET
  const cut = s.inner.kind === 'chamfer' ? s.inner.c : 0
  const reach = (cut > gap ? cut - gap : 0) + INNER_INSET + 4
  if (cutText) {
    const topY = y + bandMid + half
    const botY = y + h - bandMid + half
    const topOff = topY - y
    const botOff = y + h - botY
    const k = Math.SQRT2 - 1
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
  oval: roundDef(88, 96),
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

export const windowPoly = (shape: ShapeName): Pt[] => specPoly(defs[shape].window)

export const outerPoly = (shape: ShapeName): Pt[] => specPoly(defs[shape].outer)

export function subjectPoly(shape: ShapeName, d = SUBJECT_INSET): Pt[] {
  const w = defs[shape].window
  if (w.kind === 'ellipse') return specPoly({ ...w, rx: w.rx - d, ry: w.ry - d })
  const [x, y] = [w.x + d, w.y + d]
  const cw = w.c <= 0 ? 0 : w.c + d * (Math.SQRT2 - 2)
  return specPoly({ kind: 'chamfer', x, y, w: w.w - 2 * d, h: w.h - 2 * d, c: Math.max(0, cw) })
}

type CatalogEntry = { stampShape: ShapeFamily }
const catalog = countries as unknown as Record<string, CatalogEntry | undefined>

export function familyOf(iso2: string): ShapeFamily {
  return catalog[iso2.toUpperCase()]?.stampShape === 'circle' ? 'circle' : 'rectangle'
}

export function shapeFor(iso2: string, override?: ShapeName): ShapeName {
  if (override) return override
  const options = FAMILY_SHAPES[familyOf(iso2)]
  return options[hash32(`shape:${iso2.toUpperCase()}`) % options.length]
}

export function restTilt(iso2: string, shape: ShapeName = shapeFor(iso2)): number {
  const h = hash32(`tilt:${iso2.toUpperCase()}`)
  const [lo, hi] = FAMILY_SHAPES.circle.includes(shape) ? [2, 4.5] : [1, 2.5]
  const magnitude = lo + (((h >>> 8) % 1000) / 999) * (hi - lo)
  const sign = (h & 1) === 0 ? -1 : 1
  return Math.round(sign * magnitude * 100) / 100
}
