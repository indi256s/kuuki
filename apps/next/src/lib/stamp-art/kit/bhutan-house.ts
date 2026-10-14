// Bhutanese farmhouse (Paro valley): a broad three-storey rammed-earth house, walls leaning in a
// little, a ground floor with slit windows and a door, a middle floor of projecting wooden window
// bays, an open gallery under a wide low gable roof with deep eaves (shingle lines along the fall,
// stones on top), and terraced fields stepping across the foot. The right of the walls is shaded.
// The box is the house plus fields; its bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const bhutanHouse: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 17)))
  const base = y + h
  const cx = x + w / 2
  const out: SvgNode[] = []
  const fields = h * 0.14
  const floor = base - fields
  const hw = w * 0.38
  const wallH = h * 0.4
  const wallTop = floor - wallH
  const roofH = h * 0.3
  const batter = 2.2
  // Terraces under the house: stepped strips.
  for (let k = 0; k < 3; k++) {
    const ty = floor + (fields * k) / 3
    const strip: Pt[] = [
      [x, ty + 1 + k],
      [x + w, ty - 1],
      [x + w, base],
      [x, base],
    ]
    out.push(...body(strip.slice(0, 4), 'hair').slice(0, 1))
    out.push(hline('hair', x, x + w, ty + (k === 0 ? 0 : 1)))
    out.push(
      ...toneFill(rectPts(x, ty + 1.2, w, fields / 3 - 1), 'T3', { gap: [4, 4], inset: 0.2 }),
    )
  }
  // Walls.
  const wall: Pt[] = [
    [cx - hw, floor],
    [cx - hw + batter, wallTop],
    [cx + hw - batter, wallTop],
    [cx + hw, floor],
  ]
  out.push(...body(wall, 'line'))
  out.push(
    ...toneFill(
      [
        [cx + hw * 0.84, wallTop + 1],
        [cx + hw - batter, wallTop + 1],
        [cx + hw, floor],
        [cx + hw * 0.84, floor],
      ],
      'T4',
      { gap: [3, 3], inset: 0.3 },
    ),
  )
  const f1 = wallTop + wallH * 0.38
  const f2 = wallTop + wallH * 0.7
  out.push(hline('hair', cx - hw + 1, cx + hw - 1, f2))
  // Top floor: dark open gallery with posts.
  out.push(
    ...toneFill(rectPts(cx - hw + 5, wallTop + 3, hw * 2 - 10, f1 - wallTop - 3), 'T4', {
      gap: [4.6, 4.6],
      inset: 0.2,
    }),
  )
  for (let i = 0; i <= 5; i++) {
    const px = cx - hw + 5 + ((hw * 2 - 10) * i) / 5
    out.push(
      stroke('line', [
        [px, wallTop + 3],
        [px, f1],
      ]),
    )
  }
  out.push(hline('hair', cx - hw + 3, cx + hw - 3, f1))
  // Middle floor: wooden window bays.
  const bays = 4
  for (let i = 0; i < bays; i++) {
    const bx = cx - hw + 5 + ((hw * 2 - 22) * i) / (bays - 1)
    out.push(...body(rectPts(bx - 0.5, f1 + 2, 12, f2 - f1 - 3), 'hair'))
    out.push(fill(rectPts(bx + 1, f1 + 5.2, 2.6, f2 - f1 - 8)))
    out.push(fill(rectPts(bx + 4.7, f1 + 5.2, 2.6, f2 - f1 - 8)))
    out.push(fill(rectPts(bx + 8.4, f1 + 5.2, 2.6, f2 - f1 - 8)))
    out.push(hline('bold', bx - 1.5, bx + 12.5, f1 + 2))
  }
  // Ground floor: slits and the door.
  for (const fx of [-0.6, 0.6]) out.push(fill(rectPts(cx + hw * fx - 0.8, f2 + 3, 1.8, 5)))
  out.push(fill(rectPts(cx - 3.2, f2 + 2.4, 6.4, floor - f2 - 2.4)))
  // Roof: wide low gable with deep eaves, shingle lines along the fall, ridge stones.
  const eave = hw + 7
  const roof: Pt[] = [
    [cx - eave, wallTop + 1],
    [cx - eave * 0.62, wallTop - roofH],
    [cx + eave * 0.62, wallTop - roofH],
    [cx + eave, wallTop + 1],
  ]
  out.push(...body(roof, 'line'))
  out.push(
    ...toneFill(
      [
        [cx + eave * 0.05, wallTop - roofH + 0.8],
        [cx + eave * 0.62, wallTop - roofH + 0.8],
        [cx + eave - 0.8, wallTop + 0.4],
        [cx + eave * 0.05, wallTop + 0.4],
      ],
      'T4',
      { angle: 90 + 22, gap: [4, 4], inset: 0.3 },
    ),
  )
  out.push(hline('bold', cx - eave - 1, cx + eave + 1, wallTop + 1))
  for (let px = cx - eave * 0.55; px < cx + eave * 0.55; px += 5 + rand() * 3)
    out.push(fill(rectPts(px, wallTop - roofH - 1.8, 2.8, 2.2)))
  out.push(hline('bold', x + 1, x + w - 1, base))
  return out
}
