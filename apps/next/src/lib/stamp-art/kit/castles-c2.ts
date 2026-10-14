// Lane C round 2 castles, each with its own tell: the King's Gate of Suomenlinna (FI), the White
// Tower (GB), Kiek in de Kök (EE), Soroca Fortress (MD), Mir Castle (BY), Castle Cornet (GG).
// Boxes: the bottom is the ground or waterline; x/w span the whole group.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatchPoly,
  occlude,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule } from './util'
import {
  arcCourse,
  arch,
  block,
  cone,
  course,
  drum,
  ellipse,
  merlons,
  ogee,
  shadeRect,
  slit,
  spire,
} from './c2-parts'

/** Suomenlinna King's Gate: a stone gate with a stepped attic on the waterline, grassy earthworks. */
export const kingsGate: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const cx = x + w / 2
  const out: SvgNode[] = []
  // Earthworks either side: stone revetment with embrasures under a grassy T3 slope.
  const side = (dir: 1 | -1) => {
    const near = cx + dir * 24
    const far = dir === 1 ? x + w : x
    const key: Pt[] =
      dir === 1
        ? [
            [near, base - 24],
            [cx + 50, base - 27],
            [cx + 72, base - 22],
            [far, base - 13],
          ]
        : [
            [far, base - 13],
            [cx - 72, base - 22],
            [cx - 50, base - 27],
            [near, base - 24],
          ]
    // grassy crest: little tufts along the top line
    const crest: Pt[] = [key[0]]
    for (let i = 0; i + 1 < key.length; i++) {
      const [ax, ay] = key[i],
        [bx, by] = key[i + 1]
      const n = Math.max(2, Math.round(Math.abs(bx - ax) / 4.4))
      for (let k = 1; k <= n; k++) {
        const t = k / n
        crest.push(
          [ax + (bx - ax) * (t - 0.5 / n), ay + (by - ay) * (t - 0.5 / n) - 1.3],
          [ax + (bx - ax) * t, ay + (by - ay) * t],
        )
      }
    }
    const poly: Pt[] =
      dir === 1
        ? [...crest, [far, base - 9], [near, base - 9]]
        : [[far, base - 9], ...crest, [near, base - 9]]
    out.push(...body(poly, 'line'))
    out.push(...toneFill(poly, 'T3', { gap: 2.5, inset: 0.4 }))
    // revetment band with embrasures
    const bx = Math.min(near, far)
    const bw = Math.abs(far - near)
    out.push(...body(rectPts(bx, base - 9, bw, 9), 'line'))
    const n = 4
    for (let i = 0; i < n; i++) {
      const ex = bx + (bw / n) * (i + 0.5) - 1.6
      out.push(slit(ex, base - 6.6, 3.2, 3.6))
    }
    out.push(course(bx, bx + bw, base - 9, 'line'))
  }
  side(-1)
  side(1)
  // The gate: a main block with a stepped attic above one cornice.
  const hw = 28
  const yc = base - 46
  const silhouette: Pt[] = [
    [cx - hw, base],
    [cx - hw, yc - 4],
    [cx - 22, yc - 4],
    [cx - 22, yc - 10],
    [cx - 16, yc - 10],
    [cx - 16, yc - 16],
    [cx - 9, yc - 16],
    [cx - 9, yc - 22],
    [cx + 9, yc - 22],
    [cx + 9, yc - 16],
    [cx + 16, yc - 16],
    [cx + 16, yc - 10],
    [cx + 22, yc - 10],
    [cx + 22, yc - 4],
    [cx + hw, yc - 4],
    [cx + hw, base],
  ]
  out.push(...body(silhouette, 'line'))
  out.push(...shadeRect(cx + 16, yc + 1, hw - 16, base - yc - 1))
  out.push(
    ...toneFill(
      [
        [cx + 16, yc - 9.4],
        [cx + 22, yc - 9.4],
        [cx + 22, yc - 3.4],
        [cx + hw - 0.8, yc - 3.4],
        [cx + hw - 0.8, yc],
        [cx + 16, yc],
      ],
      'T4',
      { inset: 0.3 },
    ),
  )
  out.push(course(cx - hw - 1.5, cx + hw + 1.5, yc))
  out.push(course(cx - hw, cx + hw, base - 7, 'hair'))
  out.push(arch(cx - 7, base - 26, 14, 26))
  out.push(fill(ellipse(cx, yc - 11, 3.2, 3.2)))
  out.push(slit(cx - 20.5, yc + 8, 2.6, 8), slit(cx + 17.9 - 0.5, yc + 8, 2.6, 8))
  return out
}

/** The White Tower: a 3-storey keep, four corner turrets under ogee cupolas, a lower wall in front. */
export const whiteTower: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const cx = x + w / 2
  const out: SvgNode[] = []
  const roof = base - 48
  const fx0 = cx - 44,
    fx1 = cx + 26 // front face
  const sx1 = cx + 44 // side face right edge
  const turretTop = roof - 7
  const cupolaH = 9
  // back-left turret first, only its top rises above the roof
  out.push(...block(cx - 28, turretTop, 11, roof - turretTop + 2, { shade: 0.3 }))
  out.push(...ogee(cx - 22.5, turretTop, 11.4, cupolaH))
  // keep: front face lit, side face shaded
  out.push(...body(rectPts(fx0, roof, fx1 - fx0, base - roof), 'line'))
  out.push(...body(rectPts(fx1, roof + 2, sx1 - fx1, base - roof - 2), 'line'))
  out.push(...shadeRect(fx1, roof + 3, sx1 - fx1, base - roof - 3))
  out.push(course(fx0 - 1, fx1 + 1, roof))
  // storeys: string courses and arched windows
  out.push(course(fx0, fx1, roof + 14, 'hair'), course(fx0, fx1, roof + 28, 'hair'))
  for (const wx of [cx - 32, cx - 20, cx - 8, cx + 4]) {
    out.push(arch(wx, roof + 4, 4.4, 7.4))
    out.push(arch(wx, roof + 18, 4.4, 7.4))
  }
  // front-left and front-right corner turrets
  for (const tx of [fx0 - 1, fx1 - 10.5]) {
    out.push(...block(tx, turretTop, 12, base - turretTop, { shade: 0.32 }))
    out.push(...ogee(tx + 6, turretTop, 12.2, cupolaH))
    out.push(course(tx - 0.6, tx + 12.6, turretTop + 3, 'hair'))
  }
  // round stair turret, bigger and taller, at the back right
  const rx = sx1 - 15,
    rTop = turretTop - 3
  out.push(...block(rx, rTop, 15, roof + 12 - rTop, { shade: 0.45 }))
  out.push(...ogee(rx + 7.5, rTop, 16, cupolaH + 1))
  out.push(course(rx - 0.8, rx + 15.8, rTop + 3, 'hair'))
  // curtain wall in front, lower, with merlons
  const wy = base - 11
  out.push(...body(rectPts(x + 2, wy, w - 4, 11), 'line'))
  out.push(...merlons(x + 2, wy, w - 4, 22))
  out.push(...shadeRect(x + w - 30, wy + 0.8, 28, 10.2))
  out.push(course(x + 2, x + w - 2, wy, 'bold'))
  out.push(
    slit(cx - 12, wy + 4, 2.4, 4.5),
    slit(cx + 8, wy + 4, 2.4, 4.5),
    slit(x + 26, wy + 4, 2.4, 4.5),
  )
  return out
}

/** Kiek in de Kök: a fat drum with a tall conical roof, the town wall in T2 behind, Toompea slope. */
export const kiek: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const cx = x + w * 0.5
  const out: SvgNode[] = []
  // Toompea slope behind: a ridge falling to the right, T2 diagonal.
  const ridge: Pt[] = [
    [x, base - 56],
    [x + w * 0.18, base - 54],
    [x + w * 0.34, base - 46],
    [x + w * 0.62, base - 36],
    [x + w, base - 30],
  ]
  out.push(occlude([...ridge, [x + w, base], [x, base]]))
  out.push(
    ...toneFill([...ridge, [x + w, base - 10], [x, base - 10]], 'T2', { angle: 58, gap: 3.8 }),
  )
  out.push(stroke('hair', ridge))
  // Town wall in T2 with smaller conical-roofed towers.
  const wallTop = base - 20
  out.push(
    occlude([
      [x, wallTop],
      [x + w, wallTop],
      [x + w, base],
      [x, base],
    ]),
  )
  out.push(...toneFill(rectPts(x, wallTop, w, 20), 'T2', { angle: -58, gap: 2.8 }))
  out.push(
    stroke('hair', [
      [x, wallTop],
      [x + w, wallTop],
    ]),
  )
  out.push(course(x, x + w, wallTop - 0.1, 'hair'))
  for (const [tx, tw, th] of [
    [x + 14, 13, 40],
    [x + w * 0.2, 11, 32],
    [x + w * 0.83, 12, 36],
    [x + w - 14, 12, 40],
  ] as const) {
    const left = tx - tw / 2
    out.push(...body(rectPts(left, base - th, tw, th), 'hair'))
    out.push(...toneFill(rectPts(left, base - th, tw, th), 'T2', { angle: -58, gap: 2.8 }))
    out.push(...cone(tx, base - th, tw, tw * 0.95, 1.2))
  }
  // the drum in front, fat, with a plinth and a tall cone
  const dw = 38
  const dx = cx - dw / 2
  const dTop = base - 46
  out.push(
    ...body(
      [
        [dx - 3, base],
        [dx - 3, base - 6],
        [dx, base - 6],
        [dx, base - 4],
        [dx + dw, base - 4],
        [dx + dw, base - 6],
        [dx + dw + 3, base - 6],
        [dx + dw + 3, base],
      ],
      'line',
    ),
  )
  out.push(...drum(cx, dTop, base - 4, dw, { shade: 0.44, sag: 2.6, courses: [17, 30] }))
  out.push(course(dx - 3, dx + dw + 3, base - 6, 'hair'))
  out.push(arcCourse(dx - 1.5, dx + dw + 1.5, dTop, 2.2, 'bold'))
  for (const [ox, oy] of [
    [-13, 5],
    [-4, 5],
    [-13, 21],
    [-4, 21],
  ] as const)
    out.push(slit(cx + ox - 1.8, dTop + oy + 1, 3.6, 5))
  out.push(...cone(cx, dTop, dw, 25, 2.6, true))
  return out
}

/** Soroca Fortress: a round stone fort, four round towers and a square gate tower, low walls. */
export const soroca: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const cx = x + w / 2
  const out: SvgNode[] = []
  const wallTop = base - 24
  const bodyTop = base - 44
  const coneH = 24
  const tower = (tx: number, tw: number, top: number) => {
    out.push(...drum(tx, top, base - 2, tw, { shade: 0.4, sag: 2, courses: [] }))
    out.push(arcCourse(tx - tw / 2 - 1.2, tx + tw / 2 + 1.2, top, 2, 'bold'))
    out.push(...cone(tx, top, tw, coneH * (tw / 26) + 2, 2.2, true))
  }
  // rear towers, partly hidden by the wall
  for (const rx of [cx - 27, cx + 27]) {
    tower(rx, 19, bodyTop + 6)
  }
  // wall
  out.push(...body(rectPts(x + 14, wallTop, w - 28, base - wallTop), 'line'))
  out.push(...shadeRect(x + w - 44, wallTop + 0.8, 30, base - wallTop - 0.8))
  out.push(...merlons(x + 14, wallTop, w - 28, 18))
  out.push(course(x + 14, x + w - 14, wallTop, 'bold'))
  for (const sx of [cx - 40, cx + 40]) out.push(slit(sx - 1.2, wallTop + 7, 2.4, 6))
  // gate tower: square, hipped roof, dark passage
  const gw = 26
  const gTop = base - 44
  out.push(...block(cx - gw / 2, gTop, gw, base - gTop, { shade: 0.3 }))
  out.push(course(cx - gw / 2 - 1.2, cx + gw / 2 + 1.2, gTop, 'bold'))
  out.push(...spire(cx, gTop, gw, 14, 2))
  out.push(arch(cx - 5, base - 17, 10, 17))
  out.push(slit(cx - 1.2, gTop + 7, 2.4, 6))
  // end towers
  tower(x + 26, 26, bodyTop)
  tower(x + w - 26, 26, bodyTop)
  for (const tx of [x + 26, x + w - 26])
    out.push(slit(tx - 1.7 - 2.5, bodyTop + 10, 2.4, 6), slit(tx - 1.2 - 2.5, bodyTop + 24, 2.4, 6))
  return out
}

/** Mir Castle: four brick corner towers and a gate tower under steep spires, the palace block between. */
export const mirCastle: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const cx = x + w / 2
  const out: SvgNode[] = []
  const tower = (tx: number, tw: number, shaft: number, spireH: number) => {
    const top = base - shaft
    out.push(...block(tx - tw / 2, top, tw, shaft, { shade: 0.26 }))
    out.push(course(tx - tw / 2 - 1.2, tx + tw / 2 + 1.2, top, 'bold'))
    out.push(course(tx - tw / 2, tx + tw / 2, top + 6, 'hair'))
    out.push(...spire(tx, top, tw, spireH, 2, true))
    out.push(arch(tx - tw * 0.3, top + 11, tw * 0.3, 8))
    if (shaft > 36) out.push(arch(tx - tw * 0.3, top + 27, tw * 0.3, 8))
  }
  // rear pair, behind the palace roof
  for (const rx of [cx - 31, cx + 31]) tower(rx, 14, 44, 24)
  // palace block with a steep roof behind the front line
  const px0 = x + 30,
    px1 = x + w - 30
  const pTop = base - 28
  const roofPts: Pt[] = [
    [px0 + 3, pTop],
    [px0 + 7, pTop - 9],
    [px1 - 7, pTop - 9],
    [px1 - 3, pTop],
  ]
  out.push(occlude(roofPts), fill(roofPts))
  out.push(...block(px0, pTop, px1 - px0, base - pTop, { shade: 0.16 }))
  out.push(course(px0 - 1, px1 + 1, pTop, 'bold'))
  out.push(course(px0, px1, pTop + 12, 'hair'))
  for (const wx of [px0 + 9, px0 + 19, px1 - 28, px1 - 18]) {
    out.push(slit(wx, pTop + 4, 3, 5))
    out.push(slit(wx, pTop + 16, 3, 5))
  }
  // gate tower and the two front corner towers
  tower(cx, 22, 52, 33)
  tower(x + 22, 22, 46, 30)
  tower(x + w - 22, 22, 46, 30)
  out.push(arch(cx - 4.5, base - 14, 9, 14))
  return out
}

/** Castle Cornet: a fortress on a rocky islet with a long breakwater and a small beacon. */
export const castleCornet: KitModule = ([x, y, w, h]) => {
  const base = y + h
  const out: SvgNode[] = []
  const isl: Pt[] = [
    [x + 34, base],
    [x + 40, base - 8],
    [x + 48, base - 17],
    [x + 58, base - 22],
    [x + 100, base - 23],
    [x + 112, base - 19],
    [x + 120, base - 10],
    [x + 126, base],
  ]
  // breakwater: a long low mole to the left, capped with a bold line, beacon at its end
  const moleTop = base - 8
  out.push(...body(rectPts(x, moleTop, x + 40 - x, 8), 'line'))
  out.push(...toneFill(rectPts(x, moleTop + 3, 42, 5), 'T4', { inset: 0.3 }))
  out.push(course(x, x + 42, moleTop, 'bold'))
  out.push(...block(x + 6, base - 28, 8, 21, { shade: 0.4 }))
  out.push(course(x + 4.5, x + 15.5, base - 28, 'bold'))
  out.push(...cone(x + 10, base - 28, 8, 8, 1.2))
  out.push(slit(x + 8.2, base - 22, 2.2, 3.6))
  // islet rock: lit hatch on the left, T4 on the right
  out.push(...body(isl, 'line'))
  out.push(
    ...hatchPoly(
      isl.filter(([px]) => px < x + 76),
      { angle: -58, gap: 3.6, weight: 'fine' },
    ),
  )
  out.push(
    ...toneFill(
      [
        [x + 82, base - 23],
        ...isl.filter(([px]) => px >= x + 100),
        [x + 126, base],
        [x + 82, base],
      ],
      'T4',
      { inset: 0.3 },
    ),
  )
  // fortress on the crown
  const crown = base - 23
  const cx = x + 80
  // curtain wall, long and low
  out.push(...body(rectPts(x + 54, crown - 12, 52, 12), 'line'))
  out.push(...merlons(x + 54, crown - 12, 52, 10))
  out.push(...shadeRect(x + 90, crown - 11, 16, 11))
  out.push(course(x + 54, x + 106, crown - 12, 'bold'))
  // gate tower left
  out.push(...block(x + 56, crown - 28, 14, 28, { shade: 0.34 }))
  out.push(...merlons(x + 56, crown - 28, 14, 3))
  out.push(course(x + 55, x + 71, crown - 28, 'bold'))
  out.push(arch(x + 60.6, crown - 11, 4.8, 11))
  // keep: tall, centre-right, under a low hipped roof
  out.push(...block(cx + 2, crown - 38, 24, 38, { shade: 0.32 }))
  out.push(course(cx + 0.5, cx + 27.5, crown - 38, 'bold'))
  out.push(...spire(cx + 14, crown - 38, 24, 8, 2.2))
  out.push(slit(cx + 7, crown - 31, 2.6, 6), slit(cx + 15, crown - 31, 2.6, 6))
  out.push(slit(cx + 7, crown - 18, 2.6, 6), slit(cx + 15, crown - 18, 2.6, 6))
  // round bastion right
  out.push(...block(x + 106, crown - 18, 16, 18, { shade: 0.5 }))
  out.push(...merlons(x + 106, crown - 18, 16, 3))
  out.push(course(x + 105, x + 123, crown - 18, 'bold'))
  return out
}
