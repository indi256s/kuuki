import type { KitModule } from '../kit'
import { kalaeFinial } from './kalae-finial'
import { kotorWalls } from './kotor-walls'
import { latticeTower } from './lattice-tower'
import { plume } from './plume'
import { quadriga } from './quadriga'
import { seaplane } from './seaplane'
import { stela } from './stela'

/** One-off country parts by recipe name. */
export const signatures = {
  'kotor-walls': kotorWalls,
  'kalae-finial': kalaeFinial,
  quadriga,
  'lattice-tower': latticeTower,
  plume,
  stela,
  seaplane,
} satisfies Record<string, KitModule>

export type SignatureName = keyof typeof signatures
export const isSignatureName = (name: string): name is SignatureName =>
  Object.hasOwn(signatures, name)
