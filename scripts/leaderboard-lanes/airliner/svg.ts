// Writes a built airliner as lane SVG: every point levelled (the lane shear), moved to the nose/ground origin, simplified
// and rounded; every paint an inline var() so the art follows the theme and the member's livery through the <use> clone
// (selectors don't reach into it, custom properties inherit).
import type { Ink, Item, Mat } from './model'
import type { Pt, Rings } from './surface'

/**
 * Douglas–Peucker tolerance, in final viewBox units (1 unit = 1 CSS px on a desktop lane). Coordinates are written to a
 * tenth, as the ground vehicles' are: under half a pixel even in a 4× close-up, at half the gzip size of hundredths.
 */
const EPS = 0.04
const r2 = (n: number) => {
  const v = Math.round(n * 100) / 100
  return Object.is(v, -0) ? '0' : String(v)
}
/** Tenths as the shortest SVG number: no leading zero, the minus sign doubling as the separator. */
const num = (h: number) => {
  const s = (Math.abs(h) / 10).toString().replace(/^0\./, '.')
  return h < 0 ? '-' + s : s
}
const join = (nums: number[]) => nums.map((h, i) => (i && h >= 0 ? ' ' : '') + num(h)).join('')
/** One ring as an absolute move and relative lines, from coordinates rounded to tenths first so nothing drifts. */
function encode(pts: Pt[], closed: boolean) {
  const q = pts
    .map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)])
    .filter((p, i, all) => i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1])
  if (q.length < (closed ? 3 : 2)) return ''
  let out = 'M' + join(q[0])
  const rel: number[] = []
  for (let i = 1; i < q.length; i++) rel.push(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1])
  if (rel.length) out += 'l' + join(rel)
  return out + (closed ? 'z' : '')
}

function simplify(pts: Pt[], closed: boolean): Pt[] {
  const p = pts.filter(
    (q, i) => i === 0 || Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) > 1e-4,
  )
  if (p.length < 4) return p
  const keep = p.map((_, i) => i === 0 || i === p.length - 1)
  const rdp = (a: number, b: number) => {
    const [ax, ay] = p[a],
      [bx, by] = p[b]
    const dx = bx - ax,
      dy = by - ay,
      l = Math.hypot(dx, dy) || 1e-9
    let far = -1,
      best = EPS
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((p[i][0] - ax) * dy - (p[i][1] - ay) * dx) / l
      if (d > best) {
        best = d
        far = i
      }
    }
    if (far < 0) return
    keep[far] = true
    rdp(a, far)
    rdp(far, b)
  }
  if (closed) {
    let far = 1
    for (let i = 1; i < p.length; i++)
      if (
        Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]) >
        Math.hypot(p[far][0] - p[0][0], p[far][1] - p[0][1])
      )
        far = i
    keep[far] = true
    rdp(0, far)
    rdp(far, p.length - 1)
  } else rdp(0, p.length - 1)
  return p.filter((_, i) => keep[i])
}

export type Box = { x0: number; y0: number; x1: number; y1: number }

/** Material tone vars: five tones (0 darkest … 4 the lit top) and the paper fill under them. */
const MAT: Record<Mat, string> = {
  body: 'b',
  livery: 'l',
  rubber: 'r',
  metal: 'm',
  void: 'v',
  glass: 'g',
}
const tone = (m: Mat, k: number) => `var(--a${MAT[m]}${k})`
const paper = (m: Mat) => `var(--a${MAT[m]}p)`
const INK: Record<Ink, string> = { line: 'var(--ail)', seam: 'var(--ais)', faint: 'var(--aif)' }

export function serialize(items: Item[], place: (p: Pt) => Pt, scale: number) {
  const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  const grow = ([x, y]: Pt) => {
    box.x0 = Math.min(box.x0, x)
    box.y0 = Math.min(box.y0, y)
    box.x1 = Math.max(box.x1, x)
    box.y1 = Math.max(box.y1, y)
  }
  const d = (rings: Rings, closed: boolean, track = true) =>
    rings
      .map((r) => {
        // A run that comes back to its start (a door outline) is a loop: simplified and closed as one.
        const [f, l] = [r[0], r[r.length - 1]]
        const loop = closed || (r.length > 3 && Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6)
        const pts = simplify((loop && !closed ? r.slice(0, -1) : r).map(place), loop)
        if (pts.length < (loop ? 3 : 2)) return ''
        if (track) pts.forEach(grow)
        return encode(pts, loop)
      })
      .join('')
  const w = (n: number) => r2(n * scale)
  const out: string[] = []
  for (const it of items) {
    if (it.kind === 'solid') {
      const fill = d(it.fill, true)
      if (!fill) continue
      out.push(`<path d="${fill}" style="fill:${paper(it.mat)}"/>`)
      it.tones.forEach((rings, k) => {
        const t = d(rings, true)
        if (t)
          out.push(
            `<path d="${t}" style="fill:${tone(it.mat, k)};stroke:${tone(it.mat, k)};stroke-width:.2"/>`,
          )
      })
      for (const l of it.inner) {
        const p = d(l.runs, false, false)
        if (p)
          out.push(
            `<path d="${p}" style="fill:none;stroke:${INK[l.ink]};stroke-width:${w(l.width)}"/>`,
          )
      }
      const edge = it.edge ?? 0.75
      if (edge > 0) {
        const o = d(it.outline, true, false)
        if (o)
          out.push(`<path d="${o}" style="fill:none;stroke:var(--ail);stroke-width:${w(edge)}"/>`)
      }
    } else if (it.kind === 'fill') {
      const p = d(it.rings, true, it.mat !== 'shadow')
      if (!p) continue
      if (it.mat === 'shadow')
        out.push(
          `<path d="${p}" style="fill:var(--iso-shadow);filter:blur(var(--lane-halo-blur,2px))"/>`,
        )
      else
        out.push(
          `<path d="${p}" style="fill:${paper(it.mat)}${it.edge ? `;stroke:${INK[it.edge]};stroke-width:${w(it.width ?? 0.3)}` : ''}"/>`,
        )
    } else {
      const p = d(it.lines.runs, false, false)
      if (p)
        out.push(
          `<path d="${p}" style="fill:none;stroke:${INK[it.lines.ink]};stroke-width:${w(it.lines.width)}"/>`,
        )
    }
  }
  return { body: out.join(''), box }
}

/**
 * The aircraft ramps, from the app's iso roles: four shades and a lit top per material, lines from the iso line roles.
 * Light keeps the house paper faces; dark lifts the faces one step off the surface, under the light iso line, as the
 * ground vehicles do, so a model reads as a solid, not a wireframe.
 */
export const AIRCRAFT_CSS = `.lane-vehicle{
  --ab4:var(--iso-top);--ab3:color-mix(in oklab,var(--iso-top) 55%,var(--iso-front));--ab2:var(--iso-front);
  --ab1:color-mix(in oklab,var(--iso-front) 50%,var(--iso-side));--ab0:var(--iso-side);--abp:var(--iso-front);
  --am4:color-mix(in oklab,var(--iso-front) 80%,var(--iso-line));--am3:color-mix(in oklab,var(--iso-front) 72%,var(--iso-line));
  --am2:color-mix(in oklab,var(--iso-side) 72%,var(--iso-line));--am1:color-mix(in oklab,var(--iso-side) 60%,var(--iso-line));
  --am0:color-mix(in oklab,var(--iso-side) 48%,var(--iso-line));--amp:var(--am2);
  --ar4:color-mix(in oklab,var(--iso-line) 72%,var(--iso-front));--ar3:color-mix(in oklab,var(--iso-line) 80%,var(--iso-front));
  --ar2:color-mix(in oklab,var(--iso-line) 88%,black);--ar1:color-mix(in oklab,var(--iso-line) 76%,black);
  --ar0:color-mix(in oklab,var(--iso-line) 66%,black);--arp:var(--ar1);
  --av4:color-mix(in oklab,var(--iso-line) 70%,black);--av3:color-mix(in oklab,var(--iso-line) 62%,black);
  --av2:color-mix(in oklab,var(--iso-line) 54%,black);--av1:color-mix(in oklab,var(--iso-line) 46%,black);
  --av0:color-mix(in oklab,var(--iso-line) 40%,black);--avp:var(--av1);
  --agp:color-mix(in oklab,var(--iso-line) 70%,#2c4058);
  --lv:var(--lane-livery,var(--figure-live-fill));
  --al4:color-mix(in oklab,var(--lv) 70%,white);--al3:color-mix(in oklab,var(--lv) 86%,white);--al2:var(--lv);
  --al1:color-mix(in oklab,var(--lv) 88%,black);--al0:color-mix(in oklab,var(--lv) 76%,black);--alp:var(--lv);
  --ail:var(--iso-line);--ais:color-mix(in oklab,var(--iso-crease) 80%,var(--iso-line));--aif:var(--iso-crease);
}
:root[data-theme='dark'] .lane-vehicle{
  --ab4:color-mix(in oklab,var(--iso-front) 78%,var(--text));--ab3:color-mix(in oklab,var(--iso-front) 84%,var(--text));
  --ab2:color-mix(in oklab,var(--iso-front) 90%,var(--text));--ab1:color-mix(in oklab,var(--iso-front) 96%,var(--text));
  --ab0:color-mix(in oklab,var(--iso-side) 94%,var(--text));--abp:var(--ab2);
  --am4:color-mix(in oklab,var(--iso-front) 74%,var(--text));--am3:color-mix(in oklab,var(--iso-front) 80%,var(--text));
  --am2:color-mix(in oklab,var(--iso-front) 88%,var(--text));--am1:var(--iso-front);--am0:var(--iso-side);--amp:var(--am2);
  --ar4:color-mix(in oklab,var(--iso-side) 80%,var(--text));--ar3:color-mix(in oklab,var(--iso-side) 88%,var(--text));
  --ar2:color-mix(in oklab,var(--iso-side) 70%,black);--ar1:color-mix(in oklab,var(--iso-side) 60%,black);
  --ar0:color-mix(in oklab,var(--iso-side) 50%,black);--arp:var(--ar1);
  --av4:color-mix(in oklab,var(--iso-side) 70%,black);--av3:color-mix(in oklab,var(--iso-side) 62%,black);
  --av2:color-mix(in oklab,var(--iso-side) 54%,black);--av1:color-mix(in oklab,var(--iso-side) 46%,black);
  --av0:color-mix(in oklab,var(--iso-side) 38%,black);--avp:var(--av1);
  --agp:color-mix(in oklab,var(--iso-side) 55%,#0b1420);
  --al4:color-mix(in oklab,var(--lv) 78%,white);--al3:color-mix(in oklab,var(--lv) 90%,white);--al2:var(--lv);
  --al1:color-mix(in oklab,var(--lv) 84%,black);--al0:color-mix(in oklab,var(--lv) 70%,black);--alp:var(--lv);
  --ais:color-mix(in oklab,var(--iso-crease) 60%,var(--iso-line));--aif:var(--iso-crease);
}`
