import type { KitModule } from '../kit'
import { kalaeFinial } from './kalae-finial'
import { kotorWalls } from './kotor-walls'
import { quadriga } from './quadriga'

/** One-off country parts by recipe name. */
export const signatures = {
  'kotor-walls': kotorWalls,
  'kalae-finial': kalaeFinial,
  quadriga,
} satisfies Record<string, KitModule>

export type SignatureName = keyof typeof signatures
export const isSignatureName = (name: string): name is SignatureName =>
  Object.hasOwn(signatures, name)
