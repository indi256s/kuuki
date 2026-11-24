import { type SvgNode } from '../grid'
import type { KitModule } from '../kit'
import { switchbackWall } from '../kit/building'

export const kotorWalls: KitModule = (box, p) =>
  [
    ...switchbackWall(box, { legs: 5, ratio: 0.82, angle: 40, fortW: 10, fortH: 7, ...p }),
  ] as SvgNode[]
