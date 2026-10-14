// Samoan fale (lane A, `-a` until consolidated): a tall rounded thatch dome roof with a small
// finial, carried on a ring of open posts over a low raised platform. Posts are lit and the
// space between them is dark, so the roof reads as floating light over a dark rhythm. The box is
// the house; its bottom is the platform's foot.
import { type Pt, type SvgNode, body, hline, occlude, quad, stroke, toneFill, vline } from '../grid'
import { type KitModule, num } from './util'

export const faleA: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const platH = h * 0.08
  const postsH = h * num(p, 'posts', 0.3)
  const postTop = base - platH - postsH
  const cx = x + w / 2
  const rx = w * 0.5
  const roofH = postTop - y
  const out: SvgNode[] = []
  // Dark interior behind the posts.
  const inner: Pt[] = [
    [x + w * 0.08, postTop],
    [x + w * 0.92, postTop],
    [x + w * 0.92, base - platH],
    [x + w * 0.08, base - platH],
  ]
  out.push(...body(inner, 'hair'))
  out.push(...toneFill(inner, 'T4', { gap: 2.7, inset: 0.2 }))
  // Posts: lit bars standing in the dark.
  const n = Math.max(4, Math.round(num(p, 'postCount', 8)))
  for (let i = 0; i <= n; i++) {
    const px = x + w * 0.1 + (w * 0.8 * i) / n
    const pw = i === 0 || i === n ? 3.2 : 2.6
    const post: Pt[] = [
      [px - pw / 2, postTop],
      [px + pw / 2, postTop],
      [px + pw / 2, base - platH],
      [px - pw / 2, base - platH],
    ]
    out.push(...body(post, 'hair'))
  }
  // Roof: a half-ellipse dome with a slightly pointed crown and a gently curved eave.
  const dome: Pt[] = []
  for (let i = 0; i <= 36; i++) {
    const a = Math.PI * (i / 36)
    const px = cx + rx * Math.cos(Math.PI - a)
    const k = Math.sin(a)
    const py = postTop - roofH * (k ** 0.85 * 0.97 + (1 - Math.abs(Math.cos(a))) * 0.0)
    dome.push([px, py])
  }
  const eave: Pt[] = quad([cx + rx, postTop], [cx, postTop + 4.2], [cx - rx, postTop], 14)
  const roof: Pt[] = [...dome, ...eave.slice(1)]
  out.push(occlude(roof))
  out.push(stroke('line', roof, true))
  // Thatch courses: arcs of fine lines across the lit left, bowing with the dome.
  const rows = 6
  for (let r = 1; r < rows; r++) {
    const f = r / rows
    const yy = postTop - roofH * f * 0.92
    const half = rx * Math.sqrt(Math.max(0, 1 - (f * 0.92) ** 1.7)) * 0.96
    out.push(stroke('fine', quad([cx - half, yy], [cx, yy + 3], [cx + half * 0.25, yy], 8)))
  }
  // Shaded right flank of the roof.
  const cut = cx + rx * 0.3
  const shade: Pt[] = [
    [cut, postTop + 1.2],
    ...dome.filter((q) => q[0] > cut).slice(),
    ...eave
      .filter((q) => q[0] > cut)
      .reverse()
      .slice(0, 0),
  ]
  const shadeFull: Pt[] = [...dome.filter((q) => q[0] > cut), ...eave.filter((q) => q[0] > cut)]
  out.push(...toneFill([[cut, shade[0][1]], ...shadeFull], 'T4', { gap: 2.6, inset: 0.3 }))
  out.push(stroke('bold', eave))
  // Finial.
  out.push(vline('line', cx, y - 1, y + 4))
  // Platform: a low coral-pebble step wider than the posts.
  const plat: Pt[] = [
    [x - w * 0.02, base - platH],
    [x + w * 1.02, base - platH],
    [x + w * 1.04, base],
    [x - w * 0.04, base],
  ]
  out.push(...body(plat, 'line'))
  out.push(...toneFill(plat, 'T3', { angle: 0, gap: 2, weight: 'hair', inset: 0.3 }))
  out.push(hline('bold', x - w * 0.08, x + w * 1.08, base))
  return out
}
