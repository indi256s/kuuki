// ME: the walls of Kotor climbing the slope in switchbacks to the fortress at the top, and the sea
// wall along the old town's waterline. Route and proportions only; drawing is the shared kit.
import { type SvgNode } from '../grid'
import type { KitModule } from '../kit'
import { switchbackWall } from '../kit/building'

/** Four to five legs at 35-45 degrees, each shorter than the one below, ending in a 10x7 fort. */
export const kotorWalls: KitModule = (box, p) =>
  [
    ...switchbackWall(box, { legs: 5, ratio: 0.82, angle: 40, fortW: 10, fortH: 7, ...p }),
  ] as SvgNode[]
