// Lane C round 2 hill and shore monuments: Samuel's Fortress over Lake Ohrid (MK), a wooden Ohrid
// boat, Gediminas Tower on its wooded hill (LT), Dubrovnik with Minčeta (HR), Guaita on Monte
// Titano (SM) and the Valletta bastions (MT). Boxes: the bottom is the ground or waterline.
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatchPoly,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { pointInPoly } from '../geom'
import { type KitModule, num } from './util'
import {
  arcCourse,
  arch,
  block,
  clipPolyY,
  cone,
  course,
  ellipse,
  merlons,
  profileY,
  shadeRect,
  slit,
} from './c2-parts'

/** The part of a polygon between two x values. */
function clipX(poly: Pt[], x0: number, x1: number): Pt[] {
  return clipPolyY(
    poly.map(([px, py]): Pt => [py, px]),
    x0,
    x1,
  ).map(([py, px]): Pt => [px, py])
}

/** Samuel's Fortress: crenellated walls and towers on a hill crest, old-town roofs descending to the lake. */
export const samuelsFortress: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const X = (f: number) => x + f * w
  const Y = (f: number) => y + f * h
  const prof: Pt[] = (
    [
      [0, 0.9],
      [0.05, 0.74],
      [0.12, 0.52],
      [0.2, 0.4],
      [0.3, 0.38],
      [0.46, 0.38],
      [0.56, 0.42],
      [0.64, 0.52],
      [0.72, 0.64],
      [0.82, 0.78],
      [0.92, 0.9],
      [1, 1],
    ] as Pt[]
  ).map(([fx, fy]) => [X(fx), Y(fy)])
  const out: SvgNode[] = []
  const hill: Pt[] = [...prof, [x, base]]
  out.push(...body(hill, 'line'))
  // lit left slope in fine diagonals, shaded right flank in T4
  out.push(
    ...hatchPoly([...prof.filter(([px]) => px <= X(0.5)), [X(0.5), base], [x, base]], {
      angle: -58,
      gap: 3.4,
      weight: 'fine',
    }),
  )
  out.push(
    ...toneFill([[X(0.5), Y(0.38)], ...prof.filter(([px]) => px >= X(0.5)), [X(0.5), base]], 'T4', {
      inset: 0.3,
    }),
  )
  // old town roofs descending the right slope, two tiers
  const houses: [number, number][] = [
    [0.6, 0],
    [0.69, 0],
    [0.78, 0],
    [0.87, 0],
    [0.92, 0],
    [0.65, 9],
    [0.74, 9],
    [0.83, 9],
    [0.9, 6],
  ]
  for (const [fx, lift] of houses) {
    const hx = X(fx)
    const hb = Math.min(base - 1, profileY(prof, hx + 5) + 7 + lift)
    const hw = 10.6
    const hh = 6.4
    out.push(...body(rectPts(hx, hb - hh, hw, hh), 'hair'))
    const roof: Pt[] = [
      [hx - 1.2, hb - hh],
      [hx + 2.4, hb - hh - 5.6],
      [hx + hw - 2.4, hb - hh - 5.6],
      [hx + hw + 1.2, hb - hh],
    ]
    out.push(occlude(roof), fill(roof))
    out.push(slit(hx + hw / 2 - 0.9, hb - hh + 1.8, 1.8, 3))
  }
  // the fortress: wall along the crest, a gate, three towers
  const crown = Y(0.38)
  const wx0 = X(0.2),
    wx1 = X(0.58)
  out.push(...body(rectPts(wx0, crown - 9, wx1 - wx0, 9.4), 'line'))
  out.push(...merlons(wx0, crown - 9, wx1 - wx0, 11))
  out.push(...shadeRect(wx0 + (wx1 - wx0) * 0.7, crown - 8, (wx1 - wx0) * 0.3, 8.4))
  out.push(course(wx0, wx1, crown - 9, 'bold'))
  out.push(arch(X(0.36), crown - 7.5, 4.4, 7.5))
  for (const [fx, tw, th] of [
    [0.22, 13, 19],
    [0.44, 14, 24],
    [0.57, 12, 19],
  ] as const) {
    const tx = X(fx) - tw / 2
    out.push(...block(tx, crown - th, tw, th + 0.4, { shade: 0.34 }))
    out.push(...merlons(tx, crown - th, tw, 3))
    out.push(course(tx - 1, tx + tw + 1, crown - th, 'bold'))
    out.push(slit(tx + tw * 0.28, crown - th + 6, 2.2, 5))
    if (th > 24) out.push(slit(tx + tw * 0.28, crown - th + 15, 2.2, 5))
  }
  return out
}

/** One long wooden Ohrid boat (plovka): a narrow hull with raised prow and stern. */
export const ohridBoat: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const hull: Pt[] = [
    [x, base - h * 0.62],
    [x + w * 0.1, base - h * 0.24],
    [x + w * 0.5, base - h * 0.1],
    [x + w * 0.9, base - h * 0.24],
    [x + w, base - h * 0.74],
    [x + w * 0.9, base - h * 0.5],
    [x + w * 0.5, base - h * 0.44],
    [x + w * 0.1, base - h * 0.48],
  ]
  const out: SvgNode[] = [occlude(hull, { halo: 0 })]
  out.push(fill(hull))
  // awning pole and a short canopy line, plus the glint under the hull
  out.push(
    stroke('hair', [
      [x + w * 0.52, base - h * 0.44],
      [x + w * 0.52, base - h * 1.1],
    ]),
  )
  out.push(
    stroke('hair', [
      [x + w * 0.28, base - h * 0.95],
      [x + w * 0.78, base - h * 0.95],
    ]),
  )
  return out
}

/** Gediminas Tower: an octagonal 3-storey brick tower with a stepped parapet on a wooded hill. */
export const gediminas: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const cx = x + w / 2
  const rand = mulberry32(5)
  const out: SvgNode[] = []
  const crown = base - 24
  // wooded hill: a rounded mound with a flat crown, scalloped with tree crowns, vertical foliage hatch like the distant trees
  const mound: Pt[] = []
  for (let i = 0; i <= 20; i++) {
    const u = i / 10 - 1
    const a = Math.abs(u)
    const k = u < 0 ? 0.3 : 0.24
    const f = a < k ? 0 : Math.pow((a - k) / (1 - k), 0.85)
    mound.push([cx + u * 52, crown + (base - crown) * f])
  }
  // resample along the outline and bulge each span outward into a crown
  const rim: Pt[] = [mound[0]]
  for (let i = 0; i + 1 < mound.length; i++) {
    const [ax, ay] = mound[i],
      [bx, by] = mound[i + 1]
    const dx = bx - ax,
      dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    if (len < 0.5) continue
    const span = Math.max(1, Math.round(len / 6.2))
    for (let k = 0; k < span; k++) {
      const p0: Pt = [ax + (dx * k) / span, ay + (dy * k) / span]
      const p1: Pt = [ax + (dx * (k + 1)) / span, ay + (dy * (k + 1)) / span]
      const bulge = 2.4 + rand() * 1.4
      const mid: Pt = [
        (p0[0] + p1[0]) / 2 + (dy / len) * bulge * 2,
        (p0[1] + p1[1]) / 2 - (dx / len) * bulge * 2,
      ]
      rim.push(...quad(p0, mid, p1, 5).slice(1))
    }
  }
  const poly: Pt[] = [...rim, [cx + 52, base], [cx - 52, base]]
  out.push(...body(rim, 'line'))
  out.push(...toneFill(poly, 'T4', { weight: 'fine', gap: 3, inset: 0.9 }))
  // wall pieces either side of the tower and a low gate wall in front, on the crown
  out.push(
    ...body(
      [
        [cx - 48, crown + 0.8],
        [cx - 48, crown - 10],
        [cx - 42, crown - 10],
        [cx - 42, crown - 6],
        [cx - 35, crown - 6],
        [cx - 35, crown - 8.5],
        [cx - 28, crown - 8.5],
        [cx - 28, crown + 0.8],
      ],
      'line',
    ),
  )
  out.push(...body(rectPts(cx + 22, crown - 8, 22, 8.8), 'line'))
  out.push(...merlons(cx + 22, crown - 8, 22, 4, 2.4))
  out.push(slit(cx + 31, crown - 5, 2.2, 4))
  // tower: three faces of an octagon, centre lit, left paper, right shaded
  const tw = 32
  const tx = cx - tw / 2
  const tTop = crown - 40
  const fL = tx + 7,
    fR = tx + tw - 7
  out.push(...body(rectPts(tx, tTop, tw, crown - tTop + 0.6), 'line'))
  out.push(...shadeRect(fR, tTop + 1, tw - (fR - tx), crown - tTop - 0.4))
  out.push(
    stroke('hair', [
      [fL, tTop],
      [fL, crown],
    ]),
    stroke('hair', [
      [fR, tTop],
      [fR, crown],
    ]),
  )
  out.push(course(tx, tx + tw, crown - 14, 'hair'), course(tx, tx + tw, crown - 27, 'hair'))
  for (const wy of [crown - 11.5, crown - 24.5, crown - 37.5]) out.push(arch(cx - 2.6, wy, 5.2, 7))
  out.push(slit(tx + 2.4, crown - 24, 2.2, 6), slit(tx + 2.4, crown - 37, 2.2, 6))
  out.push(...body(rectPts(cx - 22, crown - 6.4, 44, 7), 'line'))
  out.push(...merlons(cx - 22, crown - 6.4, 44, 8, 2.2))
  out.push(arch(cx - 2.6, crown - 5, 5.2, 5.8))
  // stepped parapet on a corbelled crown
  out.push(course(tx - 2.4, tx + tw + 2.4, tTop, 'bold'))
  const pw = tw + 4.8
  for (let i = 0; i < 4; i++) {
    const mx = tx - 2.4 + i * (pw / 4) + 0.6
    const mw = pw / 4 - 1.4
    out.push(
      ...body(
        [
          [mx, tTop],
          [mx, tTop - 3.2],
          [mx + mw * 0.22, tTop - 3.2],
          [mx + mw * 0.22, tTop - 5.4],
          [mx + mw * 0.78, tTop - 5.4],
          [mx + mw * 0.78, tTop - 3.2],
          [mx + mw, tTop - 3.2],
          [mx + mw, tTop],
        ],
        'hair',
      ),
    )
  }
  return out
}

/** Dubrovnik: Minčeta tower top left, walls descending to the sea around a dense block of tile roofs. */
export const dubrovnik: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const out: SvgNode[] = []
  const wall: Pt[] = [
    [x + 38, base - 42],
    [x + 62, base - 33],
    [x + 82, base - 18],
    [x + 99, base - 5],
  ]
  // the roof block: between the left wall, the descending wall and the sea wall, in banded T4 rows
  const blockPoly: Pt[] = [
    [x + 8, base - 42],
    ...wall.map(([px, py]): Pt => [px, py + 6]),
    [x + 99, base - 3],
    [x + 8, base - 3],
  ]
  out.push(occlude(blockPoly))
  for (let ry = base - 39; ry < base - 4; ry += 7.2) {
    const strip = clipPolyY(blockPoly, ry, ry + 4.4)
    if (strip.length > 2) out.push(...toneFill(strip, 'T4', { inset: 0.3 + ((ry * 7) % 3) }))
  }
  // descending wall: a lit band with merlons
  const lower: Pt[] = [...wall].reverse().map(([px, py]): Pt => [px, py + 7])
  out.push(...body([...wall, ...lower], 'line'))
  for (let i = 0; i + 1 < wall.length; i++) {
    const [ax, ay] = wall[i],
      [bx, by] = wall[i + 1]
    const n = Math.round(Math.hypot(bx - ax, by - ay) / 6)
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n
      out.push(
        ...body(rectPts(ax + (bx - ax) * t - 1.4, ay + (by - ay) * t - 2.8, 2.8, 2.8), 'hair'),
      )
    }
  }
  // left wall dropping to the shore and the sea wall along the foot
  out.push(...body(rectPts(x + 6, base - 42, 8, 40), 'line'))
  out.push(...body(rectPts(x + 6, base - 5, 95, 5), 'line'))
  out.push(course(x + 6, x + 101, base - 5, 'bold'))
  // a small round tower on the descending wall
  out.push(...block(x + 64, base - 46, 10, 18, { shade: 0.42 }))
  out.push(...merlons(x + 64, base - 46, 10, 3, 2))
  out.push(course(x + 63, x + 75, base - 46, 'bold'))
  // Minčeta: a fat round tower, projecting crown, small turret on top
  const mx = x + 24
  const mw = 34
  const mTop = base - 62
  const mBot = base - 36
  const sag = 3
  out.push(
    ...body(
      [
        [mx - mw / 2, mTop],
        [mx + mw / 2, mTop],
        [mx + mw / 2, mBot],
        ...quad([mx + mw / 2, mBot], [mx, mBot + sag * 2], [mx - mw / 2, mBot], 8).slice(1),
      ],
      'line',
    ),
  )
  out.push(
    ...toneFill(
      [
        [mx + mw * 0.1, mTop + 1],
        [mx + mw / 2 - 0.6, mTop + 1],
        [mx + mw / 2 - 0.6, mBot - 0.4],
        ...quad(
          [mx + mw / 2 - 0.6, mBot - 0.4],
          [mx + mw * 0.3, mBot + sag * 1.4],
          [mx + mw * 0.1, mBot + 1.2],
          4,
        ).slice(1),
      ],
      'T4',
      { inset: 0.3 },
    ),
  )
  out.push(
    ...body(
      [
        [mx - mw / 2 - 2.6, mTop],
        [mx + mw / 2 + 2.6, mTop],
        [mx + mw / 2 + 2.6, mTop - 4],
        [mx - mw / 2 - 2.6, mTop - 4],
      ],
      'line',
    ),
  )
  out.push(...merlons(mx - mw / 2 - 2.6, mTop - 4, mw + 5.2, 7, 3.4))
  out.push(course(mx - mw / 2 - 3.2, mx + mw / 2 + 3.2, mTop, 'bold'))
  out.push(arcCourse(mx - mw / 2, mx + mw / 2, mTop + 11, 2.2))
  out.push(...block(mx - 7, mTop - 12.4, 14, 8.4, { shade: 0.4 }))
  out.push(course(mx - 8.4, mx + 8.4, mTop - 12.4, 'bold'))
  out.push(...merlons(mx - 7, mTop - 12.4, 14, 3, 2))
  out.push(arch(mx - 8, mTop + 4, 4, 7), slit(mx - 1.6, mTop + 17, 2.2, 5.4))
  return out
}

/** Monte Titano: Guaita and its wall on the crest above a sheer T4 cliff, Cesta far along the ridge in T2. */
export const guaita: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const X = (f: number) => x + f * w
  const Y = (f: number) => y + f * h
  const prof: Pt[] = (
    [
      [0, 1],
      [0.05, 0.88],
      [0.12, 0.74],
      [0.2, 0.64],
      [0.27, 0.6],
      [0.33, 0.64],
      [0.4, 0.55],
      [0.47, 0.47],
      [0.52, 0.42],
      [0.74, 0.42],
      [0.77, 0.46],
      [0.78, 0.62],
      [0.79, 0.82],
      [0.805, 0.96],
      [0.85, 0.99],
      [1, 1],
    ] as Pt[]
  ).map(([fx, fy]) => [X(fx), Y(fy)])
  const out: SvgNode[] = []
  // Cesta first, small and in T2, further along the ridge
  const cx2 = X(0.27)
  const cTop = Y(0.6) - 20
  out.push(...body(rectPts(cx2 - 5, cTop, 10, 20.4), 'hair'))
  out.push(...toneFill(rectPts(cx2 - 5, cTop, 10, 20.4), 'T2', { angle: -58, gap: 2.8 }))
  out.push(...merlons(cx2 - 5, cTop, 10, 3, 2))
  // mountain
  out.push(...body(prof, 'line'))
  const crest = Y(0.42)
  out.push(
    ...hatchPoly([...prof.filter(([px]) => px <= X(0.52)), [X(0.52), base], [x, base]], {
      angle: -58,
      gap: 3.8,
      weight: 'fine',
    }),
  )
  out.push(
    ...toneFill(
      [[X(0.55), Y(0.45)], ...prof.filter(([px]) => px >= X(0.55)), [X(0.55), base]],
      'T4',
      { gap: 2.6, inset: 0.3 },
    ),
  )
  // cliff face: a few paper cracks in the T4
  for (const [fx, f0, f1] of [
    [0.7, 0.5, 0.72],
    [0.745, 0.55, 0.9],
    [0.66, 0.64, 0.86],
  ] as const)
    out.push(occlude(rectPts(X(fx), Y(f0), 1.2, Y(f1) - Y(f0))))
  // Guaita: a squat tower and its wall
  const wx0 = X(0.46),
    wx1 = X(0.745)
  out.push(...body(rectPts(wx0, crest - 9, wx1 - wx0, 9.6), 'line'))
  out.push(...merlons(wx0, crest - 9, wx1 - wx0, 9))
  out.push(...shadeRect(wx0 + (wx1 - wx0) * 0.72, crest - 8, (wx1 - wx0) * 0.28, 8.6))
  out.push(course(wx0, wx1, crest - 9, 'bold'))
  const tx = X(0.545)
  const tw = 24
  const tTop = crest - 29
  out.push(...block(tx, tTop, tw, 29.6, { shade: 0.36 }))
  out.push(...merlons(tx, tTop, tw, 4, 3))
  out.push(course(tx - 1.2, tx + tw + 1.2, tTop, 'bold'))
  out.push(slit(tx + 4, tTop + 8, 2.4, 6), slit(tx + 4, tTop + 19, 2.4, 6))
  return out
}

/** Valletta: battered bastion walls from the water, the 7-arch Upper Barrakka arcade, a gardjola at the tip. */
export const valletta: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const out: SvgNode[] = []
  const tip = x + w - 38
  const wallTop = base - 41
  const cordon = base - 31
  // battered slope under the cordon, flaring at the foot: lit on the left (fine), T4 on the right
  const batter: Pt[] = [
    [x, cordon + 4],
    [tip, cordon + 4],
    [tip + 6, base],
    [x, base],
  ]
  out.push(...body(batter, 'line'))
  const split = x + (tip - x) * 0.55
  out.push(...toneFill(clipX(batter, x, split), 'T4', { weight: 'fine', gap: 4.4, inset: 0.3 }))
  out.push(...toneFill(clipX(batter, split, tip + 6), 'T4', { gap: 3, inset: 0.3 }))
  // the shaded return face of the bastion tip
  const side: Pt[] = [
    [tip, wallTop],
    [x + w - 6, wallTop + 3],
    [x + w - 6, base],
    [tip + 6, base],
    [tip, cordon + 4],
  ]
  out.push(...body(side, 'line'))
  out.push(...toneFill(side, 'T4', { gap: 3.3, inset: 0.3 }))
  // cordon: a white band across both faces
  const band: Pt[] = [
    [x, cordon],
    [tip, cordon],
    [x + w - 6, cordon + 4],
    [x + w - 6, cordon + 8.5],
    [tip, cordon + 4.4],
    [x, cordon + 4.4],
  ]
  out.push(...body(band, 'hair'))
  out.push(course(x, tip, cordon, 'bold'))
  // lit curtain above the cordon
  out.push(...body(rectPts(x, wallTop, tip - x, cordon - wallTop), 'line'))
  out.push(...merlons(x, wallTop, 14, 3, 2.4))
  out.push(course(x, tip + 1, wallTop, 'bold'))
  // the arcade, seven arches
  const ax0 = x + 16,
    aw = 91,
    aTop = wallTop - 27
  out.push(...body(rectPts(ax0, aTop, aw, wallTop - aTop), 'line'))
  out.push(course(ax0 - 1.5, ax0 + aw + 1.5, aTop, 'bold'))
  out.push(course(ax0, ax0 + aw, aTop + 4, 'hair'))
  const bay = aw / 7
  for (let i = 0; i < 7; i++) out.push(arch(ax0 + i * bay + 2.4, aTop + 8, bay - 4.8, 14))
  out.push(course(ax0, ax0 + aw, wallTop - 2.6, 'hair'))
  // gardjola: a hexagonal sentry box on a corbel at the tip, in the foreground
  const gx = tip - 5
  const gw = 20
  const gTop = wallTop - 16
  out.push(
    ...body(
      [
        [gx + 1.5, wallTop],
        [gx + gw - 1.5, wallTop],
        [gx + gw - 4, wallTop + 5],
        [gx + 4, wallTop + 5],
      ],
      'line',
    ),
  )
  out.push(...body(rectPts(gx, gTop, gw, wallTop - gTop), 'line'))
  out.push(...shadeRect(gx + gw * 0.72, gTop + 1, gw * 0.28, wallTop - gTop - 1))
  out.push(
    stroke('hair', [
      [gx + gw * 0.28, gTop],
      [gx + gw * 0.28, wallTop],
    ]),
  )
  out.push(arch(gx + gw * 0.36, gTop + 7, 5, 7.6))
  out.push(
    stroke('hair', [
      ...quad(
        [gx + gw * 0.34, gTop + 4.2],
        [gx + gw * 0.5, gTop + 2],
        [gx + gw * 0.66, gTop + 4.2],
        4,
      ),
      ...quad(
        [gx + gw * 0.66, gTop + 4.2],
        [gx + gw * 0.5, gTop + 6],
        [gx + gw * 0.34, gTop + 4.2],
        4,
      ).slice(1),
    ]),
  )
  out.push(course(gx - 1.8, gx + gw + 1.8, gTop, 'bold'))
  out.push(...cone(gx + gw / 2, gTop, gw - 2, 10, 2, true))
  out.push(fill(ellipse(gx + gw / 2, gTop - 11.6, 1.4, 1.4, 8)))
  return out
}
