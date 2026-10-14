// Galapagos giant tortoise in side elevation facing right: thick pillar legs, a long raised neck
// and small head, and a domed shell ribbed with scutes. The box is the whole animal; its bottom
// is the ground. The shell is lit paper on top with a dark skirt, the legs carry wrinkle lines.
import { type Pt, type SvgNode, body, fill, hatch, quad, stroke } from '../grid'
import { type KitModule, num } from './util'

export const tortoiseA: KitModule = ([x, y, w, h], p) => {
  const at = ([fx, fy]: Pt): Pt => [x + w * fx, y + h * fy]
  const out: SvgNode[] = []
  const base = y + h
  const rimY = y + h * num(p, 'rim', 0.72)
  const cx = x + w * 0.4
  const rx = w * 0.37
  const ry = h * num(p, 'dome', 0.4)
  // Legs: two pillars behind the rim.
  const legs: Pt[][] = (
    [
      [
        [0.1, 0.66],
        [0.3, 0.66],
        [0.32, 0.95],
        [0.3, 1],
        [0.1, 1],
        [0.08, 0.95],
      ],
      [
        [0.56, 0.66],
        [0.78, 0.66],
        [0.8, 0.95],
        [0.78, 1],
        [0.54, 1],
        [0.52, 0.95],
      ],
    ] as Pt[][]
  ).map((l) => l.map(at))
  for (const l of legs) {
    out.push(...body(l, 'line'))
    for (let i = 0; i < 3; i++) {
      const yy = rimY + 3.5 + i * 3.4
      out.push(
        stroke(
          'hair',
          quad([l[0][0] + 2, yy], [(l[0][0] + l[1][0]) / 2, yy + 1.4], [l[1][0] - 2, yy], 5),
        ),
      )
    }
    out.push(
      ...hatch(
        [
          [l[1][0] - 5, rimY + 6],
          [l[1][0], rimY + 6],
          [l[1][0], base],
          [l[1][0] - 5, base],
        ],
        'v',
        2.4,
        'hair',
        0.3,
      ),
    )
  }
  // Neck and head: a thick neck lifted forward from the shell, blunt head, lower jaw line.
  const neck: Pt[] = (
    [
      [0.66, 0.56],
      [0.76, 0.4],
      [0.84, 0.3],
      [0.9, 0.24],
      [0.96, 0.22],
      [1, 0.27],
      [0.99, 0.34],
      [0.95, 0.38],
      [0.93, 0.46],
      [0.91, 0.6],
      [0.88, 0.8],
    ] as Pt[]
  ).map(at)
  out.push(...body(neck, 'line'))
  for (const f of [0.46, 0.56, 0.66]) {
    const a = at([0.8 + (f - 0.46) * 0.2, f])
    out.push(stroke('hair', quad(a, [a[0] + 3, a[1] + 1.5], [a[0] + 6, a[1]], 5)))
  }
  out.push(stroke('hair', [at([0.93, 0.37]), at([0.99, 0.35])]))
  const eye = at([0.945, 0.275])
  out.push(
    fill([
      [eye[0] - 1, eye[1] - 1],
      [eye[0] + 1, eye[1] - 1],
      [eye[0] + 1, eye[1] + 1],
      [eye[0] - 1, eye[1] + 1],
    ]),
  )
  // Shell dome with a slight flared rim.
  const dome: Pt[] = []
  for (let i = 0; i <= 24; i++) {
    const t = Math.PI - (Math.PI * i) / 24
    dome.push([cx + rx * Math.cos(t), rimY - ry * Math.pow(Math.sin(t), 0.85)])
  }
  const shell: Pt[] = [[cx - rx - 2, rimY + 3], ...dome, [cx + rx + 2, rimY + 3]]
  out.push(...body(shell, 'line'))
  const shade: Pt[] = [
    ...dome.filter(([px]) => px > cx + rx * 0.2),
    [cx + rx, rimY - 8],
    [cx + rx * 0.2, rimY - 8],
  ]
  out.push(...hatch(shade, 'v', 2.4, 'hair', 0.3))
  // Dark skirt along the rim.
  const skirt: Pt[] = [
    [cx - rx - 2, rimY + 3],
    [cx - rx, rimY - 8],
    [cx + rx, rimY - 8],
    [cx + rx + 2, rimY + 3],
  ]
  out.push(...hatch(skirt, 'v', 2.1, 'hair', 0.2))
  out.push(
    stroke('bold', [
      [cx - rx - 2.5, rimY + 3],
      [cx + rx + 2.5, rimY + 3],
    ]),
  )
  out.push(
    stroke('hair', [
      [cx - rx, rimY - 8],
      [cx + rx, rimY - 8],
    ]),
  )
  // Scutes: three rows of plates in brick pattern. Each row is bounded by a dome-shaped ring;
  // ribs between rings are offset row to row.
  const sk = rimY - 8
  const pt = (k: number, t: number): Pt => [
    cx + rx * k * Math.cos(t),
    sk - (sk - (rimY - ry * Math.pow(Math.sin(t), 0.85))) * k,
  ]
  const rings = [1, 0.7, 0.4]
  const cols = [8, 6, 4]
  for (let r = 1; r < rings.length; r++) {
    const arc: Pt[] = []
    for (let i = 0; i <= 24; i++) arc.push(pt(rings[r], Math.PI - (Math.PI * i) / 24))
    out.push(
      stroke(
        'line',
        arc.filter(([px, py]) => py < sk - 1 && px === px),
      ),
    )
  }
  for (let r = 0; r < rings.length; r++) {
    const n = cols[r]
    for (let i = 1; i < n; i++) {
      const t = Math.PI - (Math.PI * (i + (r % 2 ? 0.5 : 0))) / n
      if (t <= 0.05 || t >= Math.PI - 0.05) continue
      const kOut = rings[r]
      const kIn = r + 1 < rings.length ? rings[r + 1] : 0.12
      out.push(stroke('hair', [pt(kOut, t), pt(kIn, t)]))
      if (r % 2 === 0 && i % 2 === 1) {
        const t2 = Math.PI - (Math.PI * (i + 1)) / n
        out.push(
          ...hatch([pt(kOut, t), pt(kIn, t), pt(kIn, t2), pt(kOut, t2)], 'v', 2.4, 'fine', 0.3),
        )
      }
    }
  }
  return out
}
